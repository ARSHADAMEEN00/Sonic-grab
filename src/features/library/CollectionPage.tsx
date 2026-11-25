import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid2,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Archive as ZipIcon,
  PlayArrow as PlayIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppDispatch, useAppSelector } from '../../app/store/hooks';
import { AlbumCard } from '../../components/albums/AlbumCard';
import { AlbumDetailsDialog } from '../../components/albums/AlbumDetailsDialog';
import { TrackTable } from '../../components/music/TrackTable';
import { playTrackPreview } from '../discovery/playerSlice';
import {
  createPlaylist,
  deletePlaylist,
  removeTrackFromPlaylist,
  toggleFavouriteArtist,
} from './librarySlice';
import { exportCachedTracksAsZip } from '../../services/api/downloadManager';
import type { Album, Track } from '../../types/music';
import { formatBytes } from '../../utils/formatters';
import { getAudioBlob } from '../../utils/indexedDb';

const playlistSchema = z.object({
  name: z.string().trim().min(2, 'Playlist name must be at least 2 characters'),
  description: z.string().trim().optional(),
});

type PlaylistFormValues = z.infer<typeof playlistSchema>;

export const CollectionPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const library = useAppSelector((s) => s.library);

  const [tab, setTab] = useState<'playlists' | 'songs' | 'albums' | 'artists' | 'history'>('playlists');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(
    library.playlists[0]?.id ?? 'saved-collection',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'title' | 'artist' | 'language'>('default');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [zipMessage, setZipMessage] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PlaylistFormValues>({
    resolver: zodResolver(playlistSchema),
    defaultValues: { name: '', description: '' },
  });

  const activePlaylist =
    library.playlists.find((p) => p.id === selectedPlaylistId) ?? library.playlists[0];

  const sortAndFilterTracks = (list: Track[]): Track[] => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.artist.toLowerCase().includes(q) ||
            t.album.toLowerCase().includes(q) ||
            t.language.toLowerCase().includes(q),
        )
      : list;

    if (sortBy === 'title') return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    if (sortBy === 'artist') return [...filtered].sort((a, b) => a.artist.localeCompare(b.artist));
    if (sortBy === 'language') return [...filtered].sort((a, b) => a.language.localeCompare(b.language));
    return filtered;
  };

  const playlistTracks = useMemo(() => {
    if (!activePlaylist) return [];
    const list = activePlaylist.trackIds
      .map((id) => library.tracksById[id])
      .filter((t): t is Track => Boolean(t));
    return sortAndFilterTracks(list);
  }, [activePlaylist, library.tracksById, searchQuery, sortBy]);

  const favouriteTracks = useMemo(() => {
    const list = library.favouriteTrackIds
      .map((id) => library.tracksById[id])
      .filter((t): t is Track => Boolean(t));
    return sortAndFilterTracks(list);
  }, [library.favouriteTrackIds, library.tracksById, searchQuery, sortBy]);

  const favouriteAlbums = library.favouriteAlbumIds
    .map((id) => library.albumsById[id])
    .filter((a): a is Album => Boolean(a));

  const favouriteArtists = library.artists.filter((a) => a.favourite);

  const onCreatePlaylist = (values: PlaylistFormValues) => {
    dispatch(
      createPlaylist({
        name: values.name,
        description: values.description,
      }),
    );
    reset();
    setCreateOpen(false);
  };

  const handlePlayLocalHistoryTrack = async (trackId: string) => {
    const stored = await getAudioBlob(trackId);
    const track = library.tracksById[trackId];
    if (stored && track) {
      const url = URL.createObjectURL(stored.blob);
      dispatch(playTrackPreview({ track, localBlobUrl: url }));
    }
  };

  const handleExportPlaylistZip = async () => {
    if (!activePlaylist) return;
    const safeName = activePlaylist.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const count = await exportCachedTracksAsZip(
      activePlaylist.trackIds,
      `${safeName || 'playlist'}.zip`,
    );
    setZipMessage(
      count > 0
        ? `Exported ${count} downloaded MP3(s) from "${activePlaylist.name}" as ZIP.`
        : 'No downloaded MP3 files in this playlist are cached in your browser yet.',
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4">My Collection</Typography>
          <Typography variant="body2" color="text.secondary">
            Your personal playlists, favourites, and downloaded MP3s stored privately in your browser.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          New Playlist
        </Button>
      </Box>

      {zipMessage && (
        <Alert severity="info" onClose={() => setZipMessage(null)}>
          {zipMessage}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v as typeof tab)} variant="scrollable" scrollButtons="auto">
        <Tab label={`Playlists (${library.playlists.length})`} value="playlists" />
        <Tab label={`Favourite Songs (${favouriteTracks.length})`} value="songs" />
        <Tab label={`Favourite Albums (${favouriteAlbums.length})`} value="albums" />
        <Tab label={`Favourite Artists (${favouriteArtists.length})`} value="artists" />
        <Tab label={`Download History (${library.downloadHistory.length})`} value="history" />
      </Tabs>

      {(tab === 'playlists' || tab === 'songs') && (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} justifyContent="space-between">
          <TextField
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your collection..."
            sx={{ minWidth: 260 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            select
            size="small"
            label="Sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="default">Default Order</MenuItem>
            <MenuItem value="title">Title (A-Z)</MenuItem>
            <MenuItem value="artist">Artist (A-Z)</MenuItem>
            <MenuItem value="language">Language</MenuItem>
          </TextField>
        </Stack>
      )}

      {tab === 'playlists' && activePlaylist && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {library.playlists.map((pl) => (
              <Chip
                key={pl.id}
                label={`${pl.name} (${pl.trackIds.length})`}
                color={pl.id === activePlaylist.id ? 'primary' : 'default'}
                onClick={() => setSelectedPlaylistId(pl.id)}
                onDelete={
                  !pl.isDefault
                    ? () => dispatch(deletePlaylist(pl.id))
                    : undefined
                }
              />
            ))}
          </Stack>

          <Card>
            <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Typography variant="h6">{activePlaylist.name}</Typography>
                {activePlaylist.description && (
                  <Typography variant="body2" color="text.secondary">
                    {activePlaylist.description}
                  </Typography>
                )}
              </Box>
              <Button
                size="small"
                variant="outlined"
                color="secondary"
                startIcon={<ZipIcon />}
                disabled={activePlaylist.trackIds.length === 0}
                onClick={() => void handleExportPlaylistZip()}
              >
                Export Cached MP3s (.zip)
              </Button>
            </CardContent>
          </Card>

          <TrackTable
            tracks={playlistTracks}
            emptyMessage="This playlist is empty. Click the + playlist button on any track across SONIC GRAB to add songs here."
          />

          {playlistTracks.length > 0 && (
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {playlistTracks.slice(0, 10).map((t) => (
                <Chip
                  key={t.id}
                  size="small"
                  label={`Remove: ${t.title}`}
                  onDelete={() =>
                    dispatch(
                      removeTrackFromPlaylist({
                        playlistId: activePlaylist.id,
                        trackId: t.id,
                      }),
                    )
                  }
                />
              ))}
            </Stack>
          )}
        </Box>
      )}

      {tab === 'songs' && (
        <TrackTable
          tracks={favouriteTracks}
          emptyMessage="No favourite songs yet. Click the heart icon on any track."
        />
      )}

      {tab === 'albums' && (
        <Grid2 container spacing={2}>
          {favouriteAlbums.length === 0 ? (
            <Grid2 size={{ xs: 12 }}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary">
                    No favourite albums yet. Click the heart icon on any album card.
                  </Typography>
                </CardContent>
              </Card>
            </Grid2>
          ) : (
            favouriteAlbums.map((album) => (
              <Grid2 key={album.id} size={{ xs: 12, sm: 6, md: 3 }}>
                <AlbumCard album={album} onSelect={setSelectedAlbum} />
              </Grid2>
            ))
          )}
        </Grid2>
      )}

      {tab === 'artists' && (
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {favouriteArtists.map((artist) => (
            <Chip
              key={artist.id}
              label={`${artist.name} • ${artist.primaryLanguage}`}
              onDelete={() => dispatch(toggleFavouriteArtist(artist.id))}
              variant="outlined"
            />
          ))}
        </Stack>
      )}

      {tab === 'history' && (
        <Grid2 container spacing={2}>
          {library.downloadHistory.length === 0 ? (
            <Grid2 size={{ xs: 12 }}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary">
                    No downloads recorded yet.
                  </Typography>
                </CardContent>
              </Card>
            </Grid2>
          ) : (
            library.downloadHistory.map((item) => (
              <Grid2 key={item.id} size={{ xs: 12, md: 6 }}>
                <Card>
                  <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle2" noWrap>
                        {item.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap display="block">
                        {item.artist} • {item.fileName}
                      </Typography>
                      <Typography variant="caption" color="primary.main">
                        {item.licence} • {formatBytes(item.fileSizeBytes)}
                      </Typography>
                    </Box>
                    {item.hasLocalBlob && (
                      <IconButton
                        color="primary"
                        onClick={() => void handlePlayLocalHistoryTrack(item.trackId)}
                        title="Play cached MP3"
                      >
                        <PlayIcon />
                      </IconButton>
                    )}
                  </CardContent>
                </Card>
              </Grid2>
            ))
          )}
        </Grid2>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create Playlist</DialogTitle>
        <Box component="form" onSubmit={handleSubmit(onCreatePlaylist)}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Playlist Name"
                  error={Boolean(errors.name)}
                  helperText={errors.name?.message}
                  fullWidth
                />
              )}
            />
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Description (optional)" fullWidth />
              )}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">
              Create
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <AlbumDetailsDialog album={selectedAlbum} onClose={() => setSelectedAlbum(null)} />
    </Box>
  );
};
