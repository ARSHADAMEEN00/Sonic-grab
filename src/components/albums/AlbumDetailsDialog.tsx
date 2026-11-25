import React, { useEffect, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Skeleton,
  Typography,
} from '@mui/material';
import { Close as CloseIcon, OpenInNew as ExternalIcon } from '@mui/icons-material';
import { useAppSelector } from '../../app/store/hooks';
import { fetchAlbumTracklist } from '../../services/providers/providerRegistry';
import type { Album, Track } from '../../types/music';
import { formatReleaseDate } from '../../utils/formatters';
import { AvailabilityBadge } from '../music/AvailabilityBadge';
import { TrackTable } from '../music/TrackTable';

interface AlbumDetailsDialogProps {
  album: Album | null;
  onClose: () => void;
}

export const AlbumDetailsDialog: React.FC<AlbumDetailsDialogProps> = ({
  album,
  onClose,
}) => {
  const credentials = useAppSelector((s) => s.settings.credentials);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!album) {
      setTracks([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchAlbumTracklist(album, credentials)
      .then((res) => {
        if (!cancelled) setTracks(res);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [album, credentials]);

  if (!album) return null;

  return (
    <Dialog open={Boolean(album)} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" noWrap>
          {album.title}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5, mb: 3, alignItems: 'center' }}>
          <Avatar
            src={album.artworkUrl}
            variant="rounded"
            sx={{ width: 112, height: 112, bgcolor: '#1B2232' }}
          >
            {album.title.slice(0, 1)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 220 }}>
            <Typography variant="h5">{album.title}</Typography>
            <Typography variant="subtitle1" color="text.secondary" gutterBottom>
              {album.artist}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 1.5 }}>
              <AvailabilityBadge availability={album.availability} />
              {album.releaseDate && (
                <Typography variant="caption" color="text.secondary">
                  Released: {formatReleaseDate(album.releaseDate)}
                </Typography>
              )}
              {album.trackCount && (
                <Typography variant="caption" color="text.secondary">
                  • {album.trackCount} tracks
                </Typography>
              )}
            </Box>
            <Button
              size="small"
              variant="outlined"
              endIcon={<ExternalIcon fontSize="small" />}
              href={album.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on {album.provider}
            </Button>
          </Box>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Skeleton variant="rounded" height={44} />
            <Skeleton variant="rounded" height={44} />
            <Skeleton variant="rounded" height={44} />
          </Box>
        ) : (
          <TrackTable
            tracks={tracks}
            compact
            emptyMessage="No tracklist metadata returned for this release."
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
