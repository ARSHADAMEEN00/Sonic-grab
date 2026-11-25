import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Grid2,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../app/store/hooks';
import { AlbumCard } from '../../components/albums/AlbumCard';
import { AlbumDetailsDialog } from '../../components/albums/AlbumDetailsDialog';
import { SkeletonGrid, SkeletonTable } from '../../components/music/SkeletonGrid';
import { TrackTable } from '../../components/music/TrackTable';
import { cacheTracks } from '../library/librarySlice';
import { appleMusicProvider } from '../../services/providers/apple-music/appleMusicProvider';
import type { Album, Track } from '../../types/music';

export const TrendingPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const credentials = useAppSelector((s) => s.settings.credentials);
  const [regionTab, setRegionTab] = useState<'global' | 'india'>('global');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [warning, setWarning] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

  const fetchCharts = async (region: 'global' | 'india') => {
    setLoading(true);
    const res = await appleMusicProvider.getTrending(region, credentials);
    setTracks(res.tracks);
    setAlbums(res.albums);
    setWarning(res.warning);
    dispatch(cacheTracks(res.tracks));
    setLoading(false);
  };

  useEffect(() => {
    void fetchCharts(regionTab);
  }, [regionTab, credentials.appleMusicDeveloperToken]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4">Trending Charts</Typography>
          <Typography variant="body2" color="text.secondary">
            Live discovery across Worldwide and India catalogues. Streaming metadata is strictly separated from MP3 downloads.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => void fetchCharts(regionTab)}
        >
          Refresh Live Charts
        </Button>
      </Box>

      <Tabs value={regionTab} onChange={(_, v) => setRegionTab(v as 'global' | 'india')}>
        <Tab label="Worldwide Charts" value="global" />
        <Tab label="India Charts" value="india" />
      </Tabs>

      {warning && <Alert severity="info">{warning}</Alert>}

      <Box>
        <Typography variant="h6" sx={{ mb: 1.5 }}>
          Trending Songs ({regionTab === 'global' ? 'Worldwide' : 'India'})
        </Typography>
        {loading ? <SkeletonTable rows={8} /> : <TrackTable tracks={tracks} />}
      </Box>

      <Box>
        <Typography variant="h6" sx={{ mb: 1.5 }}>
          Trending Albums
        </Typography>
        {loading ? (
          <SkeletonGrid count={4} />
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

      <AlbumDetailsDialog album={selectedAlbum} onClose={() => setSelectedAlbum(null)} />
    </Box>
  );
};
