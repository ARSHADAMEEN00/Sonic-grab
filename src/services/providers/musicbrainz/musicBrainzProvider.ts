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

interface MbArtistSearchResponse {
  artists?: Array<{
    id: string;
    name: string;
    country?: string;
    disambiguation?: string;
    tags?: Array<{ name: string; count: number }>;
  }>;
}

interface MbReleaseGroupSearchResponse {
  'release-groups'?: Array<{
    id: string;
    title: string;
    'primary-type'?: string;
    'first-release-date'?: string;
    'artist-credit'?: Array<{ name: string; artist?: { id: string; name: string } }>;
  }>;
}

interface MbRecordingSearchResponse {
  recordings?: Array<{
    id: string;
    title: string;
    length?: number;
    'first-release-date'?: string;
    'artist-credit'?: Array<{ name: string; artist?: { id: string } }>;
    releases?: Array<{ id: string; title: string; date?: string }>;
  }>;
}

interface MbReleaseLookupResponse {
  releases?: Array<{
    id: string;
    title: string;
    date?: string;
    media?: Array<{
      tracks?: Array<{
        id: string;
        title: string;
        length?: number;
        recording?: { id: string };
      }>;
    }>;
  }>;
}

const MB_BASE = 'https://musicbrainz.org/ws/2';
const MB_MIN_INTERVAL_MS = 1100; // MusicBrainz strictly asks for <= 1 req/sec

export class MusicBrainzProvider implements MusicProviderAdapter {
  readonly id = 'musicbrainz' as const;
  readonly displayName = 'MusicBrainz';
  readonly supportsAuthorisedDownloads = false;
  readonly requiresCredentials = false;

  isConfigured(_credentials?: ProviderCredentials): boolean {
    return true;
  }

  verifyDownloadAvailability(_track: Track): DownloadAvailability {
    return 'DOWNLOAD NOT VERIFIED';
  }

  async search(params: SearchQueryParams): Promise<ProviderSearchResult> {
    const { query, language, limit = 10 } = params;
    const langHint: MusicLanguage =
      language && language !== 'All' ? language : 'English';

    try {
      const [recRes, rgRes] = await Promise.all([
        fetchJson<MbRecordingSearchResponse>(
          `${MB_BASE}/recording/?query=${encodeURIComponent(query)}&limit=${Math.min(
            limit,
            15,
          )}&fmt=json`,
          {
            cacheKey: `mb-rec:${query}:${limit}`,
            rateLimitKey: 'musicbrainz',
            minIntervalMs: MB_MIN_INTERVAL_MS,
          },
        ),
        fetchJson<MbReleaseGroupSearchResponse>(
          `${MB_BASE}/release-group/?query=${encodeURIComponent(
            query,
          )}&limit=8&fmt=json`,
          {
            cacheKey: `mb-rg:${query}`,
            rateLimitKey: 'musicbrainz',
            minIntervalMs: MB_MIN_INTERVAL_MS,
          },
        ),
      ]);

      const tracks: Track[] = (recRes.recordings ?? []).map((rec, idx) => {
        const artistName =
          rec['artist-credit']?.map((a) => a.name).join(', ') || 'Unknown Artist';
        const firstRelease = rec.releases?.[0];
        return {
          id: `mb-rec-${rec.id}`,
          title: rec.title,
          artist: artistName,
          album: firstRelease?.title ?? 'Unknown Release',
          albumId: firstRelease ? `mb-rel-${firstRelease.id}` : undefined,
          durationSec: rec.length ? Math.round(rec.length / 1000) : undefined,
          releaseDate: rec['first-release-date'] ?? firstRelease?.date,
          language: langHint,
          sourceUrl: `https://musicbrainz.org/recording/${rec.id}`,
          provider: 'musicbrainz',
          availability: 'DOWNLOAD NOT VERIFIED',
          popularityScore: 70 - idx,
        };
      });

      const albums: Album[] = (rgRes['release-groups'] ?? []).map((rg) => {
        const artistName =
          rg['artist-credit']?.map((a) => a.name).join(', ') || 'Unknown Artist';
        return {
          id: `mb-rg-${rg.id}`,
          title: rg.title,
          artist: artistName,
          releaseDate: rg['first-release-date'],
          genre: rg['primary-type'],
          language: langHint,
          artworkUrl: `https://coverartarchive.org/release-group/${rg.id}/front-250`,
          sourceUrl: `https://musicbrainz.org/release-group/${rg.id}`,
          provider: 'musicbrainz',
          availability: 'DOWNLOAD NOT VERIFIED',
        };
      });

      return { provider: this.id, tracks, albums };
    } catch (err) {
      return {
        provider: this.id,
        tracks: [],
        albums: [],
        warning: `MusicBrainz lookup failed: ${
          err instanceof Error ? err.message : 'Network error'
        }`,
      };
    }
  }

  async getArtistReleases(
    artistName: string,
    languageHint: MusicLanguage = 'English',
  ): Promise<{ albums: Album[]; tracks: Track[]; warning?: string }> {
    try {
      const artistSearch = await fetchJson<MbArtistSearchResponse>(
        `${MB_BASE}/artist/?query=artist:${encodeURIComponent(
          `"${artistName}"`,
        )}&limit=1&fmt=json`,
        {
          cacheKey: `mb-artist:${artistName}`,
          rateLimitKey: 'musicbrainz',
          minIntervalMs: MB_MIN_INTERVAL_MS,
        },
      );
      const artist = artistSearch.artists?.[0];
      if (!artist) return { albums: [], tracks: [] };

      const rgRes = await fetchJson<MbReleaseGroupSearchResponse>(
        `${MB_BASE}/release-group?artist=${artist.id}&type=album|single&limit=15&fmt=json`,
        {
          cacheKey: `mb-artist-rgs:${artist.id}`,
          rateLimitKey: 'musicbrainz',
          minIntervalMs: MB_MIN_INTERVAL_MS,
        },
      );

      const albums: Album[] = (rgRes['release-groups'] ?? [])
        .map((rg) => ({
          id: `mb-rg-${rg.id}`,
          title: rg.title,
          artist: artist.name,
          artistId: `mb-artist-${artist.id}`,
          releaseDate: rg['first-release-date'],
          genre: rg['primary-type'],
          language: languageHint,
          artworkUrl: `https://coverartarchive.org/release-group/${rg.id}/front-250`,
          sourceUrl: `https://musicbrainz.org/release-group/${rg.id}`,
          provider: 'musicbrainz' as const,
          availability: 'DOWNLOAD NOT VERIFIED' as const,
        }))
        .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''));

      return { albums, tracks: [] };
    } catch (err) {
      return {
        albums: [],
        tracks: [],
        warning: err instanceof Error ? err.message : 'MusicBrainz error',
      };
    }
  }

  async getAlbumTracks(albumId: string): Promise<Track[]> {
    const rgId = albumId.replace(/^mb-rg-/, '');
    if (!rgId || rgId === albumId) return [];

    try {
      const res = await fetchJson<MbReleaseLookupResponse>(
        `${MB_BASE}/release?release-group=${rgId}&inc=recordings&limit=1&fmt=json`,
        {
          cacheKey: `mb-rg-tracks:${rgId}`,
          rateLimitKey: 'musicbrainz',
          minIntervalMs: MB_MIN_INTERVAL_MS,
        },
      );
      const release = res.releases?.[0];
      if (!release) return [];

      const tracks: Track[] = [];
      for (const medium of release.media ?? []) {
        for (const t of medium.tracks ?? []) {
          tracks.push({
            id: `mb-track-${t.id}`,
            title: t.title,
            artist: 'MusicBrainz Release Track',
            album: release.title,
            albumId,
            durationSec: t.length ? Math.round(t.length / 1000) : undefined,
            releaseDate: release.date,
            language: 'English',
            sourceUrl: `https://musicbrainz.org/release/${release.id}`,
            provider: 'musicbrainz',
            availability: 'DOWNLOAD NOT VERIFIED',
          });
        }
      }
      return tracks;
    } catch {
      return [];
    }
  }

  async checkHealth(): Promise<{ ok: boolean; message: string }> {
    try {
      await fetchJson<MbArtistSearchResponse>(
        `${MB_BASE}/artist/?query=nirvana&limit=1&fmt=json`,
        {
          rateLimitKey: 'musicbrainz',
          minIntervalMs: MB_MIN_INTERVAL_MS,
          timeoutMs: 8000,
        },
      );
      return { ok: true, message: 'MusicBrainz API online (1 req/sec rate-limited)' };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Unreachable',
      };
    }
  }
}

export const musicBrainzProvider = new MusicBrainzProvider();
