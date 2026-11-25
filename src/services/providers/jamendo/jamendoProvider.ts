import type {
  Album,
  DownloadAvailability,
  MusicLanguage,
  ProviderCredentials,
  Track,
} from '../../../types/music';
import type {
  MusicProviderAdapter,
  ProviderSearchResult,
  SearchQueryParams,
} from '../../../types/provider';
import { fetchJson } from '../../api/httpClient';

interface JamendoTrackResult {
  id: string;
  name: string;
  duration: number;
  artist_id: string;
  artist_name: string;
  album_name: string;
  album_id: string;
  releasedate?: string;
  album_image?: string;
  image?: string;
  audio?: string;
  audiodownload?: string;
  audiodownload_allowed?: boolean;
  license_ccurl?: string;
  shareurl?: string;
  musicinfo?: {
    tags?: {
      genres?: string[];
    };
    lang?: string;
  };
}

interface JamendoTrackResponse {
  headers: { status: string; error_message?: string; results_count: number };
  results: JamendoTrackResult[];
}

interface JamendoAlbumResponse {
  headers: { status: string; error_message?: string };
  results: Array<{
    id: string;
    name: string;
    releasedate?: string;
    artist_id: string;
    artist_name: string;
    image?: string;
    zip?: string;
    zip_allowed?: boolean;
    shareurl?: string;
  }>;
}

const JAMENDO_BASE = 'https://api.jamendo.com/v3.0';

function parseLicenceName(ccUrl?: string): string {
  if (!ccUrl) return 'Creative Commons (Jamendo)';
  const match = ccUrl.match(/licenses\/([^/]+)\/([^/]+)/i);
  if (match) {
    return `CC ${match[1].toUpperCase()} ${match[2]}`;
  }
  return 'Creative Commons';
}

function mapJamendoLang(langCode?: string): MusicLanguage {
  const code = (langCode ?? '').toLowerCase();
  if (code.includes('en')) return 'English';
  if (code.includes('hi')) return 'Hindi';
  if (code.includes('ml')) return 'Malayalam';
  if (code.includes('ta')) return 'Tamil';
  if (code.includes('ar')) return 'Arabic';
  return 'English';
}

function mapJamendoTrack(item: JamendoTrackResult, rankIndex = 0): Track {
  const downloadAllowed = Boolean(item.audiodownload_allowed && item.audiodownload);
  const licenceLabel = parseLicenceName(item.license_ccurl);
  const sourcePageUrl = item.shareurl || `https://www.jamendo.com/track/${item.id}`;

  return {
    id: `jamendo-track-${item.id}`,
    title: item.name,
    artist: item.artist_name,
    artistId: `jamendo-artist-${item.artist_id}`,
    album: item.album_name || 'Jamendo Single',
    albumId: item.album_id ? `jamendo-album-${item.album_id}` : undefined,
    durationSec: item.duration,
    releaseDate: item.releasedate,
    genre: item.musicinfo?.tags?.genres?.[0] ?? 'Independent',
    language: mapJamendoLang(item.musicinfo?.lang),
    artworkUrl: item.album_image || item.image,
    previewUrl: item.audio,
    sourceUrl: sourcePageUrl,
    provider: 'jamendo',
    availability: downloadAllowed ? 'FREE DOWNLOAD AVAILABLE' : 'STREAMING ONLY',
    popularityScore: Math.max(20, 100 - rankIndex * 2),
    downloadInfo: downloadAllowed
      ? {
          verified: true,
          provider: 'jamendo',
          providerName: 'Jamendo',
          licence: licenceLabel,
          licenceUrl: item.license_ccurl,
          format: 'MP3',
          audioQuality: 'MP3 (Jamendo Authorised)',
          downloadUrl: item.audiodownload,
          sourcePageUrl,
          corsDownloadSupported: true,
        }
      : undefined,
  };
}

export class JamendoProvider implements MusicProviderAdapter {
  readonly id = 'jamendo' as const;
  readonly displayName = 'Jamendo (CC Free MP3)';
  readonly supportsAuthorisedDownloads = true;
  readonly requiresCredentials = true;

  isConfigured(credentials?: ProviderCredentials): boolean {
    return Boolean(credentials?.jamendoClientId?.trim());
  }

  verifyDownloadAvailability(track: Track): DownloadAvailability {
    if (track.downloadInfo?.verified && track.downloadInfo?.downloadUrl) {
      return 'FREE DOWNLOAD AVAILABLE';
    }
    return 'STREAMING ONLY';
  }

  async search(params: SearchQueryParams): Promise<ProviderSearchResult> {
    const clientId = params.credentials?.jamendoClientId?.trim();
    if (!clientId) {
      return {
        provider: this.id,
        tracks: [],
        albums: [],
        warning:
          'Jamendo requires a free Developer Client ID. Add it in Settings → Provider Configuration (https://devportal.jamendo.com/) to unlock CC-licensed MP3 downloads.',
      };
    }

    const { query, artistName, genre, page = 1, limit = 20, filter } = params;
    const clampedLimit = Math.min(Math.max(1, limit), 100);
    const offset = Math.max(0, (page - 1) * clampedLimit);
    const order =
      filter === 'latest' ? 'releasedate_desc' : 'popularity_total';

    try {
      const searchUrl = new URL(`${JAMENDO_BASE}/tracks/`);
      searchUrl.searchParams.set('client_id', clientId);
      searchUrl.searchParams.set('format', 'json');
      searchUrl.searchParams.set('limit', String(clampedLimit));
      searchUrl.searchParams.set('offset', String(offset));
      searchUrl.searchParams.set('include', 'licenses+musicinfo');
      searchUrl.searchParams.set('audioformat', 'mp32');
      searchUrl.searchParams.set('audiodlformat', 'mp32');
      searchUrl.searchParams.set('order', order);
      if (artistName?.trim()) {
        searchUrl.searchParams.set('artist_name', artistName.trim());
      }
      if (query.trim()) {
        searchUrl.searchParams.set('namesearch', query.trim());
      }
      if (genre && genre !== 'All') {
        searchUrl.searchParams.set('tags', genre.toLowerCase());
      }

      const albumUrl = new URL(`${JAMENDO_BASE}/albums/`);
      albumUrl.searchParams.set('client_id', clientId);
      albumUrl.searchParams.set('format', 'json');
      albumUrl.searchParams.set('limit', '10');
      if (artistName?.trim()) {
        albumUrl.searchParams.set('artist_name', artistName.trim());
      } else if (query.trim()) {
        albumUrl.searchParams.set('namesearch', query.trim());
      }

      const [trackRes, albumRes] = await Promise.all([
        fetchJson<JamendoTrackResponse>(searchUrl.toString(), {
          cacheKey: `jamendo-tracks:${searchUrl.search}`,
        }),
        fetchJson<JamendoAlbumResponse>(albumUrl.toString(), {
          cacheKey: `jamendo-albums:${albumUrl.search}`,
        }),
      ]);

      if (trackRes.headers.status !== 'success') {
        throw new Error(trackRes.headers.error_message || 'Jamendo API error');
      }

      const tracks = trackRes.results.map((t, idx) => mapJamendoTrack(t, idx));
      const albums: Album[] = albumRes.results.map((a) => ({
        id: `jamendo-album-${a.id}`,
        title: a.name,
        artist: a.artist_name,
        artistId: `jamendo-artist-${a.artist_id}`,
        releaseDate: a.releasedate,
        language: 'English',
        artworkUrl: a.image,
        sourceUrl: a.shareurl || `https://www.jamendo.com/album/${a.id}`,
        provider: 'jamendo',
        availability: a.zip_allowed ? 'FREE DOWNLOAD AVAILABLE' : 'STREAMING ONLY',
      }));

      return {
        provider: this.id,
        tracks,
        albums,
        totalEstimate: trackRes.headers.results_count,
      };
    } catch (err) {
      return {
        provider: this.id,
        tracks: [],
        albums: [],
        warning: `Jamendo request failed: ${
          err instanceof Error ? err.message : 'Network error'
        }`,
      };
    }
  }

  async getPopularFreeDownloads(
    credentials?: ProviderCredentials,
    limit = 16,
  ): Promise<ProviderSearchResult> {
    return this.search({
      query: '',
      limit,
      filter: 'popular',
      credentials,
    });
  }

  async getAlbumTracks(
    albumId: string,
    credentials?: ProviderCredentials,
  ): Promise<Track[]> {
    const clientId = credentials?.jamendoClientId?.trim();
    const rawId = albumId.replace(/^jamendo-album-/, '');
    if (!clientId || !rawId) return [];

    try {
      const url = `${JAMENDO_BASE}/tracks/?client_id=${encodeURIComponent(
        clientId,
      )}&format=json&album_id=${encodeURIComponent(
        rawId,
      )}&include=licenses+musicinfo&audioformat=mp32&limit=50`;
      const res = await fetchJson<JamendoTrackResponse>(url, {
        cacheKey: `jamendo-album-tracks:${rawId}`,
      });
      return res.results.map((t, idx) => mapJamendoTrack(t, idx));
    } catch {
      return [];
    }
  }

  async checkHealth(
    credentials?: ProviderCredentials,
  ): Promise<{ ok: boolean; message: string }> {
    const clientId = credentials?.jamendoClientId?.trim();
    if (!clientId) {
      return {
        ok: false,
        message: 'Requires free Jamendo Client ID in Settings',
      };
    }
    try {
      const res = await fetchJson<JamendoTrackResponse>(
        `${JAMENDO_BASE}/tracks/?client_id=${encodeURIComponent(
          clientId,
        )}&format=json&limit=1`,
        { timeoutMs: 7000 },
      );
      if (res.headers.status === 'success') {
        return { ok: true, message: 'Jamendo API online & Client ID verified' };
      }
      return {
        ok: false,
        message: res.headers.error_message || 'Invalid Jamendo Client ID',
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Unreachable',
      };
    }
  }
}

export const jamendoProvider = new JamendoProvider();
