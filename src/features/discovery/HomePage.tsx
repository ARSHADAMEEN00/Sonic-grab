import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid2,
  Stack,
  Typography,
} from '@mui/material';
import {
  ArrowForward as ArrowIcon,
  DownloadDone as HistoryIcon,
  Key as KeyIcon,
  MusicNote as FreeIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/store/hooks';
import { AlbumCard } from '../../components/albums/AlbumCard';
import { AlbumDetailsDialog } from '../../components/albums/AlbumDetailsDialog';
import { SkeletonGrid, SkeletonTable } from '../../components/music/SkeletonGrid';
import { TrackTable } from '../../components/music/TrackTable';
import { cacheTracks } from '../library/librarySlice';
import { appleMusicProvider } from '../../services/providers/apple-music/appleMusicProvider';
import { internetArchiveProvider } from '../../services/providers/internet-archive/internetArchiveProvider';
import { jamendoProvider } from '../../services/providers/jamendo/jamendoProvider';
import type { Album, Track } from '../../types/music';
import { formatBytes } from '../../utils/formatters';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const credentials = useAppSelector((s) => s.settings.credentials);
  const artists = useAppSelector((s) => s.library.artists);
  const downloadHistory = useAppSelector((s) => s.library.downloadHistory);

  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [globalTracks, setGlobalTracks] = useState<Track[]>([]);
  const [indiaTracks, setIndiaTracks] = useState<Track[]>([]);
  const [intlAlbums, setIntlAlbums] = useState<Album[]>([]);
  const [indiaAlbums, setIndiaAlbums] = useState<Album[]>([]);
  const [freeTracks, setFreeTracks] = useState<Track[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    const nextWarnings: string[] = [];

    const [globalRes, indiaRes, iaRes, jamendoRes] = await Promise.all([
      appleMusicProvider.getTrending('global', credentials),
      appleMusicProvider.getTrending('india', credentials),
      internetArchiveProvider.getPopularFreeAudio(6),
      jamendoProvider.isConfigured(credentials)
        ? jamendoProvider.getPopularFreeDownloads(credentials, 6)
        : Promise.resolve({
            provider: 'jamendo' as const,
            tracks: [] as Track[],
            albums: [] as Album[],
            warning: undefined as string | undefined,
          }),
    ]);

    if (globalRes.warning) nextWarnings.push(globalRes.warning);
    if (indiaRes.warning) nextWarnings.push(indiaRes.warning);
    if (iaRes.warning) nextWarnings.push(iaRes.warning);
    if (jamendoRes.warning) nextWarnings.push(jamendoRes.warning);

    setGlobalTracks(globalRes.tracks.slice(0, 6));
    setIndiaTracks(indiaRes.tracks.slice(0, 6));
    setIntlAlbums(globalRes.albums.slice(0, 4));
    setIndiaAlbums(indiaRes.albums.slice(0, 4));
    const combinedFree = [...jamendoRes.tracks, ...iaRes.tracks].slice(0, 8);
    setFreeTracks(combinedFree);
    setWarnings(nextWarnings);
    dispatch(cacheTracks([...globalRes.tracks, ...indiaRes.tracks, ...combinedFree]));
    setLoading(false);
  };

  useEffect(() => {
    void loadDashboard();
  }, [credentials.jamendoClientId, credentials.appleMusicDeveloperToken]);

  const recommendedArtists = artists.filter((a) => a.favourite).slice(0, 8);
  const newestSongs = [...globalTracks, ...indiaTracks]
    .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''))
    .slice(0, 6);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Hero Banner */}
      <Card
        sx={{
          background:
            'linear-gradient(120deg, rgba(0,229,163,0.16) 0%, rgba(124,77,255,0.18) 55%, rgba(19,24,35,0.95) 100%)',
          border: '1px solid rgba(0, 229, 163, 0.25)',
        }}
      >
        <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
            gap={2}
          >
            <Box>
              <Chip
                label="BRING YOUR OWN TOKENS • LEGAL MUSIC DISCOVERY & MP3 SAAS"
                size="small"
                color="primary"
                sx={{ mb: 1.25, fontSize: 11 }}
              />
              <Typography variant="h4" gutterBottom>
                SONIC GRAB
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 680 }}>
                Discover live global &amp; Indian charts, browse verified Creative Commons &amp; Public
                Domain MP3s, and manage your personal playlists directly in your browser using your own API tokens.
              </Typography>
            </Box>

            <Stack direction="row" flexWrap="wrap" gap={1.25}>
              <Button
                variant="contained"
                startIcon={<FreeIcon />}
                onClick={() => navigate('/free-music')}
              >
                Discover Free MP3s
              </Button>
              <Button
                variant="outlined"
                startIcon={<KeyIcon />}
                onClick={() => navigate('/settings')}
              >
                Configure Tokens
              </Button>
              <Button
                variant="text"
                startIcon={<RefreshIcon />}
                onClick={() => void loadDashboard()}
              >
                Refresh
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {warnings.length > 0 && (
        <Alert severity="info" variant="outlined">
          {warnings[0]}
        </Alert>
      )}

      {!jamendoProvider.isConfigured(credentials) && (
        <Alert
          severity="warning"
          variant="outlined"
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/settings')}>
              Add My Token
            </Button>
          }
        >
          Your Jamendo Client ID is not set yet. Internet Archive free CC/Public Domain MP3s work out of the box; add your own free Jamendo Client ID in Settings to unlock Jamendo CC-licensed MP3s too.
        </Alert>
      )}

      {/* Free MP3 Downloads */}
      <Box>
        <SectionHeader
          title="Free MP3 Downloads (Authorised)"
          subtitle="Verified Creative Commons / Public Domain tracks"
          onMore={() => navigate('/free-music')}
        />
        {loading ? (
          <SkeletonTable rows={4} />
        ) : (
          <TrackTable
            tracks={freeTracks}
            compact
            emptyMessage="No free downloadable tracks loaded yet. Try Discover Free Music."
          />
        )}
      </Box>

      {/* Trending Worldwide & India */}
      <Grid2 container spacing={3}>
        <Grid2 size={{ xs: 12, xl: 6 }}>
          <SectionHeader
            title="Trending Worldwide"
            subtitle="Live global discovery metadata (Streaming Only)"
            onMore={() => navigate('/trending')}
          />
          {loading ? <SkeletonTable rows={5} /> : <TrackTable tracks={globalTracks} compact showBatchActions={false} />}
        </Grid2>
        <Grid2 size={{ xs: 12, xl: 6 }}>
          <SectionHeader
            title="Trending India"
            subtitle="Live Indian discovery metadata (Streaming Only)"
            onMore={() => navigate('/trending')}
          />
          {loading ? <SkeletonTable rows={5} /> : <TrackTable tracks={indiaTracks} compact showBatchActions={false} />}
        </Grid2>
      </Grid2>

      {/* Latest International Albums */}
      <Box>
        <SectionHeader
          title="Latest International Albums"
          onMore={() => navigate('/albums')}
        />
        {loading ? (
          <SkeletonGrid count={4} />
        ) : (
          <Grid2 container spacing={2}>
            {intlAlbums.map((album) => (
              <Grid2 key={album.id} size={{ xs: 12, sm: 6, md: 3 }}>
                <AlbumCard album={album} onSelect={setSelectedAlbum} />
              </Grid2>
            ))}
          </Grid2>
        )}
      </Box>

      {/* Latest Indian Albums */}
      <Box>
        <SectionHeader
          title="Latest Indian Albums"
          onMore={() => navigate('/albums')}
        />
        {loading ? (
          <SkeletonGrid count={4} />
        ) : (
          <Grid2 container spacing={2}>
            {indiaAlbums.map((album) => (
              <Grid2 key={album.id} size={{ xs: 12, sm: 6, md: 3 }}>
                <AlbumCard album={album} onSelect={setSelectedAlbum} />
              </Grid2>
            ))}
          </Grid2>
        )}
      </Box>

      {/* Recommended Artists */}
      <Box>
        <SectionHeader
          title="Recommended Artists"
          subtitle="From your International & Indian favourite artist catalogue"
          onMore={() => navigate('/artists')}
        />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {recommendedArtists.map((artist) => (
            <Chip
              key={artist.id}
              label={`${artist.name} (${artist.primaryLanguage})`}
              onClick={() => navigate(`/artists?inspect=${encodeURIComponent(artist.name)}`)}
              variant="outlined"
              clickable
              sx={{ py: 2, px: 0.75 }}
            />
          ))}
        </Box>
      </Box>

      {/* Newly Released Songs */}
      <Box>
        <SectionHeader
          title="Newly Released Songs"
          onMore={() => navigate('/releases')}
        />
        {loading ? <SkeletonTable rows={4} /> : <TrackTable tracks={newestSongs} compact showBatchActions={false} />}
      </Box>

      {/* Download History */}
      <Box>
        <SectionHeader
          title="Recent Download History"
          onMore={() => navigate('/downloads')}
        />
        {downloadHistory.length === 0 ? (
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <HistoryIcon color="action" />
              <Typography variant="body2" color="text.secondary">
                No MP3 downloads recorded yet. Visit Discover Free Music to download authorised CC tracks.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Grid2 container spacing={2}>
            {downloadHistory.slice(0, 4).map((item) => (
              <Grid2 key={item.id} size={{ xs: 12, sm: 6, md: 3 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" noWrap>
                      {item.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                      {item.artist} • {item.language}
                    </Typography>
                    <Typography variant="caption" color="primary.main" display="block" sx={{ mt: 0.75 }}>
                      {item.licence} • {formatBytes(item.fileSizeBytes)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid2>
            ))}
          </Grid2>
        )}
      </Box>

      <AlbumDetailsDialog album={selectedAlbum} onClose={() => setSelectedAlbum(null)} />
    </Box>
  );
};

const SectionHeader: React.FC<{
  title: string;
  subtitle?: string;
  onMore?: () => void;
}> = ({ title, subtitle, onMore }) => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      mb: 1.5,
      gap: 1,
    }}
  >
    <Box>
      <Typography variant="h6">{title}</Typography>
      {subtitle && (
        <Typography variant="caption" color="text.secondary">
          {subtitle}
        </Typography>
      )}
    </Box>
    {onMore && (
      <Button size="small" endIcon={<ArrowIcon fontSize="small" />} onClick={onMore}>
        See all
      </Button>
    )}
  </Box>
);
