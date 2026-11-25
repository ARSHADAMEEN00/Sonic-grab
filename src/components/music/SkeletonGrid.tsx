import React from 'react';
import { Box, Grid2, Skeleton } from '@mui/material';

export const SkeletonGrid: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <Grid2 container spacing={2}>
    {Array.from({ length: count }).map((_, idx) => (
      <Grid2 key={idx} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
        <Box>
          <Skeleton variant="rounded" height={180} sx={{ mb: 1 }} />
          <Skeleton variant="text" width="75%" />
          <Skeleton variant="text" width="50%" />
        </Box>
      </Grid2>
    ))}
  </Grid2>
);

export const SkeletonTable: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
    {Array.from({ length: rows }).map((_, idx) => (
      <Skeleton key={idx} variant="rounded" height={54} />
    ))}
  </Box>
);
