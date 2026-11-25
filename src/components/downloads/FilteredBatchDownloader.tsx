import React, { useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Grid2,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import {
  CloudDownload as DownloadIcon,
  FilterAlt as FilterIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../app/store/hooks';
import { store } from '../../app/store/store';
import {
  checkDuplicateDownloads,
  enqueueTracksForDownload,
  type DuplicateCheckResult,
} from '../../services/api/downloadManager';
import { appleMusicProvider } from '../../services/providers/apple-music/appleMusicProvider';
import { internetArchiveProvider } from '../../services/providers/internet-archive/internetArchiveProvider';
import { jamendoProvider } from '../../services/providers/jamendo/jamendoProvider';
import type { Track } from '../../types/music';
import { DuplicateWarningDialog } from './DuplicateWarningDialog';

const GENRE_OPTIONS = [
  'All',
  'Pop',
  'Electronic',
  'Ambient',
  'Rock',
  'Hip-Hop',
  'Jazz',
  'Classical',
  'Instrumental',
  'World',
];

interface FilteredBatchDownloaderProps {
  onResultsLoaded?: (tracks: Track[]) => void;
}

export const FilteredBatchDownloader: React.FC<FilteredBatchDownloaderProps> = ({
  onResultsLoaded,
}) => {
  const dispatch = useAppDispatch();
  const credentials = useAppSelector((s) => s.settings.credentials);
  const artists = useAppSelector((s) => s.library.artists);

  const [artistInput, setArtistInput] = useState('');
  const [genre, setGenre] = useState('All');
  const [sortOrder, setSortOrder] = useState<'latest' | 'popular'>('latest');
  const [count, setCount] = useState<number>(10);
  const [running, setRunning] = useState(false);
  const [feedback, setFeedback] = useState<{
    severity: 'success' | 'info' | 'warning' | 'error';
    message: string;
  } | null>(null);

  const [pendingTracks, setPendingTracks] = useState<Track[]>([]);
  const [dupReport, setDupReport] = useState<DuplicateCheckResult | null>(null);
  const [dupOpen, setDupOpen] = useState(false);

  const artistNames = artists.map((a) => a.name);

  const handleFetchAndDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetArtist = artistInput.trim();
    const clampedCount = Math.min(Math.max(1, Number(count) || 10), 100);

    if (!targetArtist && genre === 'All') {
      setFeedback({
        severity: 'warning',
        message: 'Enter an Artist name or choose a Genre before running a filtered download.',
      });
      return;
    }

    setRunning(true);
    setFeedback(null);

    try {
      const [jamendoRes, iaRes] = await Promise.all([
        jamendoProvider.isConfigured(credentials)
          ? jamendoProvider.search({
              query: '',
              artistName: targetArtist || undefined,
              genre: genre === 'All' ? undefined : genre,
              filter: sortOrder,
              limit: clampedCount,
              credentials,
            })
          : Promise.resolve({ tracks: [] as Track[], albums: [] }),
        internetArchiveProvider.search({
          query: targetArtist ? '' : genre === 'All' ? 'music' : genre,
          artistName: targetArtist || undefined,
          genre: genre === 'All' ? undefined : genre,
          filter: sortOrder,
          limit: Math.min(clampedCount, 30),
          credentials,
        }),
      ]);

      const verifiedFree = [...jamendoRes.tracks, ...iaRes.tracks]
        .filter(
          (t) =>
            t.availability === 'FREE DOWNLOAD AVAILABLE' &&
            Boolean(t.downloadInfo?.verified && t.downloadInfo?.downloadUrl),
        )
        .sort((a, b) =>
          sortOrder === 'latest'
            ? (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '')
            : (b.popularityScore ?? 0) - (a.popularityScore ?? 0),
        )
        .slice(0, clampedCount);

      if (verifiedFree.length === 0) {
        // Check commercial discovery so we give a helpful, transparent explanation
        let commercialCount = 0;
        if (targetArtist) {
          const discovery = await appleMusicProvider.search({
            query: targetArtist,
            limit: 10,
            credentials,
          });
          commercialCount = discovery.tracks.length;
        }

        setFeedback({
          severity: 'warning',
          message:
            commercialCount > 0
              ? `Found ${commercialCount} STREAMING ONLY release(s) for "${targetArtist}", but 0 authorised free MP3 downloads. Commercial label tracks cannot be downloaded as MP3s without rights-holder permission. Try Creative Commons artists on Jamendo or Internet Archive.`
              : `No verified free MP3 downloads matched Artist="${targetArtist || 'Any'}" and Genre="${genre}".${
                  !jamendoProvider.isConfigured(credentials)
                    ? ' Tip: add your free Jamendo Client ID in Settings for a much larger CC catalog.'
                    : ''
                }`,
        });
        setRunning(false);
        return;
      }

      onResultsLoaded?.(verifiedFree);

      const report = checkDuplicateDownloads(verifiedFree, store.getState());
      if (report.duplicates.length > 0) {
        setPendingTracks(verifiedFree);
        setDupReport(report);
        setDupOpen(true);
      } else {
        const { queuedCount } = enqueueTracksForDownload(
          verifiedFree,
          dispatch,
          store.getState,
        );
        setFeedback({
          severity: 'success',
          message: `Queued ${queuedCount} ${sortOrder === 'latest' ? 'latest' : 'popular'} authorised MP3 track(s)${
            targetArtist ? ` for "${targetArtist}"` : ''
          }${genre !== 'All' ? ` (${genre})` : ''}.`,
        });
      }
    } catch (err) {
      setFeedback({
        severity: 'error',
        message: err instanceof Error ? err.message : 'Filtered download failed.',
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <Card
        sx={{
          bgcolor: 'rgba(124, 77, 255, 0.06)',
          border: '1px solid rgba(124, 77, 255, 0.28)',
        }}
      >
        <CardContent component="form" onSubmit={(e) => void handleFetchAndDownload(e)}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <FilterIcon color="secondary" />
            <Typography variant="subtitle1" fontWeight={700}>
              Filtered Batch Download (Artist / Genre / Latest / Count)
            </Typography>
          </Box>

          <Grid2 container spacing={1.5} alignItems="center">
            <Grid2 size={{ xs: 12, sm: 6, md: 4 }}>
              <Autocomplete
                freeSolo
                options={artistNames}
                inputValue={artistInput}
                onInputChange={(_, value) => setArtistInput(value)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    label="Artist Filter (optional)"
                    placeholder="e.g. Dua Lipa, Josh Woodward, Kevin MacLeod"
                  />
                )}
              />
            </Grid2>

            <Grid2 size={{ xs: 6, sm: 3, md: 2.5 }}>
              <TextField
                select
                fullWidth
                size="small"
                label="Genre"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
              >
                {GENRE_OPTIONS.map((g) => (
                  <MenuItem key={g} value={g}>
                    {g}
                  </MenuItem>
                ))}
              </TextField>
            </Grid2>

            <Grid2 size={{ xs: 6, sm: 3, md: 2 }}>
              <TextField
                select
                fullWidth
                size="small"
                label="Order"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'latest' | 'popular')}
              >
                <MenuItem value="latest">Latest</MenuItem>
                <MenuItem value="popular">Popular</MenuItem>
              </TextField>
            </Grid2>

            <Grid2 size={{ xs: 6, sm: 4, md: 1.5 }}>
              <TextField
                type="number"
                fullWidth
                size="small"
                label="Count"
                value={count}
                inputProps={{ min: 1, max: 100 }}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </Grid2>

            <Grid2 size={{ xs: 6, sm: 8, md: 2 }}>
              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="secondary"
                disabled={running}
                startIcon={<DownloadIcon />}
                sx={{ height: 40 }}
              >
                {running ? 'Fetching...' : `Download ${count || 10}`}
              </Button>
            </Grid2>
          </Grid2>

          {feedback && (
            <Alert
              severity={feedback.severity}
              sx={{ mt: 2 }}
              onClose={() => setFeedback(null)}
            >
              {feedback.message}
            </Alert>
          )}
        </CardContent>
      </Card>

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
            setFeedback({
              severity: 'success',
              message: `Skipped ${dupReport.duplicates.length} duplicate(s) and queued ${queuedCount} new MP3 track(s).`,
            });
          }
          setDupOpen(false);
        }}
        onDownloadAllAnyway={() => {
          const { queuedCount } = enqueueTracksForDownload(
            pendingTracks,
            dispatch,
            store.getState,
            { allowDuplicates: true },
          );
          setFeedback({
            severity: 'info',
            message: `Queued ${queuedCount} track(s) (including previously downloaded items).`,
          });
          setDupOpen(false);
        }}
      />
    </>
  );
};
