import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Track } from '../../types/music';

interface PlayerState {
  currentTrack: Track | null;
  localBlobUrl: string | null;
  isPlaying: boolean;
  volume: number;
}

const initialState: PlayerState = {
  currentTrack: null,
  localBlobUrl: null,
  isPlaying: false,
  volume: 0.7,
};

const playerSlice = createSlice({
  name: 'player',
  initialState,
  reducers: {
    playTrackPreview(
      state,
      action: PayloadAction<{ track: Track; localBlobUrl?: string | null }>,
    ) {
      state.currentTrack = action.payload.track;
      state.localBlobUrl = action.payload.localBlobUrl ?? null;
      state.isPlaying = true;
    },
    togglePlayPause(state) {
      if (state.currentTrack) {
        state.isPlaying = !state.isPlaying;
      }
    },
    stopPlayback(state) {
      state.isPlaying = false;
      state.currentTrack = null;
      state.localBlobUrl = null;
    },
    setVolume(state, action: PayloadAction<number>) {
      state.volume = Math.min(1, Math.max(0, action.payload));
    },
  },
});

export const { playTrackPreview, togglePlayPause, stopPlayback, setVolume } =
  playerSlice.actions;

export default playerSlice.reducer;
