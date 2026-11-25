import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  Album,
  ArtistEntry,
  DownloadHistoryItem,
  Playlist,
  Track,
} from '../../types/music';
import { loadLibraryState, saveLibraryState } from '../../utils/indexedDb';
import { DEFAULT_PLAYLIST, SEEDED_ARTISTS } from '../../utils/seedData';

export interface LibraryState {
  hydrated: boolean;
  artists: ArtistEntry[];
  tracksById: Record<string, Track>;
  favouriteTrackIds: string[];
  favouriteAlbumIds: string[];
  albumsById: Record<string, Album>;
  playlists: Playlist[];
  downloadHistory: DownloadHistoryItem[];
}

const STORAGE_KEY = 'library_v1';

const initialState: LibraryState = {
  hydrated: false,
  artists: SEEDED_ARTISTS,
  tracksById: {},
  favouriteTrackIds: [],
  favouriteAlbumIds: [],
  albumsById: {},
  playlists: [DEFAULT_PLAYLIST],
  downloadHistory: [],
};

function persistLibrarySnapshot(state: LibraryState): void {
  const snapshot: LibraryState = {
    ...state,
    hydrated: true,
  };
  void saveLibraryState(STORAGE_KEY, snapshot).catch(() => {
    // Fallback mirror in localStorage for lightweight resilience
    try {
      localStorage.setItem(`sg_${STORAGE_KEY}`, JSON.stringify(snapshot));
    } catch {
      // ignore
    }
  });
}

export const hydrateLibrary = createAsyncThunk('library/hydrate', async () => {
  try {
    const stored = await loadLibraryState<LibraryState>(STORAGE_KEY);
    if (stored) return stored;
  } catch {
    // ignore and try localStorage
  }
  try {
    const raw = localStorage.getItem(`sg_${STORAGE_KEY}`);
    if (raw) return JSON.parse(raw) as LibraryState;
  } catch {
    // ignore
  }
  return null;
});

const librarySlice = createSlice({
  name: 'library',
  initialState,
  reducers: {
    addArtist(state, action: PayloadAction<ArtistEntry>) {
      const exists = state.artists.some(
        (a) => a.name.toLowerCase() === action.payload.name.toLowerCase(),
      );
      if (!exists) {
        state.artists.unshift(action.payload);
        persistLibrarySnapshot(state);
      }
    },
    removeArtist(state, action: PayloadAction<string>) {
      state.artists = state.artists.filter((a) => a.id !== action.payload);
      persistLibrarySnapshot(state);
    },
    toggleFavouriteArtist(state, action: PayloadAction<string>) {
      const target = state.artists.find((a) => a.id === action.payload);
      if (target) {
        target.favourite = !target.favourite;
        persistLibrarySnapshot(state);
      }
    },
    cacheTracks(state, action: PayloadAction<Track[]>) {
      for (const track of action.payload) {
        state.tracksById[track.id] = track;
      }
      persistLibrarySnapshot(state);
    },
    toggleFavouriteTrack(state, action: PayloadAction<Track>) {
      const track = action.payload;
      state.tracksById[track.id] = track;
      const idx = state.favouriteTrackIds.indexOf(track.id);
      if (idx >= 0) {
        state.favouriteTrackIds.splice(idx, 1);
      } else {
        state.favouriteTrackIds.unshift(track.id);
      }
      persistLibrarySnapshot(state);
    },
    toggleFavouriteAlbum(state, action: PayloadAction<Album>) {
      const album = action.payload;
      state.albumsById[album.id] = album;
      const idx = state.favouriteAlbumIds.indexOf(album.id);
      if (idx >= 0) {
        state.favouriteAlbumIds.splice(idx, 1);
      } else {
        state.favouriteAlbumIds.unshift(album.id);
      }
      persistLibrarySnapshot(state);
    },
    createPlaylist(
      state,
      action: PayloadAction<{ name: string; description?: string }>,
    ) {
      const now = new Date().toISOString();
      state.playlists.push({
        id: `playlist-${Date.now()}`,
        name: action.payload.name.trim(),
        description: action.payload.description?.trim(),
        trackIds: [],
        createdAt: now,
        updatedAt: now,
      });
      persistLibrarySnapshot(state);
    },
    deletePlaylist(state, action: PayloadAction<string>) {
      state.playlists = state.playlists.filter(
        (p) => p.id !== action.payload || p.isDefault,
      );
      persistLibrarySnapshot(state);
    },
    addTrackToPlaylist(
      state,
      action: PayloadAction<{ playlistId: string; track: Track }>,
    ) {
      const { playlistId, track } = action.payload;
      state.tracksById[track.id] = track;
      const playlist = state.playlists.find((p) => p.id === playlistId);
      if (playlist && !playlist.trackIds.includes(track.id)) {
        playlist.trackIds.push(track.id);
        playlist.updatedAt = new Date().toISOString();
        persistLibrarySnapshot(state);
      }
    },
    removeTrackFromPlaylist(
      state,
      action: PayloadAction<{ playlistId: string; trackId: string }>,
    ) {
      const playlist = state.playlists.find((p) => p.id === action.payload.playlistId);
      if (playlist) {
        playlist.trackIds = playlist.trackIds.filter(
          (id) => id !== action.payload.trackId,
        );
        playlist.updatedAt = new Date().toISOString();
        persistLibrarySnapshot(state);
      }
    },
    recordDownloadHistory(state, action: PayloadAction<DownloadHistoryItem>) {
      const filtered = state.downloadHistory.filter(
        (item) => item.trackId !== action.payload.trackId,
      );
      state.downloadHistory = [action.payload, ...filtered];
      persistLibrarySnapshot(state);
    },
    removeDownloadHistoryItem(state, action: PayloadAction<string>) {
      state.downloadHistory = state.downloadHistory.filter(
        (item) => item.id !== action.payload,
      );
      persistLibrarySnapshot(state);
    },
    clearDownloadHistory(state) {
      state.downloadHistory = [];
      persistLibrarySnapshot(state);
    },
  },
  extraReducers: (builder) => {
    builder.addCase(hydrateLibrary.fulfilled, (state, action) => {
      if (action.payload) {
        const stored = action.payload;
        state.artists = stored.artists?.length ? stored.artists : SEEDED_ARTISTS;
        state.tracksById = stored.tracksById ?? {};
        state.favouriteTrackIds = stored.favouriteTrackIds ?? [];
        state.favouriteAlbumIds = stored.favouriteAlbumIds ?? [];
        state.albumsById = stored.albumsById ?? {};
        const hasDefault = stored.playlists?.some((p) => p.id === DEFAULT_PLAYLIST.id);
        state.playlists = hasDefault
          ? stored.playlists
          : [DEFAULT_PLAYLIST, ...(stored.playlists ?? [])];
        state.downloadHistory = stored.downloadHistory ?? [];
      }
      state.hydrated = true;
    });
  },
});

export const {
  addArtist,
  removeArtist,
  toggleFavouriteArtist,
  cacheTracks,
  toggleFavouriteTrack,
  toggleFavouriteAlbum,
  createPlaylist,
  deletePlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  recordDownloadHistory,
  removeDownloadHistoryItem,
  clearDownloadHistory,
} = librarySlice.actions;

export default librarySlice.reducer;
