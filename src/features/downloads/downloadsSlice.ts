import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { DownloadQueueItem, DownloadStatus } from '../../types/music';

interface DownloadsState {
  queue: DownloadQueueItem[];
}

const initialState: DownloadsState = {
  queue: [],
};

const downloadsSlice = createSlice({
  name: 'downloads',
  initialState,
  reducers: {
    enqueueDownloadItem(state, action: PayloadAction<DownloadQueueItem>) {
      const existing = state.queue.find(
        (item) =>
          item.track.id === action.payload.track.id &&
          (item.status === 'queued' ||
            item.status === 'downloading' ||
            item.status === 'validating'),
      );
      if (!existing) {
        state.queue.push(action.payload);
      }
    },
    updateDownloadItem(
      state,
      action: PayloadAction<{
        id: string;
        patch: Partial<DownloadQueueItem>;
      }>,
    ) {
      const item = state.queue.find((q) => q.id === action.payload.id);
      if (item) {
        Object.assign(item, action.payload.patch);
      }
    },
    setDownloadStatus(
      state,
      action: PayloadAction<{ id: string; status: DownloadStatus; errorMessage?: string }>,
    ) {
      const item = state.queue.find((q) => q.id === action.payload.id);
      if (item) {
        item.status = action.payload.status;
        item.errorMessage = action.payload.errorMessage;
      }
    },
    removeDownloadQueueItem(state, action: PayloadAction<string>) {
      state.queue = state.queue.filter((q) => q.id !== action.payload);
    },
    clearFinishedDownloads(state) {
      state.queue = state.queue.filter(
        (q) =>
          q.status === 'queued' ||
          q.status === 'downloading' ||
          q.status === 'validating',
      );
    },
  },
});

export const {
  enqueueDownloadItem,
  updateDownloadItem,
  setDownloadStatus,
  removeDownloadQueueItem,
  clearFinishedDownloads,
} = downloadsSlice.actions;

export default downloadsSlice.reducer;
