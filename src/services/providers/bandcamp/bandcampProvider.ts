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

/**
 * Bandcamp does not offer an open, CORS-enabled unauthenticated catalog/download
 * API for pure browser apps. This adapter preserves compliance by never scraping
 * pages or guessing audio stream URLs.
 */
export class BandcampProvider implements MusicProviderAdapter {
  readonly id = 'bandcamp' as const;
  readonly displayName = 'Bandcamp (External Discovery)';
  readonly supportsAuthorisedDownloads = false;
  readonly requiresCredentials = false;

  isConfigured(_credentials?: ProviderCredentials): boolean {
    return false;
  }

  verifyDownloadAvailability(_track: Track): DownloadAvailability {
    return 'PAID DOWNLOAD AVAILABLE';
  }

  async search(_params: SearchQueryParams): Promise<ProviderSearchResult> {
    return {
      provider: this.id,
      tracks: [],
      albums: [],
      warning:
        'Bandcamp has no public browser-CORS API for catalog search or direct MP3 downloads. Use the external Bandcamp link to support artists and download purchased/PWYW releases directly.',
    };
  }

  async checkHealth(): Promise<{ ok: boolean; message: string }> {
    return {
      ok: false,
      message: 'External only — no public CORS API (scraping prohibited)',
    };
  }
}

export const bandcampProvider = new BandcampProvider();
