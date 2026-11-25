import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  DeleteOutline as DeleteIcon,
  Favorite as FavIcon,
  FavoriteBorder as FavBorderIcon,
  NewReleases as ReleasesIcon,
} from '@mui/icons-material';
import type { ArtistEntry } from '../../types/music';

interface ArtistCardProps {
  artist: ArtistEntry;
  onToggleFavourite: (id: string) => void;
  onRemove: (id: string) => void;
  onInspect: (artist: ArtistEntry) => void;
}

export const ArtistCard: React.FC<ArtistCardProps> = ({
  artist,
  onToggleFavourite,
  onRemove,
  onInspect,
}) => (
  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
    <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700} noWrap>
            {artist.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {artist.category === 'indian' ? 'Indian Artist / Composer' : 'International'} •{' '}
            {artist.primaryLanguage}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexShrink: 0 }}>
          <Tooltip title={artist.favourite ? 'Unfavourite' : 'Favourite'}>
            <IconButton
              size="small"
              color={artist.favourite ? 'error' : 'default'}
              onClick={() => onToggleFavourite(artist.id)}
            >
              {artist.favourite ? <FavIcon fontSize="small" /> : <FavBorderIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Remove artist">
            <IconButton size="small" onClick={() => onRemove(artist.id)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {artist.genres.slice(0, 3).map((g) => (
          <Chip key={g} label={g} size="small" variant="outlined" sx={{ fontSize: 11 }} />
        ))}
      </Box>

      <Box sx={{ mt: 'auto', pt: 1 }}>
        <Button
          fullWidth
          size="small"
          variant="outlined"
          startIcon={<ReleasesIcon fontSize="small" />}
          onClick={() => onInspect(artist)}
        >
          Latest Releases &amp; Tracks
        </Button>
      </Box>
    </CardContent>
  </Card>
);
