import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AppSettings, MusicLanguage, ProviderCredentials } from '../../types/music';
import { DEFAULT_SETTINGS } from '../../utils/seedData';

const STORAGE_KEY = 'sg_saas_settings_v2';

function loadInitialSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      credentials: {
        ...DEFAULT_SETTINGS.credentials,
        ...(parsed.credentials ?? {}),
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function persistSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage quota errors
  }
}

const initialState: AppSettings = loadInitialSettings();

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    updateSettings(state, action: PayloadAction<Partial<AppSettings>>) {
      const next: AppSettings = {
        ...state,
        ...action.payload,
        credentials: {
          ...state.credentials,
          ...(action.payload.credentials ?? {}),
        },
      };
      persistSettings(next);
      return next;
    },
    updateCredentials(state, action: PayloadAction<Partial<ProviderCredentials>>) {
      state.credentials = { ...state.credentials, ...action.payload };
      persistSettings(state);
    },
    setPreferredLanguages(state, action: PayloadAction<MusicLanguage[]>) {
      state.preferredLanguages = action.payload;
      persistSettings(state);
    },
    resetSettings() {
      persistSettings(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    },
  },
});

export const {
  updateSettings,
  updateCredentials,
  setPreferredLanguages,
  resetSettings,
} = settingsSlice.actions;

export default settingsSlice.reducer;
