import React, { useEffect, useRef, useState } from 'react';
import {
  Avatar,
  Box,
  IconButton,
  Paper,
  Slider,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  VolumeUp as VolumeIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../app/store/hooks';
import {
  setVolume,
  stopPlayback,
  togglePlayPause,
} from '../../features/discovery/playerSlice';
import { formatDuration } from '../../utils/formatters';

export const MiniPlayer: React.FC = () => {
  const dispatch = useAppDispatch();
  const { currentTrack, localBlobUrl, isPlaying, volume } = useAppSelector(
    (s) => s.player,
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioSrc = localBlobUrl || currentTrack?.previewUrl || '';

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;
    audio.volume = volume;
    if (isPlaying) {
      void audio.play().catch(() => {
        // Ignore browser autoplay restrictions
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, audioSrc, volume]);

  if (!currentTrack || !audioSrc) return null;

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: { xs: 0, md: 248 },
        right: 0,
        zIndex: 1200,
        px: 2.5,
        py: 1.25,
        borderRadius: 0,
        borderTop: '1px solid rgba(255,255,255,0.12)',
        bgcolor: 'rgba(14, 18, 27, 0.96)',
        backdropFilter: 'blur(14px)',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <audio
        ref={audioRef}
        src={audioSrc}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={() => dispatch(togglePlayPause())}
      />

      <Avatar
        src={currentTrack.artworkUrl}
        variant="rounded"
        sx={{ width: 46, height: 46 }}
      >
        {currentTrack.title.slice(0, 1)}
      </Avatar>

      <Box sx={{ minWidth: 140, maxWidth: 240 }}>
        <Typography variant="subtitle2" noWrap>
          {currentTrack.title}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap display="block">
          {currentTrack.artist} • {localBlobUrl ? 'Local MP3' : 'Preview Stream'}
        </Typography>
      </Box>

      <IconButton
        color="primary"
        onClick={() => dispatch(togglePlayPause())}
        aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </IconButton>

      <Box sx={{ flex: 1, display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 36 }}>
          {formatDuration(currentTime)}
        </Typography>
        <Slider
          size="small"
          value={currentTime}
          max={duration || 30}
          onChange={(_, val) => {
            const next = Array.isArray(val) ? val[0] : val;
            if (audioRef.current) audioRef.current.currentTime = next;
            setCurrentTime(next);
          }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 36 }}>
          {formatDuration(duration)}
        </Typography>
      </Box>

      <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', width: 120, gap: 1 }}>
        <VolumeIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        <Slider
          size="small"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(_, val) =>
            dispatch(setVolume(Array.isArray(val) ? val[0] : val))
          }
        />
      </Box>

      <IconButton
        size="small"
        onClick={() => dispatch(stopPlayback())}
        aria-label="Close player"
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Paper>
  );
};
