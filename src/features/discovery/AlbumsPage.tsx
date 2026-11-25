import React, { useEffect, useState } from 'react';
import {
  Box,
  Chip,
  Grid2,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { useAppSelector } from '../../app/store/hooks';
import { AlbumCard } from '../../components/albums/AlbumCard';
import { AlbumDetailsDialog } from '../../components/albums/AlbumDetailsDialog';
import { SkeletonGrid } from '../../components/music/SkeletonGrid';
import { useDebounce } from '../../hooks/useDebounce';
import { runUnifiedSearch } from '../../services/providers/providerRegistry';
import { appleMusicProvider } from '../../services/providers/apple-music/appleMusicProvider';
import type { Album } from '../../types/music';

export const AlbumsPage: React.FC = () => {
  const credentials = useAppSelector((s) => s.settings.credentials);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 400);
  const [filterMode, setFilterMode] = useState<'all' | 'global' | 'india' | 'free'>('all');
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadAlbums = async () => {
      setLoading(true);
      if (debouncedQuery.trim()) {
        const res = await runUnifiedSearch(
          { query: debouncedQuery.trim(), type: 'album', credentials },
          ['apple-music', 'musicbrainz', 'jamendo', 'internet-archive'],
        );
        if (!cancelled) setAlbums(res.albums);
      } else {
        const [g, i] = await Promise.all([
          appleMusicProvider.getTrending('global', credentials),
          appleMusicProvider.getTrending('india', credentials),
        ]);
        if (!cancelled) setAlbums([...g.albums, ...i.albums]);
      }
      if (!cancelled) setLoading(false);
    };
    void loadAlbums();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, credentials]);

  const visibleAlbums = albums.filter((a) => {
    if (filterMode === 'global') return a.region !== 'india';
    if (filterMode === 'india') return a.region === 'india';
    if (filterMode === 'free') return a.availability === 'FREE DOWNLOAD AVAILABLE';
    return true;
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h4">Albums</Typography>
        <Typography variant="body2" color="text.secondary">
          Explore trending and searched albums. Click any album card to inspect its live tracklist.
        </Typography>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} justifyContent="space-between" alignItems={{ sm: 'center' }}>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          <Chip label="All Albums" color={filterMode === 'all' ? 'primary' : 'default'} onClick={() => setFilterMode('all')} />
          <Chip label="International" color={filterMode === 'global' ? 'primary' : 'default'} onClick={() => setFilterMode('global')} />
          <Chip label="India" color={filterMode === 'india' ? 'primary' : 'default'} onClick={() => setFilterMode('india')} />
          <Chip label="Free Downloadable" color={filterMode === 'free' ? 'primary' : 'default'} onClick={() => setFilterMode('free')} />
        </Stack>

        <TextField
          size="small"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search albums across providers..."
          sx={{ minWidth: 260 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Stack>

      {loading ? (
        <SkeletonGrid count={8} />
      ) : (
        <Grid2 container spacing={2}>
          {visibleAlbums.map((album) => (
            <Grid2 key={album.id} size={{ xs: 12, sm: 6, md: 3 }}>
              <AlbumCard album={album} onSelect={setSelectedAlbum} />
            </Grid2>
          ))}
        </Grid2>
      )}

      <AlbumDetailsDialog album={selectedAlbum} onClose={() => setSelectedAlbum(null)} />
    </Box>
  );
};
