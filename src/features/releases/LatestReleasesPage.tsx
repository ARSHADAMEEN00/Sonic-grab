import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  Grid2,
  Stack,
  Typography,
} from '@mui/material';
import { useAppDispatch, useAppSelector } from '../../app/store/hooks';
import { AlbumCard } from '../../components/albums/AlbumCard';
import { AlbumDetailsDialog } from '../../components/albums/AlbumDetailsDialog';
import { SkeletonGrid, SkeletonTable } from '../../components/music/SkeletonGrid';
import { TrackTable } from '../../components/music/TrackTable';
import { cacheTracks } from '../library/librarySlice';
import { appleMusicProvider } from '../../services/providers/apple-music/appleMusicProvider';
import type { Album, Track } from '../../types/music';

export const LatestReleasesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const artists = useAppSelector((s) => s.library.artists);
  const [scope, setScope] = useState<'all' | 'international' | 'indian'>('all');
  const [albums, setAlbums] = useState<Album[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadReleases = async () => {
      setLoading(true);
      setError(null);
      const pool = artists
        .filter((a) => (scope === 'all' ? true : a.category === scope))
        .filter((a) => a.favourite)
        .slice(0, 5);
      const fallbackPool =
        pool.length > 0
          ? pool
          : artists.filter((a) => (scope === 'all' ? true : a.category === scope)).slice(0, 4);

      try {
        const results = await Promise.all(
          fallbackPool.map((artist) =>
            appleMusicProvider.getArtistReleases(artist.name, artist.primaryLanguage),
          ),
        );
        if (cancelled) return;
        const allAlbums = results
          .flatMap((r) => r.albums)
          .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''))
          .slice(0, 16);
        const allTracks = results
          .flatMap((r) => r.tracks)
          .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''))
          .slice(0, 20);

        setAlbums(allAlbums);
        setTracks(allTracks);
        dispatch(cacheTracks(allTracks));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to fetch releases');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadReleases();
    return () => {
      cancelled = true;
    };
  }, [scope, artists, dispatch]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h4">Latest Releases</Typography>
        <Typography variant="body2" color="text.secondary">
          Live new releases fetched from your favourite International and Indian artists.
        </Typography>
      </Box>

      <Stack direction="row" spacing={1}>
        <Chip
          label="All Favourite Artists"
          color={scope === 'all' ? 'primary' : 'default'}
          onClick={() => setScope('all')}
        />
        <Chip
          label="International"
          color={scope === 'international' ? 'primary' : 'default'}
          onClick={() => setScope('international')}
        />
        <Chip
          label="Indian & Composers"
          color={scope === 'indian' ? 'primary' : 'default'}
          onClick={() => setScope('indian')}
        />
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Box>
        <Typography variant="h6" sx={{ mb: 1.5 }}>
          Latest Albums &amp; EPs
        </Typography>
        {loading ? (
          <SkeletonGrid count={8} />
        ) : (
          <Grid2 container spacing={2}>
            {albums.map((album) => (
              <Grid2 key={album.id} size={{ xs: 12, sm: 6, md: 3 }}>
                <AlbumCard album={album} onSelect={setSelectedAlbum} />
              </Grid2>
            ))}
          </Grid2>
        )}
      </Box>

      <Box>
        <Typography variant="h6" sx={{ mb: 1.5 }}>
          Recent Singles &amp; Tracks
        </Typography>
        {loading ? <SkeletonTable rows={6} /> : <TrackTable tracks={tracks} />}
      </Box>

      <AlbumDetailsDialog album={selectedAlbum} onClose={() => setSelectedAlbum(null)} />
    </Box>
  );
};
