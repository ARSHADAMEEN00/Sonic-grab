import type {
  Album,
  DownloadAvailability,
  MusicLanguage,
  ProviderCredentials,
  ProviderId,
  Track,
} from './music';

export interface SearchQueryParams {
  query: string;
  artistName?: string;
  type?: 'all' | 'song' | 'artist' | 'album';
  genre?: string;
  language?: MusicLanguage | 'All';
  filter?: 'all' | 'latest' | 'popular' | 'free-download' | 'streaming-only';
  page?: number;
  limit?: number;
  credentials?: ProviderCredentials;
}

export interface ProviderSearchResult {
  provider: ProviderId;
  tracks: Track[];
  albums: Album[];
  totalEstimate?: number;
  fromCache?: boolean;
  warning?: string;
}

export interface MusicProviderAdapter {
  readonly id: ProviderId;
  readonly displayName: string;
  readonly supportsAuthorisedDownloads: boolean;
  readonly requiresCredentials: boolean;

  isConfigured(credentials?: ProviderCredentials): boolean;

  search(params: SearchQueryParams): Promise<ProviderSearchResult>;

  getTrending?(
    region: 'global' | 'india',
    credentials?: ProviderCredentials,
  ): Promise<ProviderSearchResult>;

  getArtistReleases?(
    artistName: string,
    languageHint?: MusicLanguage,
    credentials?: ProviderCredentials,
  ): Promise<{ albums: Album[]; tracks: Track[]; warning?: string }>;

  getAlbumTracks?(
    albumId: string,
    credentials?: ProviderCredentials,
  ): Promise<Track[]>;

  verifyDownloadAvailability(track: Track): DownloadAvailability;

  checkHealth?(credentials?: ProviderCredentials): Promise<{
    ok: boolean;
    message: string;
  }>;
}
