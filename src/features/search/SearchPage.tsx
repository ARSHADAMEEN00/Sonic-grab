import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  Grid2,
  InputAdornment,
  MenuItem,
  Pagination,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/store/hooks';
import { AlbumCard } from '../../components/albums/AlbumCard';
import { AlbumDetailsDialog } from '../../components/albums/AlbumDetailsDialog';
import { SkeletonGrid, SkeletonTable } from '../../components/music/SkeletonGrid';
import { TrackTable } from '../../components/music/TrackTable';
import { useDebounce } from '../../hooks/useDebounce';
import { cacheTracks } from '../library/librarySlice';
import { runUnifiedSearch } from '../../services/providers/providerRegistry';
import type { Album, MusicLanguage, ProviderId, Track } from '../../types/music';

const LANGUAGES: Array<{ label: string; value: MusicLanguage | 'All' }> = [
  { label: 'All Languages', value: 'All' },
  { label: 'International / English', value: 'English' },
  { label: 'Malayalam', value: 'Malayalam' },
  { label: 'Hindi', value: 'Hindi' },
  { label: 'Tamil', value: 'Tamil' },
  { label: 'Arabic', value: 'Arabic' },
];

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  const credentials = useAppSelector((s) => s.settings.credentials);

  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const debouncedQuery = useDebounce(query, 420);
  const [searchBy, setSearchBy] = useState<'all' | 'song' | 'artist' | 'album'>('all');
  const [language, setLanguage] = useState<MusicLanguage | 'All'>('All');
  const [genre, setGenre] = useState('All');
  const [sortFilter, setSortFilter] = useState<
    'all' | 'latest' | 'popular' | 'free-download' | 'streaming-only'
  >('all');
  const [resultTab, setResultTab] = useState<'downloads' | 'discovery' | 'albums'>('downloads');
  const [page, setPage] = useState(1);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

  useEffect(() => {
    const paramQ = searchParams.get('q');
    if (paramQ !== null && paramQ !== query) {
      setQuery(paramQ);
    }
  }, [searchParams]);

  useEffect(() => {
    const term = debouncedQuery.trim();
    if (!term) {
      setTracks([]);
      setAlbums([]);
      setWarnings([]);
      return;
    }

    let cancelled = false;
    const executeSearch = async () => {
      setLoading(true);
      const activeProviders: ProviderId[] = [
        'jamendo',
        'internet-archive',
        'apple-music',
        'musicbrainz',
      ];
      if (credentials.spotifyAccessToken.trim()) {
        activeProviders.push('spotify');
      }
      if (credentials.soundcloudClientId.trim()) {
        activeProviders.push('soundcloud');
      }

      const res = await runUnifiedSearch(
        {
          query: term,
          type: searchBy,
          language,
          genre: genre === 'All' ? undefined : genre,
          filter: sortFilter,
          page,
          limit: 16,
          credentials,
        },
        activeProviders,
      );

      if (cancelled) return;
      setTracks(res.tracks);
      setAlbums(res.albums);
      setWarnings(res.warnings);
      dispatch(cacheTracks(res.tracks));
      setLoading(false);
    };

    void executeSearch();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, searchBy, language, genre, sortFilter, page, credentials, dispatch]);

  const downloadableTracks = tracks.filter(
    (t) => t.availability === 'FREE DOWNLOAD AVAILABLE' && t.downloadInfo?.verified,
  );
  const discoveryTracks = tracks.filter(
    (t) => t.availability !== 'FREE DOWNLOAD AVAILABLE',
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h4">Unified Music Search</Typography>
        <Typography variant="body2" color="text.secondary">
          Search across discovery catalogues and free legal MP3 providers. Downloadable MP3s are strictly separated from streaming-only metadata.
        </Typography>
      </Box>

      <Grid2 container spacing={2}>
        <Grid2 size={{ xs: 12, md: 5 }}>
          <TextField
            fullWidth
            size="small"
            value={query}
            onChange={(e) => {
              const val = e.target.value;
              setQuery(val);
              setPage(1);
              setSearchParams(val.trim() ? { q: val } : {});
            }}
            placeholder="Search song, artist, album, or keyword..."
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </Grid2>
        <Grid2 size={{ xs: 6, sm: 3, md: 2 }}>
          <TextField
            select
            fullWidth
            size="small"
            label="Search By"
            value={searchBy}
            onChange={(e) => setSearchBy(e.target.value as typeof searchBy)}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="song">Song</MenuItem>
            <MenuItem value="artist">Artist</MenuItem>
            <MenuItem value="album">Album</MenuItem>
          </TextField>
        </Grid2>
        <Grid2 size={{ xs: 6, sm: 3, md: 2.5 }}>
          <TextField
            select
            fullWidth
            size="small"
            label="Language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as MusicLanguage | 'All')}
          >
            {LANGUAGES.map((l) => (
              <MenuItem key={l.value} value={l.value}>
                {l.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid2>
        <Grid2 size={{ xs: 12, sm: 6, md: 2.5 }}>
          <TextField
            select
            fullWidth
            size="small"
            label="Filter / Sort"
            value={sortFilter}
            onChange={(e) => setSortFilter(e.target.value as typeof sortFilter)}
          >
            <MenuItem value="all">All Results</MenuItem>
            <MenuItem value="free-download">Free Downloadable Only</MenuItem>
            <MenuItem value="streaming-only">Streaming Only</MenuItem>
            <MenuItem value="latest">Latest Releases</MenuItem>
            <MenuItem value="popular">Popularity</MenuItem>
          </TextField>
        </Grid2>
      </Grid2>

      <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
        <Typography variant="caption" color="text.secondary">
          Genre filter:
        </Typography>
        {['All', 'Pop', 'Hip-Hop', 'Rock', 'Electronic', 'Film', 'Classical', 'Ambient'].map((g) => (
          <Chip
            key={g}
            label={g}
            size="small"
            color={genre === g ? 'primary' : 'default'}
            variant={genre === g ? 'filled' : 'outlined'}
            onClick={() => setGenre(g)}
          />
        ))}
      </Stack>

      {warnings.length > 0 && (
        <Alert severity="info">{warnings[0]}</Alert>
      )}

      {!debouncedQuery.trim() ? (
        <Alert severity="info" variant="outlined">
          Enter a song, artist (e.g. <strong>Dua Lipa</strong>, <strong>Sushin Shyam</strong>,{' '}
          <strong>Anirudh Ravichander</strong>), or genre (e.g. <strong>ambient</strong>,{' '}
          <strong>acoustic</strong>) to search live metadata and authorised free MP3s.
        </Alert>
      ) : (
        <>
          <Tabs
            value={resultTab}
            onChange={(_, v) => setResultTab(v as typeof resultTab)}
          >
            <Tab
              label={`Free Download Results (${downloadableTracks.length})`}
              value="downloads"
            />
            <Tab
              label={`Music Discovery Results (${discoveryTracks.length})`}
              value="discovery"
            />
            <Tab label={`Albums (${albums.length})`} value="albums" />
          </Tabs>

          {loading ? (
            resultTab === 'albums' ? <SkeletonGrid count={8} /> : <SkeletonTable rows={6} />
          ) : resultTab === 'downloads' ? (
            <TrackTable
              tracks={downloadableTracks}
              emptyMessage="No authorised free MP3 downloads matched this query. Check Discovery Results or try Jamendo / Internet Archive keywords."
            />
          ) : resultTab === 'discovery' ? (
            <TrackTable
              tracks={discoveryTracks}
              emptyMessage="No discovery metadata matched this query."
            />
          ) : (
            <Grid2 container spacing={2}>
              {albums.map((album) => (
                <Grid2 key={album.id} size={{ xs: 12, sm: 6, md: 3 }}>
                  <AlbumCard album={album} onSelect={setSelectedAlbum} />
                </Grid2>
              ))}
            </Grid2>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Pagination count={5} page={page} onChange={(_, p) => setPage(p)} color="primary" />
          </Box>
        </>
      )}

      <AlbumDetailsDialog album={selectedAlbum} onClose={() => setSelectedAlbum(null)} />
    </Box>
  );
};
