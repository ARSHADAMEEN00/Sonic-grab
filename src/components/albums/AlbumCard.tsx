import React from 'react';
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  IconButton,
  Typography,
} from '@mui/material';
import {
  Album as AlbumPlaceholderIcon,
  Favorite as FavIcon,
  FavoriteBorder as FavBorderIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAppDispatch, useAppSelector } from '../../app/store/hooks';
import { toggleFavouriteAlbum } from '../../features/library/librarySlice';
import type { Album } from '../../types/music';
import { AvailabilityBadge } from '../music/AvailabilityBadge';

interface AlbumCardProps {
  album: Album;
  onSelect: (album: Album) => void;
}

export const AlbumCard: React.FC<AlbumCardProps> = ({ album, onSelect }) => {
  const dispatch = useAppDispatch();
  const showArtwork = useAppSelector((s) => s.settings.showArtwork);
  const isFav = useAppSelector((s) => s.library.favouriteAlbumIds.includes(album.id));

  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.18 }}>
      <Card
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            dispatch(toggleFavouriteAlbum(album));
          }}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 2,
            bgcolor: 'rgba(11,14,20,0.72)',
            '&:hover': { bgcolor: 'rgba(11,14,20,0.92)' },
          }}
          color={isFav ? 'error' : 'default'}
        >
          {isFav ? <FavIcon fontSize="small" /> : <FavBorderIcon fontSize="small" />}
        </IconButton>

        <CardActionArea
          onClick={() => onSelect(album)}
          sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
        >
          {showArtwork && album.artworkUrl ? (
            <CardMedia
              component="img"
              height="180"
              image={album.artworkUrl}
              alt={album.title}
              loading="lazy"
              sx={{ objectFit: 'cover', bgcolor: '#1B2232' }}
            />
          ) : (
            <Box
              sx={{
                height: 180,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #161D2C 0%, #242042 100%)',
              }}
            >
              <AlbumPlaceholderIcon sx={{ fontSize: 56, color: 'text.secondary', opacity: 0.5 }} />
            </Box>
          )}

          <CardContent sx={{ flex: 1, width: '100%' }}>
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              {album.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap sx={{ mb: 1 }}>
              {album.artist}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
              <AvailabilityBadge availability={album.availability} />
              {album.releaseDate && (
                <Typography variant="caption" color="text.secondary">
                  {album.releaseDate.slice(0, 4)}
                </Typography>
              )}
            </Box>
          </CardContent>
        </CardActionArea>
      </Card>
    </motion.div>
  );
};
