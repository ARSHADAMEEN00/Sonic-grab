import type {
  Album,
  DownloadAvailability,
  ProviderCredentials,
  Track,
} from '../../../types/music';
import type {
  MusicProviderAdapter,
  ProviderSearchResult,
  SearchQueryParams,
} from '../../../types/provider';
import { fetchJson } from '../../api/httpClient';

interface SpotifySearchResponse {
  tracks?: {
    items: Array<{
      id: string;
      name: string;
      duration_ms: number;
      popularity: number;
      preview_url: string | null;
      external_urls: { spotify: string };
      artists: Array<{ id: string; name: string }>;
      album: {
        id: string;
        name: string;
        release_date: string;
        images: Array<{ url: string }>;
      };
    }>;
  };
  albums?: {
    items: Array<{
      id: string;
      name: string;
      release_date: string;
      total_tracks: number;
      external_urls: { spotify: string };
      images: Array<{ url: string }>;
      artists: Array<{ id: string; name: string }>;
    }>;
  };
}

export class SpotifyProvider implements MusicProviderAdapter {
  readonly id = 'spotify' as const;
  readonly displayName = 'Spotify (Metadata Only)';
  readonly supportsAuthorisedDownloads = false;
  readonly requiresCredentials = true;

  isConfigured(credentials?: ProviderCredentials): boolean {
    return Boolean(credentials?.spotifyAccessToken?.trim());
  }

  verifyDownloadAvailability(_track: Track): DownloadAvailability {
    return 'STREAMING ONLY';
  }

  async search(params: SearchQueryParams): Promise<ProviderSearchResult> {
    const token = params.credentials?.spotifyAccessToken?.trim();
    if (!token) {
      return {
        provider: this.id,
        tracks: [],
        albums: [],
        warning:
          'Spotify integration is optional and metadata-only. Add a user OAuth token in Settings if desired (client_secret must never be placed in frontend code).',
      };
    }

    try {
      const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(
        params.query,
      )}&type=track,album&limit=${Math.min(params.limit ?? 12, 20)}`;
      const res = await fetchJson<SpotifySearchResponse>(url, {
        cacheKey: `spotify:${params.query}:${params.limit ?? 12}`,
        headers: { Authorization: `Bearer ${token}` },
      });

      const tracks: Track[] = (res.tracks?.items ?? []).map((t) => ({
        id: `spotify-track-${t.id}`,
        title: t.name,
        artist: t.artists.map((a) => a.name).join(', '),
        album: t.album.name,
        albumId: `spotify-album-${t.album.id}`,
        durationSec: Math.round(t.duration_ms / 1000),
        releaseDate: t.album.release_date,
        language: params.language && params.language !== 'All' ? params.language : 'English',
        artworkUrl: t.album.images[0]?.url,
        previewUrl: t.preview_url ?? undefined,
        sourceUrl: t.external_urls.spotify,
        provider: 'spotify',
        availability: 'STREAMING ONLY',
        popularityScore: t.popularity,
      }));

      const albums: Album[] = (res.albums?.items ?? []).map((a) => ({
        id: `spotify-album-${a.id}`,
        title: a.name,
        artist: a.artists.map((ar) => ar.name).join(', '),
        releaseDate: a.release_date,
        trackCount: a.total_tracks,
        language: params.language && params.language !== 'All' ? params.language : 'English',
        artworkUrl: a.images[0]?.url,
        sourceUrl: a.external_urls.spotify,
        provider: 'spotify',
        availability: 'STREAMING ONLY',
      }));

      return { provider: this.id, tracks, albums };
    } catch (err) {
      return {
        provider: this.id,
        tracks: [],
        albums: [],
        warning: `Spotify token rejected or expired: ${
          err instanceof Error ? err.message : 'Error'
        }`,
      };
    }
  }

  async checkHealth(
    credentials?: ProviderCredentials,
  ): Promise<{ ok: boolean; message: string }> {
    const token = credentials?.spotifyAccessToken?.trim();
    if (!token) {
      return {
        ok: false,
        message: 'Optional: No OAuth token configured (requires user token or external auth backend)',
      };
    }
    try {
      await fetchJson('https://api.spotify.com/v1/search?q=dua+lipa&type=track&limit=1', {
        headers: { Authorization: `Bearer ${token}` },
        timeoutMs: 6000,
      });
      return { ok: true, message: 'Spotify metadata API online' };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Token invalid/expired',
      };
    }
  }
}

export const spotifyProvider = new SpotifyProvider();
