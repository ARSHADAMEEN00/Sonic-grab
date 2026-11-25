import { configureStore } from '@reduxjs/toolkit';
import settingsReducer from '../../features/settings/settingsSlice';
import libraryReducer from '../../features/library/librarySlice';
import downloadsReducer from '../../features/downloads/downloadsSlice';
import playerReducer from '../../features/discovery/playerSlice';

export const store = configureStore({
  reducer: {
    settings: settingsReducer,
    library: libraryReducer,
    downloads: downloadsReducer,
    player: playerReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
