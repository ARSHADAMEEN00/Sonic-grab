export type ProviderId =
  | 'apple-music'
  | 'musicbrainz'
  | 'spotify'
  | 'jamendo'
  | 'internet-archive'
  | 'soundcloud'
  | 'bandcamp';

export type DownloadAvailability =
  | 'FREE DOWNLOAD AVAILABLE'
  | 'PAID DOWNLOAD AVAILABLE'
  | 'STREAMING ONLY'
  | 'DOWNLOAD NOT VERIFIED';

export type MusicLanguage =
  | 'English'
  | 'Malayalam'
  | 'Hindi'
  | 'Tamil'
  | 'Arabic'
  | 'Other';

export type ArtistCategory = 'international' | 'indian';

export interface DownloadMetadata {
  verified: boolean;
  provider: ProviderId;
  providerName: string;
  licence: string;
  licenceUrl?: string;
  format: string;
  fileSizeBytes?: number;
  audioQuality?: string;
  downloadUrl?: string;
  sourcePageUrl: string;
  corsDownloadSupported?: boolean;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  album: string;
  albumId?: string;
  durationSec?: number;
  releaseDate?: string;
  genre?: string;
  language: MusicLanguage;
  region?: 'global' | 'india';
  artworkUrl?: string;
  previewUrl?: string;
  sourceUrl: string;
  provider: ProviderId;
  availability: DownloadAvailability;
  downloadInfo?: DownloadMetadata;
  popularityScore?: number;
  isSampleFallback?: boolean;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  releaseDate?: string;
  genre?: string;
  language: MusicLanguage;
  region?: 'global' | 'india';
  artworkUrl?: string;
  trackCount?: number;
  sourceUrl: string;
  provider: ProviderId;
  availability: DownloadAvailability;
  tracks?: Track[];
  isSampleFallback?: boolean;
}

export interface ArtistEntry {
  id: string;
  name: string;
  category: ArtistCategory;
  primaryLanguage: MusicLanguage;
  genres: string[];
  favourite: boolean;
  addedAt: string;
  artworkUrl?: string;
  notes?: string;
}

export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'validating'
  | 'completed'
  | 'cors-fallback'
  | 'failed'
  | 'cancelled';

export interface DownloadQueueItem {
  id: string;
  track: Track;
  fileName: string;
  status: DownloadStatus;
  progressPercent: number;
  bytesReceived: number;
  totalBytes?: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
  storedInIndexedDb?: boolean;
}

export interface DownloadHistoryItem {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  album: string;
  language: MusicLanguage;
  provider: ProviderId;
  licence: string;
  fileName: string;
  fileSizeBytes?: number;
  sourcePageUrl: string;
  downloadedAt: string;
  method: 'browser-blob' | 'browser-direct-link';
  hasLocalBlob: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  trackIds: string[];
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
}

export interface ProviderCredentials {
  jamendoClientId: string;
  appleMusicDeveloperToken: string;
  spotifyAccessToken: string;
  soundcloudClientId: string;
}

export interface AppSettings {
  preferredLanguages: MusicLanguage[];
  defaultPlaylistId: string;
  maxConcurrentDownloads: number;
  showArtwork: boolean;
  credentials: ProviderCredentials;
}

export interface ProviderStatus {
  id: ProviderId;
  name: string;
  role: 'discovery' | 'metadata' | 'free-downloads';
  configured: boolean;
  reachable: 'unknown' | 'online' | 'degraded' | 'requires-config';
  supportsDownloads: boolean;
  note: string;
  lastCheckedAt?: string;
}
