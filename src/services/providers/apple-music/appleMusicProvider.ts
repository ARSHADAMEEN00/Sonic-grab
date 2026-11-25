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
import { SAMPLE_GLOBAL_TRACKS, SAMPLE_INDIA_TRACKS } from '../../../utils/seedData';

interface ITunesResultItem {
  wrapperType?: string;
  kind?: string;
  trackId?: number;
  collectionId?: number;
  artistId?: number;
  artistName?: string;
  trackName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackViewUrl?: string;
  collectionViewUrl?: string;
  releaseDate?: string;
  primaryGenreName?: string;
  trackTimeMillis?: number;
  trackCount?: number;
  country?: string;
}

interface ITunesSearchResponse {
  resultCount: number;
  results: ITunesResultItem[];
}

interface AppleMusicCatalogResponse {
  results?: {
    songs?: {
      data: Array<{
        id: string;
        attributes: {
          name: string;
          artistName: string;
          albumName: string;
          releaseDate?: string;
          durationInMillis?: number;
          genreNames?: string[];
          url: string;
          artwork?: { url: string };
          previews?: Array<{ url: string }>;
        };
      }>;
    };
    albums?: {
      data: Array<{
        id: string;
        attributes: {
          name: string;
          artistName: string;
          releaseDate?: string;
          trackCount?: number;
          genreNames?: string[];
          url: string;
          artwork?: { url: string };
        };
      }>;
    };
  };
}

function upscaleArtwork(url?: string): string | undefined {
  if (!url) return undefined;
  return url.replace('100x100bb', '400x400bb').replace('{w}x{h}', '400x400');
}

function inferLanguage(
  genre?: string,
  country?: string,
  fallback: MusicLanguage = 'English',
): MusicLanguage {
  const g = (genre ?? '').toLowerCase();
  if (g.includes('malayalam')) return 'Malayalam';
  if (g.includes('tamil')) return 'Tamil';
  if (g.includes('hindi') || g.includes('bollywood')) return 'Hindi';
  if (g.includes('arabic')) return 'Arabic';
  if (country === 'IND' || g.includes('indian') || g.includes('punjabi')) return 'Hindi';
  return fallback;
}

function mapITunesTrack(
  item: ITunesResultItem,
  region: 'global' | 'india',
  langHint?: MusicLanguage,
  rankIndex = 0,
): Track {
  const id = `apple-track-${item.trackId ?? `${item.collectionId}-${rankIndex}`}`;
  const language = inferLanguage(
    item.primaryGenreName,
    item.country,
    langHint ?? (region === 'india' ? 'Hindi' : 'English'),
  );
  return {
    id,
    title: item.trackName ?? item.collectionName ?? 'Unknown Track',
    artist: item.artistName ?? 'Unknown Artist',
    artistId: item.artistId ? `apple-artist-${item.artistId}` : undefined,
    album: item.collectionName ?? 'Single',
    albumId: item.collectionId ? `apple-album-${item.collectionId}` : undefined,
    durationSec: item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : undefined,
    releaseDate: item.releaseDate?.slice(0, 10),
    genre: item.primaryGenreName,
    language,
    region,
    artworkUrl: upscaleArtwork(item.artworkUrl100),
    previewUrl: item.previewUrl,
    sourceUrl: item.trackViewUrl ?? item.collectionViewUrl ?? 'https://music.apple.com',
    provider: 'apple-music',
    availability: 'STREAMING ONLY',
    popularityScore: Math.max(10, 100 - rankIndex * 2),
  };
}

function mapITunesAlbum(
  item: ITunesResultItem,
  region: 'global' | 'india',
  langHint?: MusicLanguage,
): Album {
  return {
    id: `apple-album-${item.collectionId ?? item.trackId}`,
    title: item.collectionName ?? 'Unknown Album',
    artist: item.artistName ?? 'Unknown Artist',
    artistId: item.artistId ? `apple-artist-${item.artistId}` : undefined,
    releaseDate: item.releaseDate?.slice(0, 10),
    genre: item.primaryGenreName,
    language: inferLanguage(
      item.primaryGenreName,
      item.country,
      langHint ?? (region === 'india' ? 'Hindi' : 'English'),
    ),
    region,
    artworkUrl: upscaleArtwork(item.artworkUrl100),
    trackCount: item.trackCount,
    sourceUrl: item.collectionViewUrl ?? 'https://music.apple.com',
    provider: 'apple-music',
    availability: 'STREAMING ONLY',
  };
}

export class AppleMusicProvider implements MusicProviderAdapter {
  readonly id = 'apple-music' as const;
  readonly displayName = 'Apple Music / iTunes';
  readonly supportsAuthorisedDownloads = false;
  readonly requiresCredentials = false;

  isConfigured(_credentials?: ProviderCredentials): boolean {
    // Public iTunes Search/Lookup endpoints work without credentials;
    // official Apple Music Developer API JWT is optional.
    return true;
  }

  verifyDownloadAvailability(_track: Track): DownloadAvailability {
    return 'STREAMING ONLY';
  }

  async search(params: SearchQueryParams): Promise<ProviderSearchResult> {
    const { query, language, limit = 18, credentials } = params;
    const country =
      language === 'Hindi' || language === 'Malayalam' || language === 'Tamil'
        ? 'in'
        : 'us';
    const region: 'global' | 'india' = country === 'in' ? 'india' : 'global';

    // If user configured an Apple Music Developer Token, try official API first
    const token = credentials?.appleMusicDeveloperToken?.trim();
    if (token) {
      try {
        const url = `https://api.music.apple.com/v1/catalog/${country}/search?term=${encodeURIComponent(
          query,
        )}&types=songs,albums&limit=${Math.min(limit, 25)}`;
        const data = await fetchJson<AppleMusicCatalogResponse>(url, {
          cacheKey: `apple-dev:${country}:${query}:${limit}`,
          headers: { Authorization: `Bearer ${token}` },
        });
        const tracks: Track[] = (data.results?.songs?.data ?? []).map((song, idx) => ({
          id: `apple-cat-song-${song.id}`,
          title: song.attributes.name,
          artist: song.attributes.artistName,
          album: song.attributes.albumName,
          releaseDate: song.attributes.releaseDate,
          durationSec: song.attributes.durationInMillis
            ? Math.round(song.attributes.durationInMillis / 1000)
            : undefined,
          genre: song.attributes.genreNames?.[0],
          language: language && language !== 'All' ? language : region === 'india' ? 'Hindi' : 'English',
          region,
          artworkUrl: upscaleArtwork(song.attributes.artwork?.url),
          previewUrl: song.attributes.previews?.[0]?.url,
          sourceUrl: song.attributes.url,
          provider: 'apple-music',
          availability: 'STREAMING ONLY',
          popularityScore: 95 - idx,
        }));

        const albums: Album[] = (data.results?.albums?.data ?? []).map((album) => ({
          id: `apple-cat-album-${album.id}`,
          title: album.attributes.name,
          artist: album.attributes.artistName,
          releaseDate: album.attributes.releaseDate,
          trackCount: album.attributes.trackCount,
          genre: album.attributes.genreNames?.[0],
          language: language && language !== 'All' ? language : region === 'india' ? 'Hindi' : 'English',
          region,
          artworkUrl: upscaleArtwork(album.attributes.artwork?.url),
          sourceUrl: album.attributes.url,
          provider: 'apple-music',
          availability: 'STREAMING ONLY',
        }));

        return { provider: this.id, tracks, albums };
      } catch {
        // Fall through cleanly to public iTunes endpoint
      }
    }

    try {
      const langTerm =
        language && language !== 'All' && language !== 'English'
          ? `${query} ${language}`
          : query;
      const [songRes, albumRes] = await Promise.all([
        fetchJson<ITunesSearchResponse>(
          `https://itunes.apple.com/search?term=${encodeURIComponent(
            langTerm,
          )}&country=${country}&entity=song&limit=${Math.min(limit, 25)}`,
          { cacheKey: `itunes-songs:${country}:${langTerm}:${limit}` },
        ),
        fetchJson<ITunesSearchResponse>(
          `https://itunes.apple.com/search?term=${encodeURIComponent(
            langTerm,
          )}&country=${country}&entity=album&limit=${Math.min(12, limit)}`,
          { cacheKey: `itunes-albums:${country}:${langTerm}:${limit}` },
        ),
      ]);

      const langHint = language && language !== 'All' ? language : undefined;
      return {
        provider: this.id,
        tracks: songRes.results.map((r, idx) => mapITunesTrack(r, region, langHint, idx)),
        albums: albumRes.results.map((r) => mapITunesAlbum(r, region, langHint)),
      };
    } catch (err) {
      return {
        provider: this.id,
        tracks: [],
        albums: [],
        warning: `Apple/iTunes discovery unavailable: ${
          err instanceof Error ? err.message : 'Network error'
        }`,
      };
    }
  }

  async getTrending(
    region: 'global' | 'india',
    _credentials?: ProviderCredentials,
  ): Promise<ProviderSearchResult> {
    const country = region === 'india' ? 'in' : 'us';
    const seedQuery =
      region === 'india'
        ? 'Anirudh Ravichander Sushin Shyam Karan Aujla'
        : 'The Weeknd Dua Lipa Kendrick Lamar Billie Eilish';

    try {
      const [songRes, albumRes] = await Promise.all([
        fetchJson<ITunesSearchResponse>(
          `https://itunes.apple.com/search?term=${encodeURIComponent(
            seedQuery,
          )}&country=${country}&entity=song&limit=20`,
          {
            cacheKey: `itunes-trending-songs:${region}`,
            cacheTtlMs: 1000 * 60 * 30,
          },
        ),
        fetchJson<ITunesSearchResponse>(
          `https://itunes.apple.com/search?term=${encodeURIComponent(
            seedQuery,
          )}&country=${country}&entity=album&limit=12`,
          {
            cacheKey: `itunes-trending-albums:${region}`,
            cacheTtlMs: 1000 * 60 * 30,
          },
        ),
      ]);

      const tracks = songRes.results.map((r, idx) =>
        mapITunesTrack(r, region, undefined, idx),
      );
      const albums = albumRes.results.map((r) => mapITunesAlbum(r, region));
      return { provider: this.id, tracks, albums };
    } catch (err) {
      return {
        provider: this.id,
        tracks: region === 'india' ? SAMPLE_INDIA_TRACKS : SAMPLE_GLOBAL_TRACKS,
        albums: [],
        warning: `Showing sample metadata (live Apple discovery failed: ${
          err instanceof Error ? err.message : 'Network error'
        })`,
      };
    }
  }

  async getArtistReleases(
    artistName: string,
    languageHint?: MusicLanguage,
  ): Promise<{ albums: Album[]; tracks: Track[]; warning?: string }> {
    const country =
      languageHint && ['Hindi', 'Malayalam', 'Tamil'].includes(languageHint) ? 'in' : 'us';
    const region: 'global' | 'india' = country === 'in' ? 'india' : 'global';

    try {
      const [albumRes, songRes] = await Promise.all([
        fetchJson<ITunesSearchResponse>(
          `https://itunes.apple.com/search?term=${encodeURIComponent(
            artistName,
          )}&country=${country}&entity=album&attribute=artistTerm&limit=12`,
          { cacheKey: `itunes-artist-albums:${country}:${artistName}` },
        ),
        fetchJson<ITunesSearchResponse>(
          `https://itunes.apple.com/search?term=${encodeURIComponent(
            artistName,
          )}&country=${country}&entity=song&attribute=artistTerm&limit=15`,
          { cacheKey: `itunes-artist-songs:${country}:${artistName}` },
        ),
      ]);

      const albums = albumRes.results
        .map((r) => mapITunesAlbum(r, region, languageHint))
        .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''));

      const tracks = songRes.results
        .map((r, idx) => mapITunesTrack(r, region, languageHint, idx))
        .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''));

      return { albums, tracks };
    } catch (err) {
      return {
        albums: [],
        tracks: [],
        warning: err instanceof Error ? err.message : 'Failed to fetch artist releases',
      };
    }
  }

  async getAlbumTracks(albumId: string): Promise<Track[]> {
    const rawId = albumId.replace(/^apple-album-/, '');
    if (!/^\d+$/.test(rawId)) return [];

    try {
      const res = await fetchJson<ITunesSearchResponse>(
        `https://itunes.apple.com/lookup?id=${rawId}&entity=song`,
        { cacheKey: `itunes-album-lookup:${rawId}` },
      );
      return res.results
        .filter((r) => r.wrapperType === 'track')
        .map((r, idx) => mapITunesTrack(r, 'global', undefined, idx));
    } catch {
      return [];
    }
  }

  async checkHealth(): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetchJson<ITunesSearchResponse>(
        'https://itunes.apple.com/search?term=dua+lipa&entity=song&limit=1',
        { timeoutMs: 6000 },
      );
      return {
        ok: res.resultCount >= 0,
        message: 'Public iTunes catalog online (30s previews / metadata only)',
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Unreachable',
      };
    }
  }
}

export const appleMusicProvider = new AppleMusicProvider();
