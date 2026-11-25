import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  InputAdornment,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  CloudDownload as DownloadAllIcon,
  PlaylistAdd as PlaylistIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/store/hooks';
import { store } from '../../app/store/store';
import { DuplicateWarningDialog } from '../../components/downloads/DuplicateWarningDialog';
import { FilteredBatchDownloader } from '../../components/downloads/FilteredBatchDownloader';
import { SkeletonTable } from '../../components/music/SkeletonGrid';
import { TrackTable } from '../../components/music/TrackTable';
import { useDebounce } from '../../hooks/useDebounce';
import { addTrackToPlaylist, cacheTracks } from '../library/librarySlice';
import {
  checkDuplicateDownloads,
  enqueueTracksForDownload,
  type DuplicateCheckResult,
} from '../../services/api/downloadManager';
import { internetArchiveProvider } from '../../services/providers/internet-archive/internetArchiveProvider';
import { jamendoProvider } from '../../services/providers/jamendo/jamendoProvider';
import type { Track } from '../../types/music';

const FREE_GENRE_CHIPS = [
  'All',
  'Electronic',
  'Ambient',
  'Rock',
  'Hip-Hop',
  'Jazz',
  'Classical',
  'Instrumental',
  'World',
];

export const FreeMusicPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const credentials = useAppSelector((s) => s.settings.credentials);
  const defaultPlaylistId = useAppSelector((s) => s.settings.defaultPlaylistId);

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 400);
  const [genre, setGenre] = useState('All');
  const [providerFilter, setProviderFilter] = useState<'both' | 'jamendo' | 'internet-archive'>('both');
  const [page, setPage] = useState(1);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [dupReport, setDupReport] = useState<DuplicateCheckResult | null>(null);
  const [dupOpen, setDupOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadFreeTracks = async () => {
      setLoading(true);
      const nextWarnings: string[] = [];
      const searchQ =
        debouncedQuery.trim() || (genre !== 'All' ? genre : 'music');

      const tasks = [];
      if (providerFilter === 'both' || providerFilter === 'jamendo') {
        tasks.push(
          jamendoProvider.search({
            query: debouncedQuery.trim(),
            genre: genre === 'All' ? undefined : genre,
            page,
            limit: 20,
            filter: 'free-download',
            credentials,
          }),
        );
      }
      if (providerFilter === 'both' || providerFilter === 'internet-archive') {
        tasks.push(
          internetArchiveProvider.search({
            query: searchQ,
            page,
            limit: 12,
            filter: 'free-download',
            credentials,
          }),
        );
      }

      const results = await Promise.all(tasks);
      if (cancelled) return;

      const verifiedTracks: Track[] = [];
      for (const res of results) {
        if (res.warning) nextWarnings.push(res.warning);
        for (const t of res.tracks) {
          if (t.availability === 'FREE DOWNLOAD AVAILABLE' && t.downloadInfo?.verified) {
            verifiedTracks.push(t);
          }
        }
      }

      setTracks(verifiedTracks);
      setWarnings(nextWarnings);
      dispatch(cacheTracks(verifiedTracks));
      setLoading(false);
    };

    void loadFreeTracks();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, genre, providerFilter, page, credentials, dispatch]);

  const handleQueueAll = () => {
    const report = checkDuplicateDownloads(tracks, store.getState());
    if (report.duplicates.length > 0) {
      setDupReport(report);
      setDupOpen(true);
      return;
    }

    const { queuedCount } = enqueueTracksForDownload(
      tracks,
      dispatch,
      store.getState,
    );
    setStatusMessage(
      `Queued ${queuedCount} authorised MP3 download(s). View progress in Downloads.`,
    );
  };

  const handleAddAllToCollection = () => {
    tracks.forEach((track) => {
      dispatch(addTrackToPlaylist({ playlistId: defaultPlaylistId, track }));
    });
    setStatusMessage(`Added ${tracks.length} tracks to Saved Collection.`);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4">Discover Free Music</Typography>
          <Typography variant="body2" color="text.secondary">
            Only tracks with verified Creative Commons / Public Domain / artist-authorised MP3 downloads are listed here.
          </Typography>
        </Box>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          <Button
            variant="outlined"
            startIcon={<PlaylistIcon />}
            disabled={tracks.length === 0}
            onClick={handleAddAllToCollection}
          >
            Save All ({tracks.length})
          </Button>
          <Button
            variant="contained"
            startIcon={<DownloadAllIcon />}
            disabled={tracks.length === 0}
            onClick={handleQueueAll}
          >
            Download All ({tracks.length})
          </Button>
        </Stack>
      </Box>

      <FilteredBatchDownloader
        onResultsLoaded={(loaded) => {
          setTracks(loaded);
          dispatch(cacheTracks(loaded));
        }}
      />

      {!jamendoProvider.isConfigured(credentials) && (
        <Alert
          severity="warning"
          action={
            <Button
              color="inherit"
              size="small"
              startIcon={<SettingsIcon />}
              onClick={() => navigate('/settings')}
            >
              Add My Client ID
            </Button>
          }
        >
          Your Jamendo Client ID is not configured — showing live Internet Archive CC/Public Domain MP3s right now. Enter your own free Jamendo Client ID in Settings to unlock Jamendo downloads too.
        </Alert>
      )}

      {statusMessage && (
        <Alert severity="success" onClose={() => setStatusMessage(null)}>
          {statusMessage}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between">
        <TextField
          size="small"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search free CC tracks (e.g. lo-fi, acoustic, ambient, classical)..."
          sx={{ flex: 1, maxWidth: 460 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <Stack direction="row" gap={1} flexWrap="wrap">
          <Chip
            label="All Free Providers"
            color={providerFilter === 'both' ? 'primary' : 'default'}
            onClick={() => {
              setProviderFilter('both');
              setPage(1);
            }}
          />
          <Chip
            label="Jamendo"
            color={providerFilter === 'jamendo' ? 'primary' : 'default'}
            onClick={() => {
              setProviderFilter('jamendo');
              setPage(1);
            }}
          />
          <Chip
            label="Internet Archive"
            color={providerFilter === 'internet-archive' ? 'primary' : 'default'}
            onClick={() => {
              setProviderFilter('internet-archive');
              setPage(1);
            }}
          />
        </Stack>
      </Stack>

      <Stack direction="row" flexWrap="wrap" gap={1}>
        {FREE_GENRE_CHIPS.map((g) => (
          <Chip
            key={g}
            label={g}
            size="small"
            variant={genre === g ? 'filled' : 'outlined'}
            color={genre === g ? 'secondary' : 'default'}
            onClick={() => {
              setGenre(g);
              setPage(1);
            }}
          />
        ))}
      </Stack>

      {warnings.length > 0 && jamendoProvider.isConfigured(credentials) && (
        <Alert severity="info">{warnings[0]}</Alert>
      )}

      {loading ? (
        <SkeletonTable rows={8} />
      ) : (
        <TrackTable
          tracks={tracks}
          emptyMessage="No verified free MP3s found for this query. Try another genre or keyword."
        />
      )}

      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Pagination
          count={10}
          page={page}
          onChange={(_, p) => setPage(p)}
          color="primary"
        />
      </Box>

      <DuplicateWarningDialog
        open={dupOpen}
        report={dupReport}
        onClose={() => setDupOpen(false)}
        onSkipDuplicates={() => {
          if (dupReport && dupReport.freshTracks.length > 0) {
            const { queuedCount } = enqueueTracksForDownload(
              dupReport.freshTracks,
              dispatch,
              store.getState,
            );
            setStatusMessage(
              `Skipped ${dupReport.duplicates.length} duplicate(s) and queued ${queuedCount} new MP3(s).`,
            );
          }
          setDupOpen(false);
        }}
        onDownloadAllAnyway={() => {
          const { queuedCount } = enqueueTracksForDownload(
            tracks,
            dispatch,
            store.getState,
            { allowDuplicates: true },
          );
          setStatusMessage(`Queued ${queuedCount} MP3 download(s) (duplicates allowed).`);
          setDupOpen(false);
        }}
      />
    </Box>
  );
};
