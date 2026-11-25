import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
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
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useAppDispatch, useAppSelector } from '../../app/store/hooks';
import { AlbumCard } from '../../components/albums/AlbumCard';
import { AlbumDetailsDialog } from '../../components/albums/AlbumDetailsDialog';
import { ArtistCard } from '../../components/artists/ArtistCard';
import { SkeletonGrid, SkeletonTable } from '../../components/music/SkeletonGrid';
import { TrackTable } from '../../components/music/TrackTable';
import {
  addArtist,
  cacheTracks,
  removeArtist,
  toggleFavouriteArtist,
} from '../library/librarySlice';
import { fetchArtistLiveCatalog } from '../../services/providers/providerRegistry';
import type { Album, ArtistEntry, MusicLanguage, Track } from '../../types/music';

const addArtistSchema = z.object({
  name: z.string().trim().min(2, 'Artist name must be at least 2 characters'),
  category: z.enum(['international', 'indian']),
  primaryLanguage: z.enum([
    'English',
    'Malayalam',
    'Hindi',
    'Tamil',
    'Arabic',
    'Other',
  ]),
  genresText: z.string().trim().min(2, 'Enter at least one genre'),
});

type AddArtistFormValues = z.infer<typeof addArtistSchema>;

export const ArtistsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const artists = useAppSelector((s) => s.library.artists);
  const credentials = useAppSelector((s) => s.settings.credentials);

  const [filterText, setFilterText] = useState('');
  const [categoryTab, setCategoryTab] = useState<'all' | 'international' | 'indian' | 'favourites'>('all');
  const [addOpen, setAddOpen] = useState(false);

  const [inspectedArtist, setInspectedArtist] = useState<ArtistEntry | null>(null);
  const [artistAlbums, setArtistAlbums] = useState<Album[]>([]);
  const [artistTracks, setArtistTracks] = useState<Track[]>([]);
  const [artistWarnings, setArtistWarnings] = useState<string[]>([]);
  const [artistLoading, setArtistLoading] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddArtistFormValues>({
    resolver: zodResolver(addArtistSchema),
    defaultValues: {
      name: '',
      category: 'international',
      primaryLanguage: 'English',
      genresText: 'Pop',
    },
  });

  const openArtistCatalog = async (artist: ArtistEntry) => {
    setInspectedArtist(artist);
    setArtistLoading(true);
    setArtistWarnings([]);
    const res = await fetchArtistLiveCatalog(
      artist.name,
      artist.primaryLanguage,
      credentials,
    );
    setArtistAlbums(res.albums);
    setArtistTracks(res.tracks);
    setArtistWarnings(res.warnings);
    dispatch(cacheTracks(res.tracks));
    setArtistLoading(false);
  };

  useEffect(() => {
    const inspectName = searchParams.get('inspect');
    if (inspectName) {
      const match = artists.find(
        (a) => a.name.toLowerCase() === inspectName.toLowerCase(),
      );
      if (match) {
        void openArtistCatalog(match);
      }
    }
  }, [searchParams]);

  const filteredArtists = artists.filter((a) => {
    if (categoryTab === 'international' && a.category !== 'international') return false;
    if (categoryTab === 'indian' && a.category !== 'indian') return false;
    if (categoryTab === 'favourites' && !a.favourite) return false;
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        a.primaryLanguage.toLowerCase().includes(q) ||
        a.genres.some((g) => g.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const onAddArtist = (values: AddArtistFormValues) => {
    const entry: ArtistEntry = {
      id: `artist-${Date.now()}`,
      name: values.name,
      category: values.category,
      primaryLanguage: values.primaryLanguage as MusicLanguage,
      genres: values.genresText
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean),
      favourite: true,
      addedAt: new Date().toISOString(),
    };
    dispatch(addArtist(entry));
    reset();
    setAddOpen(false);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4">Artist Catalogue</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your International &amp; Indian artists/composers and fetch their live releases.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
          Add Artist
        </Button>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
        <Stack direction="row" flexWrap="wrap" gap={1}>
          <Chip label={`All (${artists.length})`} color={categoryTab === 'all' ? 'primary' : 'default'} onClick={() => setCategoryTab('all')} />
          <Chip label="International" color={categoryTab === 'international' ? 'primary' : 'default'} onClick={() => setCategoryTab('international')} />
          <Chip label="Indian & Composers" color={categoryTab === 'indian' ? 'primary' : 'default'} onClick={() => setCategoryTab('indian')} />
          <Chip label="Favourites" color={categoryTab === 'favourites' ? 'primary' : 'default'} onClick={() => setCategoryTab('favourites')} />
        </Stack>

        <TextField
          size="small"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Filter catalogue..."
          sx={{ minWidth: 240 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Stack>

      <Grid2 container spacing={2}>
        {filteredArtists.map((artist) => (
          <Grid2 key={artist.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <ArtistCard
              artist={artist}
              onToggleFavourite={(id) => dispatch(toggleFavouriteArtist(id))}
              onRemove={(id) => dispatch(removeArtist(id))}
              onInspect={(a) => void openArtistCatalog(a)}
            />
          </Grid2>
        ))}
      </Grid2>

      {/* Add Artist Dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Artist to Catalogue</DialogTitle>
        <Box component="form" onSubmit={handleSubmit(onAddArtist)}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Artist / Composer Name"
                  error={Boolean(errors.name)}
                  helperText={errors.name?.message}
                  fullWidth
                />
              )}
            />
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <TextField {...field} select label="Category" fullWidth>
                  <MenuItem value="international">International</MenuItem>
                  <MenuItem value="indian">Indian Artist / Composer</MenuItem>
                </TextField>
              )}
            />
            <Controller
              name="primaryLanguage"
              control={control}
              render={({ field }) => (
                <TextField {...field} select label="Primary Language" fullWidth>
                  <MenuItem value="English">English</MenuItem>
                  <MenuItem value="Malayalam">Malayalam</MenuItem>
                  <MenuItem value="Hindi">Hindi</MenuItem>
                  <MenuItem value="Tamil">Tamil</MenuItem>
                  <MenuItem value="Arabic">Arabic</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </TextField>
              )}
            />
            <Controller
              name="genresText"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Genres (comma-separated)"
                  error={Boolean(errors.genresText)}
                  helperText={errors.genresText?.message}
                  fullWidth
                />
              )}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">
              Add Artist
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Live Artist Releases Dialog */}
      <Dialog
        open={Boolean(inspectedArtist)}
        onClose={() => setInspectedArtist(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6">{inspectedArtist?.name} — Live Catalogue</Typography>
            <Typography variant="caption" color="text.secondary">
              Aggregated from Apple/iTunes, MusicBrainz, Internet Archive &amp; Jamendo
            </Typography>
          </Box>
          <IconButton onClick={() => setInspectedArtist(null)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {artistWarnings.length > 0 && (
            <Alert severity="info">{artistWarnings[0]}</Alert>
          )}

          <Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
              Latest Albums &amp; Releases
            </Typography>
            {artistLoading ? (
              <SkeletonGrid count={4} />
            ) : artistAlbums.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No albums returned for this artist.
              </Typography>
            ) : (
              <Grid2 container spacing={2}>
                {artistAlbums.slice(0, 8).map((album) => (
                  <Grid2 key={album.id} size={{ xs: 12, sm: 6, md: 3 }}>
                    <AlbumCard album={album} onSelect={setSelectedAlbum} />
                  </Grid2>
                ))}
              </Grid2>
            )}
          </Box>

          <Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
              Tracks &amp; Free Download Checks
            </Typography>
            {artistLoading ? (
              <SkeletonTable rows={5} />
            ) : (
              <TrackTable tracks={artistTracks} compact />
            )}
          </Box>
        </DialogContent>
      </Dialog>

      <AlbumDetailsDialog album={selectedAlbum} onClose={() => setSelectedAlbum(null)} />
    </Box>
  );
};
