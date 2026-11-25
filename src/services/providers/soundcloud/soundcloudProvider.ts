import type {
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

interface SoundCloudTrack {
  id: number;
  title: string;
  duration: number;
  genre?: string;
  artwork_url?: string;
  permalink_url: string;
  downloadable?: boolean;
  download_url?: string;
  license?: string;
  created_at?: string;
  user?: { username: string };
}

export class SoundCloudProvider implements MusicProviderAdapter {
  readonly id = 'soundcloud' as const;
  readonly displayName = 'SoundCloud (Optional)';
  readonly supportsAuthorisedDownloads = true;
  readonly requiresCredentials = true;

  isConfigured(credentials?: ProviderCredentials): boolean {
    return Boolean(credentials?.soundcloudClientId?.trim());
  }

  verifyDownloadAvailability(track: Track): DownloadAvailability {
    if (track.downloadInfo?.verified && track.downloadInfo?.downloadUrl) {
      return 'FREE DOWNLOAD AVAILABLE';
    }
    return 'STREAMING ONLY';
  }

  async search(params: SearchQueryParams): Promise<ProviderSearchResult> {
    const clientId = params.credentials?.soundcloudClientId?.trim();
    if (!clientId) {
      return {
        provider: this.id,
        tracks: [],
        albums: [],
        warning:
          'SoundCloud requires an authorised SoundCloud API client_id (official OAuth/API registration). Without it, SoundCloud search is disabled rather than scraping.',
      };
    }

    try {
      const url = `https://api.soundcloud.com/tracks?q=${encodeURIComponent(
        params.query,
      )}&limit=${Math.min(params.limit ?? 10, 20)}&client_id=${encodeURIComponent(
        clientId,
      )}`;
      const items = await fetchJson<SoundCloudTrack[]>(url, {
        cacheKey: `sc-search:${params.query}`,
      });

      const tracks: Track[] = items.map((item) => {
        const allowDownload = Boolean(item.downloadable && item.download_url);
        const directUrl = allowDownload
          ? `${item.download_url}?client_id=${encodeURIComponent(clientId)}`
          : undefined;
        return {
          id: `sc-${item.id}`,
          title: item.title,
          artist: item.user?.username ?? 'SoundCloud Artist',
          album: 'SoundCloud Upload',
          durationSec: Math.round(item.duration / 1000),
          releaseDate: item.created_at?.slice(0, 10),
          genre: item.genre,
          language: params.language && params.language !== 'All' ? params.language : 'English',
          artworkUrl: item.artwork_url?.replace('-large', '-t300x300'),
          sourceUrl: item.permalink_url,
          provider: 'soundcloud',
          availability: allowDownload ? 'FREE DOWNLOAD AVAILABLE' : 'STREAMING ONLY',
          downloadInfo: allowDownload
            ? {
                verified: true,
                provider: 'soundcloud',
                providerName: 'SoundCloud',
                licence: item.license || 'Artist Authorised Download',
                format: 'Audio File',
                downloadUrl: directUrl,
                sourcePageUrl: item.permalink_url,
                corsDownloadSupported: false,
              }
            : undefined,
        };
      });

      return { provider: this.id, tracks, albums: [] };
    } catch (err) {
      return {
        provider: this.id,
        tracks: [],
        albums: [],
        warning: `SoundCloud API request failed: ${
          err instanceof Error ? err.message : 'Error'
        }`,
      };
    }
  }

  async checkHealth(
    credentials?: ProviderCredentials,
  ): Promise<{ ok: boolean; message: string }> {
    if (!this.isConfigured(credentials)) {
      return {
        ok: false,
        message: 'Optional: Requires SoundCloud API client_id (scraping disabled)',
      };
    }
    return {
      ok: true,
      message: 'SoundCloud client_id configured',
    };
  }
}

export const soundCloudProvider = new SoundCloudProvider();
