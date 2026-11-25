import type {
  Album,
  MusicLanguage,
  ProviderCredentials,
  ProviderId,
  ProviderStatus,
  Track,
} from '../../types/music';
import type { SearchQueryParams } from '../../types/provider';
import { appleMusicProvider } from './apple-music/appleMusicProvider';
import { bandcampProvider } from './bandcamp/bandcampProvider';
import { internetArchiveProvider } from './internet-archive/internetArchiveProvider';
import { jamendoProvider } from './jamendo/jamendoProvider';
import { musicBrainzProvider } from './musicbrainz/musicBrainzProvider';
import { soundCloudProvider } from './soundcloud/soundcloudProvider';
import { spotifyProvider } from './spotify/spotifyProvider';

export const ALL_PROVIDERS = [
  jamendoProvider,
  internetArchiveProvider,
  appleMusicProvider,
  musicBrainzProvider,
  spotifyProvider,
  soundCloudProvider,
  bandcampProvider,
];

export interface AggregatedSearchResponse {
  tracks: Track[];
  albums: Album[];
  warnings: string[];
  activeProviders: ProviderId[];
}

function filterAndSortTracks(
  tracks: Track[],
  params: SearchQueryParams,
): Track[] {
  let result = tracks;

  if (params.language && params.language !== 'All') {
    result = result.filter(
      (t) =>
        t.language === params.language ||
        t.provider === 'jamendo' ||
        t.provider === 'internet-archive',
    );
  }

  if (params.genre && params.genre !== 'All') {
    const g = params.genre.toLowerCase();
    result = result.filter((t) => (t.genre ?? '').toLowerCase().includes(g));
  }

  if (params.filter === 'free-download') {
    result = result.filter(
      (t) => t.availability === 'FREE DOWNLOAD AVAILABLE' && t.downloadInfo?.verified,
    );
  } else if (params.filter === 'streaming-only') {
    result = result.filter((t) => t.availability === 'STREAMING ONLY');
  }

  if (params.filter === 'latest') {
    result = [...result].sort((a, b) =>
      (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''),
    );
  } else if (params.filter === 'popular') {
    result = [...result].sort(
      (a, b) => (b.popularityScore ?? 0) - (a.popularityScore ?? 0),
    );
  }

  return result;
}

export async function runUnifiedSearch(
  params: SearchQueryParams,
  selectedProviders?: ProviderId[],
): Promise<AggregatedSearchResponse> {
  const targetIds: ProviderId[] =
    selectedProviders && selectedProviders.length > 0
      ? selectedProviders
      : ['jamendo', 'internet-archive', 'apple-music', 'musicbrainz'];

  const adapters = ALL_PROVIDERS.filter((p) => targetIds.includes(p.id));
  const results = await Promise.all(adapters.map((adapter) => adapter.search(params)));

  const allTracks: Track[] = [];
  const allAlbums: Album[] = [];
  const warnings: string[] = [];

  for (const res of results) {
    allTracks.push(...res.tracks);
    allAlbums.push(...res.albums);
    if (res.warning) {
      warnings.push(res.warning);
    }
  }

  return {
    tracks: filterAndSortTracks(allTracks, params),
    albums: allAlbums,
    warnings,
    activeProviders: targetIds,
  };
}

export async function fetchArtistLiveCatalog(
  artistName: string,
  languageHint: MusicLanguage,
  credentials?: ProviderCredentials,
): Promise<{ albums: Album[]; tracks: Track[]; warnings: string[] }> {
  const warnings: string[] = [];

  const [appleRes, mbRes, iaRes, jamendoRes] = await Promise.all([
    appleMusicProvider.getArtistReleases(artistName, languageHint),
    musicBrainzProvider.getArtistReleases(artistName, languageHint),
    internetArchiveProvider.search({
      query: artistName,
      language: languageHint,
      limit: 6,
      credentials,
    }),
    jamendoProvider.isConfigured(credentials)
      ? jamendoProvider.search({
          query: artistName,
          language: languageHint,
          limit: 6,
          credentials,
        })
      : Promise.resolve({ provider: 'jamendo' as const, tracks: [], albums: [] }),
  ]);

  if (appleRes.warning) warnings.push(`Apple Music: ${appleRes.warning}`);
  if (mbRes.warning) warnings.push(`MusicBrainz: ${mbRes.warning}`);
  if (iaRes.warning) warnings.push(`Internet Archive: ${iaRes.warning}`);

  const combinedAlbums = [...appleRes.albums, ...mbRes.albums, ...jamendoRes.albums];
  const combinedTracks = [...jamendoRes.tracks, ...iaRes.tracks, ...appleRes.tracks];

  return {
    albums: combinedAlbums,
    tracks: combinedTracks,
    warnings,
  };
}

export async function fetchAlbumTracklist(
  album: Album,
  credentials?: ProviderCredentials,
): Promise<Track[]> {
  if (album.provider === 'apple-music') {
    return appleMusicProvider.getAlbumTracks(album.id);
  }
  if (album.provider === 'musicbrainz') {
    return musicBrainzProvider.getAlbumTracks(album.id);
  }
  if (album.provider === 'jamendo') {
    return jamendoProvider.getAlbumTracks(album.id, credentials);
  }
  return album.tracks ?? [];
}

export async function checkAllProvidersHealth(
  credentials?: ProviderCredentials,
): Promise<ProviderStatus[]> {
  const now = new Date().toISOString();

  const statuses = await Promise.all(
    ALL_PROVIDERS.map(async (provider): Promise<ProviderStatus> => {
      const configured = provider.isConfigured(credentials);
      let reachable: ProviderStatus['reachable'] = configured ? 'unknown' : 'requires-config';
      let note = '';

      if (provider.checkHealth) {
        const health = await provider.checkHealth(credentials);
        reachable = health.ok ? 'online' : configured ? 'degraded' : 'requires-config';
        note = health.message;
      }

      const role: ProviderStatus['role'] = provider.supportsAuthorisedDownloads
        ? 'free-downloads'
        : provider.id === 'musicbrainz'
          ? 'metadata'
          : 'discovery';

      return {
        id: provider.id,
        name: provider.displayName,
        role,
        configured,
        reachable,
        supportsDownloads: provider.supportsAuthorisedDownloads,
        note,
        lastCheckedAt: now,
      };
    }),
  );

  return statuses;
}
