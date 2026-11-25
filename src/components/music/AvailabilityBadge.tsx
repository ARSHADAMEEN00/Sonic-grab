import React from 'react';
import { Chip } from '@mui/material';
import {
  CheckCircle as FreeIcon,
  HelpOutline as UnverifiedIcon,
  Lock as StreamIcon,
  ShoppingBag as PaidIcon,
} from '@mui/icons-material';
import type { DownloadAvailability } from '../../types/music';

export const AvailabilityBadge: React.FC<{
  availability: DownloadAvailability;
  compact?: boolean;
}> = ({ availability, compact = false }) => {
  switch (availability) {
    case 'FREE DOWNLOAD AVAILABLE':
      return (
        <Chip
          icon={<FreeIcon />}
          label={compact ? 'FREE MP3' : 'FREE DOWNLOAD AVAILABLE'}
          size="small"
          sx={{
            bgcolor: 'rgba(0, 229, 163, 0.14)',
            color: '#00E5A3',
            border: '1px solid rgba(0, 229, 163, 0.35)',
            fontSize: 11,
          }}
        />
      );
    case 'PAID DOWNLOAD AVAILABLE':
      return (
        <Chip
          icon={<PaidIcon />}
          label={compact ? 'PAID' : 'PAID DOWNLOAD AVAILABLE'}
          size="small"
          sx={{
            bgcolor: 'rgba(255, 193, 7, 0.12)',
            color: '#FFD54F',
            border: '1px solid rgba(255, 193, 7, 0.3)',
            fontSize: 11,
          }}
        />
      );
    case 'STREAMING ONLY':
      return (
        <Chip
          icon={<StreamIcon />}
          label={compact ? 'STREAM ONLY' : 'STREAMING ONLY'}
          size="small"
          sx={{
            bgcolor: 'rgba(124, 77, 255, 0.14)',
            color: '#B39DDB',
            border: '1px solid rgba(124, 77, 255, 0.35)',
            fontSize: 11,
          }}
        />
      );
    default:
      return (
        <Chip
          icon={<UnverifiedIcon />}
          label={compact ? 'UNVERIFIED' : 'DOWNLOAD NOT VERIFIED'}
          size="small"
          sx={{
            bgcolor: 'rgba(154, 164, 184, 0.12)',
            color: '#9AA4B8',
            border: '1px solid rgba(154, 164, 184, 0.25)',
            fontSize: 11,
          }}
        />
      );
  }
};
