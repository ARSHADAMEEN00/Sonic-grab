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

interface ArchiveDoc {
  identifier: string;
  title?: string | string[];
  creator?: string | string[];
  date?: string;
  licenseurl?: string;
  rights?: string | string[];
  downloads?: number;
  subject?: string | string[];
}

interface ArchiveSearchResponse {
  response?: {
    numFound: number;
    docs: ArchiveDoc[];
  };
}

interface ArchiveFileEntry {
  name: string;
  source?: string;
  format?: string;
  size?: string;
  length?: string;
  bitrate?: string;
  title?: string;
  artist?: string;
  album?: string;
}

interface ArchiveMetadataResponse {
  metadata?: {
    identifier?: string;
    title?: string;
    creator?: string | string[];
    date?: string;
    licenseurl?: string;
    rights?: string | string[];
  };
  files?: ArchiveFileEntry[];
}

const ARCHIVE_BASE = 'https://archive.org';

function asString(value?: string | string[]): string {
  if (!value) return '';
  return Array.isArray(value) ? value.join(', ') : value;
}

function parseLicenceStatus(
  licenseUrl?: string,
  rightsText?: string,
): { verified: boolean; label: string; url?: string } {
  const lic = (licenseUrl ?? '').toLowerCase();
  const rights = (rightsText ?? '').toLowerCase();

  if (lic.includes('creativecommons.org/publicdomain') || rights.includes('public domain')) {
    return {
      verified: true,
      label: 'Public Domain / CC0',
      url: licenseUrl || 'https://creativecommons.org/publicdomain/zero/1.0/',
    };
  }

  if (lic.includes('creativecommons.org/licenses/')) {
    const match = lic.match(/licenses\/([^/]+)\/([^/]+)/);
    const label = match
      ? `CC ${match[1].toUpperCase()} ${match[2]}`
      : 'Creative Commons';
    return { verified: true, label, url: licenseUrl };
  }

  if (
    rights.includes('creative commons') ||
    rights.includes('free to share') ||
    rights.includes('no known copyright')
  ) {
    return {
      verified: true,
      label: rightsText || 'Open Licence',
      url: licenseUrl,
    };
  }

  return {
    verified: false,
    label: rightsText || 'Rights Not Verified',
    url: licenseUrl,
  };
}

function pickBestMp3File(files: ArchiveFileEntry[] = []): ArchiveFileEntry | undefined {
  const mp3Files = files.filter((f) => {
    const nameLower = f.name.toLowerCase();
    const fmt = (f.format ?? '').toLowerCase();
    return (
      nameLower.endsWith('.mp3') &&
      !nameLower.includes('_64kb') &&
      (fmt.includes('mp3') || nameLower.endsWith('.mp3'))
    );
  });

  if (mp3Files.length === 0) return undefined;

  // Prefer VBR MP3 or explicit original MP3
  return (
    mp3Files.find((f) => (f.format ?? '').toLowerCase() === 'vbr mp3') ??
    mp3Files.find((f) => f.source === 'original') ??
    mp3Files[0]
  );
}

function inferArchiveLanguage(subject?: string | string[], fallback: MusicLanguage = 'English'): MusicLanguage {
  const text = asString(subject).toLowerCase();
  if (text.includes('malayalam')) return 'Malayalam';
  if (text.includes('hindi')) return 'Hindi';
  if (text.includes('tamil')) return 'Tamil';
  if (text.includes('arabic')) return 'Arabic';
  return fallback;
}

export class InternetArchiveProvider implements MusicProviderAdapter {
  readonly id = 'internet-archive' as const;
  readonly displayName = 'Internet Archive';
  readonly supportsAuthorisedDownloads = true;
  readonly requiresCredentials = false;

  isConfigured(_credentials?: ProviderCredentials): boolean {
    return true;
  }

  verifyDownloadAvailability(track: Track): DownloadAvailability {
    if (track.downloadInfo?.verified && track.downloadInfo?.downloadUrl) {
      return 'FREE DOWNLOAD AVAILABLE';
    }
    return 'DOWNLOAD NOT VERIFIED';
  }

  async search(params: SearchQueryParams): Promise<ProviderSearchResult> {
    const { query, artistName, genre, language, page = 1, limit = 12, filter } = params;
    const langHint: MusicLanguage =
      language && language !== 'All' ? language : 'English';
    const clampedLimit = Math.min(Math.max(1, limit), 30);

    const cleanQuery = query.trim();
    const cleanArtist = artistName?.trim();
    const cleanGenre = genre && genre !== 'All' ? genre.trim() : '';

    const licenceFilter =
      '(licenseurl:*creativecommons* OR licenseurl:*publicdomain* OR rights:"Creative Commons" OR rights:"Public Domain")';
    const musicFilter =
      '(collection:netlabels OR collection:audio_music OR collection:opensource_audio OR subject:music OR subject:song OR subject:soundtrack)';

    const clauses = [
      'mediatype:audio',
      'format:("VBR MP3" OR "MP3")',
      licenceFilter,
      musicFilter,
    ];
    if (cleanArtist) {
      clauses.push(`creator:("${cleanArtist.replace(/"/g, '')}")`);
    }
    if (cleanGenre) {
      clauses.push(`subject:(${cleanGenre})`);
    }
    if (cleanQuery && cleanQuery.toLowerCase() !== 'music') {
      clauses.push(`(${cleanQuery})`);
    }
    const baseClause = clauses.join(' AND ');

    const searchUrl = new URL(`${ARCHIVE_BASE}/advancedsearch.php`);
    searchUrl.searchParams.set('q', baseClause);
    searchUrl.searchParams.append('fl[]', 'identifier');
    searchUrl.searchParams.append('fl[]', 'title');
    searchUrl.searchParams.append('fl[]', 'creator');
    searchUrl.searchParams.append('fl[]', 'date');
    searchUrl.searchParams.append('fl[]', 'licenseurl');
    searchUrl.searchParams.append('fl[]', 'rights');
    searchUrl.searchParams.append('fl[]', 'downloads');
    searchUrl.searchParams.append('fl[]', 'subject');
    searchUrl.searchParams.append(
      'sort[]',
      filter === 'latest' ? 'date desc' : 'downloads desc',
    );
    searchUrl.searchParams.set('rows', String(clampedLimit));
    searchUrl.searchParams.set('page', String(page));
    searchUrl.searchParams.set('output', 'json');

    try {
      const searchRes = await fetchJson<ArchiveSearchResponse>(searchUrl.toString(), {
        cacheKey: `ia-search:${baseClause}:${filter ?? 'pop'}:${page}:${clampedLimit}`,
        cacheTtlMs: 1000 * 60 * 20,
      });

      const docs = searchRes.response?.docs ?? [];
      const inspected = await Promise.all(
        docs.slice(0, clampedLimit).map((doc) => this.inspectItem(doc, langHint)),
      );

      const tracks: Track[] = [];
      const albums: Album[] = [];
      for (const result of inspected) {
        if (result.track) tracks.push(result.track);
        if (result.album) albums.push(result.album);
      }

      return {
        provider: this.id,
        tracks,
        albums,
        totalEstimate: searchRes.response?.numFound,
      };
    } catch (err) {
      return {
        provider: this.id,
        tracks: [],
        albums: [],
        warning: `Internet Archive search unavailable: ${
          err instanceof Error ? err.message : 'Network error'
        }`,
      };
    }
  }

  private async inspectItem(
    doc: ArchiveDoc,
    langHint: MusicLanguage,
  ): Promise<{ track?: Track; album?: Album }> {
    try {
      const meta = await fetchJson<ArchiveMetadataResponse>(
        `${ARCHIVE_BASE}/metadata/${encodeURIComponent(doc.identifier)}`,
        {
          cacheKey: `ia-meta:${doc.identifier}`,
          cacheTtlMs: 1000 * 60 * 60,
          rateLimitKey: 'internet-archive',
          minIntervalMs: 180,
        },
      );

      const licenseUrl = meta.metadata?.licenseurl ?? doc.licenseurl;
      const rightsText = asString(meta.metadata?.rights ?? doc.rights);
      const licenceInfo = parseLicenceStatus(licenseUrl, rightsText);
      const mp3File = pickBestMp3File(meta.files);

      // Requirement: Only display Internet Archive items with actual downloadable MP3 + verifiable rights
      if (!mp3File || !licenceInfo.verified) {
        return {};
      }

      const itemTitle = asString(meta.metadata?.title ?? doc.title) || doc.identifier;
      const creator =
        asString(meta.metadata?.creator ?? doc.creator) || 'Internet Archive Creator';
      const sourcePageUrl = `${ARCHIVE_BASE}/details/${encodeURIComponent(doc.identifier)}`;
      const downloadUrl = `${ARCHIVE_BASE}/download/${encodeURIComponent(
        doc.identifier,
      )}/${mp3File.name.split('/').map(encodeURIComponent).join('/')}`;
      const sizeBytes = mp3File.size ? Number.parseInt(mp3File.size, 10) : undefined;
      const durationSec = mp3File.length
        ? Math.round(Number.parseFloat(mp3File.length))
        : undefined;
      const language = inferArchiveLanguage(doc.subject, langHint);
      const artworkUrl = `${ARCHIVE_BASE}/services/img/${encodeURIComponent(doc.identifier)}`;

      const track: Track = {
        id: `ia-${doc.identifier}-${mp3File.name}`,
        title: mp3File.title || itemTitle,
        artist: mp3File.artist || creator,
        album: mp3File.album || itemTitle,
        albumId: `ia-album-${doc.identifier}`,
        durationSec: Number.isFinite(durationSec) ? durationSec : undefined,
        releaseDate: (meta.metadata?.date ?? doc.date)?.slice(0, 10),
        genre: asString(doc.subject).split(',')[0]?.trim() || 'Open Audio',
        language,
        artworkUrl,
        previewUrl: downloadUrl,
        sourceUrl: sourcePageUrl,
        provider: 'internet-archive',
        availability: 'FREE DOWNLOAD AVAILABLE',
        popularityScore: Math.min(100, Math.round((doc.downloads ?? 100) / 100)),
        downloadInfo: {
          verified: true,
          provider: 'internet-archive',
          providerName: 'Internet Archive',
          licence: licenceInfo.label,
          licenceUrl: licenceInfo.url,
          format: mp3File.format || 'MP3',
          fileSizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : undefined,
          audioQuality: mp3File.bitrate ? `${mp3File.bitrate} kbps MP3` : mp3File.format || 'MP3',
          downloadUrl,
          sourcePageUrl,
          corsDownloadSupported: true,
        },
      };

      const mp3Count = (meta.files ?? []).filter((f) =>
        f.name.toLowerCase().endsWith('.mp3'),
      ).length;

      const album: Album = {
        id: `ia-album-${doc.identifier}`,
        title: itemTitle,
        artist: creator,
        releaseDate: (meta.metadata?.date ?? doc.date)?.slice(0, 10),
        genre: track.genre,
        language,
        artworkUrl,
        trackCount: mp3Count,
        sourceUrl: sourcePageUrl,
        provider: 'internet-archive',
        availability: 'FREE DOWNLOAD AVAILABLE',
      };

      return { track, album };
    } catch {
      return {};
    }
  }

  async getPopularFreeAudio(limit = 8): Promise<ProviderSearchResult> {
    return this.search({
      query: 'music',
      limit,
      filter: 'free-download',
    });
  }

  async checkHealth(): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetchJson<ArchiveSearchResponse>(
        `${ARCHIVE_BASE}/advancedsearch.php?q=mediatype:audio&rows=1&output=json`,
        { timeoutMs: 7000 },
      );
      return {
        ok: Boolean(res.response),
        message: 'Internet Archive API online (CC / Public Domain MP3s available)',
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Unreachable',
      };
    }
  }
}

export const internetArchiveProvider = new InternetArchiveProvider();
