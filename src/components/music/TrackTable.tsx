import React, { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CloudDone as DownloadedIcon,
  CloudDownload as DownloadIcon,
  Favorite as FavIcon,
  FavoriteBorder as FavBorderIcon,
  InfoOutlined as InfoIcon,
  OpenInNew as ExternalIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  PlaylistAdd as PlaylistAddIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../app/store/hooks';
import { store } from '../../app/store/store';
import { playTrackPreview, togglePlayPause } from '../../features/discovery/playerSlice';
import {
  addTrackToPlaylist,
  toggleFavouriteTrack,
} from '../../features/library/librarySlice';
import {
  checkDuplicateDownloads,
  enqueueTracksForDownload,
  type DuplicateCheckResult,
} from '../../services/api/downloadManager';
import type { Track } from '../../types/music';
import { formatBytes, formatDuration } from '../../utils/formatters';
import { DuplicateWarningDialog } from '../downloads/DuplicateWarningDialog';
import { AvailabilityBadge } from './AvailabilityBadge';

interface TrackTableProps {
  tracks: Track[];
  emptyMessage?: string;
  compact?: boolean;
  showBatchActions?: boolean;
}

export const TrackTable: React.FC<TrackTableProps> = ({
  tracks,
  emptyMessage = 'No tracks matched this view.',
  compact = false,
  showBatchActions = true,
}) => {
  const dispatch = useAppDispatch();
  const showArtwork = useAppSelector((s) => s.settings.showArtwork);
  const favouriteIds = useAppSelector((s) => s.library.favouriteTrackIds);
  const playlists = useAppSelector((s) => s.library.playlists);
  const downloadHistory = useAppSelector((s) => s.library.downloadHistory);
  const { currentTrack, isPlaying } = useAppSelector((s) => s.player);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [playlistMenuAnchor, setPlaylistMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuTrack, setMenuTrack] = useState<Track | null>(null);

  const [pendingDownloadTracks, setPendingDownloadTracks] = useState<Track[]>([]);
  const [dupReport, setDupReport] = useState<DuplicateCheckResult | null>(null);
  const [dupOpen, setDupOpen] = useState(false);

  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  const downloadedIds = useMemo(
    () => new Set(downloadHistory.map((h) => h.trackId)),
    [downloadHistory],
  );
  const downloadedSigs = useMemo(
    () =>
      new Set(
        downloadHistory.map(
          (h) => `${h.artist.trim().toLowerCase()}::${h.title.trim().toLowerCase()}`,
        ),
      ),
    [downloadHistory],
  );

  const downloadableTracks = useMemo(
    () =>
      tracks.filter(
        (t) =>
          t.availability === 'FREE DOWNLOAD AVAILABLE' &&
          Boolean(t.downloadInfo?.verified && t.downloadInfo?.downloadUrl),
      ),
    [tracks],
  );

  const selectedDownloadableTracks = useMemo(
    () => downloadableTracks.filter((t) => selectedIds.has(t.id)),
    [downloadableTracks, selectedIds],
  );

  if (tracks.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">{emptyMessage}</Typography>
      </Paper>
    );
  }

  const initiateDownloadWithDuplicateCheck = (targetTracks: Track[]) => {
    const report = checkDuplicateDownloads(targetTracks, store.getState());
    if (report.duplicates.length > 0) {
      setPendingDownloadTracks(targetTracks);
      setDupReport(report);
      setDupOpen(true);
      return;
    }

    const { queuedCount } = enqueueTracksForDownload(
      targetTracks,
      dispatch,
      store.getState,
    );
    setToast({
      open: true,
      message:
        queuedCount > 0
          ? `Queued ${queuedCount} authorised MP3 download(s).`
          : 'Unable to queue selected tracks.',
      severity: queuedCount > 0 ? 'success' : 'warning',
    });
  };

  const handlePlay = (track: Track) => {
    if (!track.previewUrl) return;
    if (currentTrack?.id === track.id) {
      dispatch(togglePlayPause());
    } else {
      dispatch(playTrackPreview({ track }));
    }
  };

  const allFreeSelected =
    downloadableTracks.length > 0 &&
    selectedDownloadableTracks.length === downloadableTracks.length;

  return (
    <>
      {showBatchActions && downloadableTracks.length > 0 && (
        <Paper
          sx={{
            px: 2,
            py: 1.25,
            mb: 1.25,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            bgcolor: 'rgba(0, 229, 163, 0.06)',
            border: '1px solid rgba(0, 229, 163, 0.22)',
          }}
        >
          <Stack direction="row" alignItems="center" gap={1}>
            <Checkbox
              size="small"
              checked={allFreeSelected}
              indeterminate={
                selectedDownloadableTracks.length > 0 && !allFreeSelected
              }
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedIds(new Set(downloadableTracks.map((t) => t.id)));
                } else {
                  setSelectedIds(new Set());
                }
              }}
            />
            <Typography variant="body2" fontWeight={600}>
              {selectedDownloadableTracks.length > 0
                ? `${selectedDownloadableTracks.length} of ${downloadableTracks.length} free MP3(s) selected`
                : `${downloadableTracks.length} free MP3(s) available`}
            </Typography>
          </Stack>

          <Stack direction="row" flexWrap="wrap" gap={1}>
            {selectedDownloadableTracks.length > 0 && (
              <Button
                size="small"
                variant="contained"
                startIcon={<DownloadIcon fontSize="small" />}
                onClick={() =>
                  initiateDownloadWithDuplicateCheck(selectedDownloadableTracks)
                }
              >
                Download Selected ({selectedDownloadableTracks.length})
              </Button>
            )}
            <Button
              size="small"
              variant={selectedDownloadableTracks.length > 0 ? 'outlined' : 'contained'}
              startIcon={<DownloadIcon fontSize="small" />}
              onClick={() => initiateDownloadWithDuplicateCheck(downloadableTracks)}
            >
              Download All ({downloadableTracks.length})
            </Button>
          </Stack>
        </Paper>
      )}

      <TableContainer component={Paper} sx={{ width: '100%', overflowX: 'auto' }}>
        <Table size={compact ? 'small' : 'medium'} sx={{ tableLayout: 'fixed', width: '100%' }}>
          <TableHead>
            <TableRow>
              {showBatchActions && downloadableTracks.length > 0 && (
                <TableCell padding="checkbox" sx={{ width: 42 }} />
              )}
              <TableCell sx={{ width: 46 }}>#</TableCell>
              <TableCell>Track</TableCell>
              <TableCell sx={{ width: 165, display: { xs: 'none', lg: 'table-cell' } }}>
                Album
              </TableCell>
              <TableCell sx={{ width: 145, display: { xs: 'none', sm: 'table-cell' } }}>
                Status
              </TableCell>
              <TableCell sx={{ width: 62, display: { xs: 'none', xl: 'table-cell' } }}>
                Time
              </TableCell>
              <TableCell align="right" sx={{ width: 186 }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tracks.map((track, idx) => {
              const isFav = favouriteIds.includes(track.id);
              const isCurrent = currentTrack?.id === track.id;
              const canDownload =
                track.availability === 'FREE DOWNLOAD AVAILABLE' &&
                Boolean(track.downloadInfo?.verified && track.downloadInfo?.downloadUrl);
              const isExpanded = expandedId === track.id;
              const isChecked = selectedIds.has(track.id);
              const sig = `${track.artist.trim().toLowerCase()}::${track.title.trim().toLowerCase()}`;
              const alreadyDownloaded =
                downloadedIds.has(track.id) || downloadedSigs.has(sig);

              return (
                <React.Fragment key={track.id}>
                  <TableRow hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                    {showBatchActions && downloadableTracks.length > 0 && (
                      <TableCell padding="checkbox">
                        {canDownload && (
                          <Checkbox
                            size="small"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(track.id)) next.delete(track.id);
                                else next.add(track.id);
                                return next;
                              });
                            }}
                          />
                        )}
                      </TableCell>
                    )}

                    <TableCell sx={{ px: 1 }}>
                      {track.previewUrl ? (
                        <IconButton
                          size="small"
                          color={isCurrent && isPlaying ? 'primary' : 'default'}
                          onClick={() => handlePlay(track)}
                          aria-label={`Preview ${track.title}`}
                        >
                          {isCurrent && isPlaying ? (
                            <PauseIcon fontSize="small" />
                          ) : (
                            <PlayIcon fontSize="small" />
                          )}
                        </IconButton>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          {idx + 1}
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell sx={{ overflow: 'hidden' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                        {showArtwork && (
                          <Avatar
                            src={track.artworkUrl}
                            variant="rounded"
                            imgProps={{ loading: 'lazy' }}
                            sx={{ width: 40, height: 40, bgcolor: '#1D2536', flexShrink: 0 }}
                          >
                            {track.title.slice(0, 1)}
                          </Avatar>
                        )}
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Typography variant="body2" fontWeight={600} noWrap>
                              {track.title}
                            </Typography>
                            {alreadyDownloaded && (
                              <Chip
                                icon={<DownloadedIcon />}
                                label="Downloaded"
                                size="small"
                                color="info"
                                variant="outlined"
                                sx={{ height: 18, fontSize: 10 }}
                              />
                            )}
                          </Box>
                          <Typography variant="caption" color="text.secondary" noWrap display="block">
                            {track.artist} • {track.provider}
                            {track.genre ? ` • ${track.genre}` : ''}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' }, overflow: 'hidden' }}>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {track.album}
                      </Typography>
                    </TableCell>

                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                      <AvailabilityBadge availability={track.availability} compact />
                    </TableCell>

                    <TableCell sx={{ display: { xs: 'none', xl: 'table-cell' } }}>
                      <Typography variant="caption" color="text.secondary">
                        {formatDuration(track.durationSec)}
                      </Typography>
                    </TableCell>

                    <TableCell align="right" sx={{ whiteSpace: 'nowrap', px: 1 }}>
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                        <Tooltip title={isFav ? 'Remove from Favourites' : 'Add to Favourites'}>
                          <IconButton
                            size="small"
                            color={isFav ? 'error' : 'default'}
                            onClick={() => dispatch(toggleFavouriteTrack(track))}
                          >
                            {isFav ? <FavIcon fontSize="small" /> : <FavBorderIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Add to Playlist">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              setPlaylistMenuAnchor(e.currentTarget);
                              setMenuTrack(track);
                            }}
                          >
                            <PlaylistAddIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        {canDownload ? (
                          <>
                            <Tooltip title="Licence & file details">
                              <IconButton
                                size="small"
                                onClick={() => setExpandedId(isExpanded ? null : track.id)}
                              >
                                <InfoIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Button
                              size="small"
                              variant={alreadyDownloaded ? 'outlined' : 'contained'}
                              startIcon={<DownloadIcon fontSize="small" />}
                              onClick={() => initiateDownloadWithDuplicateCheck([track])}
                              sx={{ ml: 0.5, px: 1.25, minWidth: 68, fontSize: 12 }}
                            >
                              {alreadyDownloaded ? 'Again' : 'MP3'}
                            </Button>
                          </>
                        ) : (
                          <Tooltip title="Open original provider page">
                            <IconButton
                              size="small"
                              component="a"
                              href={track.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>

                  {canDownload && track.downloadInfo && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        sx={{ py: 0, borderBottom: isExpanded ? undefined : 0 }}
                      >
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box
                            sx={{
                              p: 2,
                              my: 1,
                              borderRadius: 2,
                              bgcolor: 'rgba(0, 229, 163, 0.05)',
                              border: '1px solid rgba(0, 229, 163, 0.2)',
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 2.5,
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5 }}>
                              <Box>
                                <Typography variant="caption" color="text.secondary">
                                  Provider
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>
                                  {track.downloadInfo.providerName}
                                </Typography>
                              </Box>
                              <Box>
                                <Typography variant="caption" color="text.secondary">
                                  Licence
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>
                                  {track.downloadInfo.licence}
                                </Typography>
                              </Box>
                              <Box>
                                <Typography variant="caption" color="text.secondary">
                                  Format / Quality
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>
                                  {track.downloadInfo.format}
                                  {track.downloadInfo.audioQuality
                                    ? ` (${track.downloadInfo.audioQuality})`
                                    : ''}
                                </Typography>
                              </Box>
                              <Box>
                                <Typography variant="caption" color="text.secondary">
                                  File Size
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>
                                  {formatBytes(track.downloadInfo.fileSizeBytes)}
                                </Typography>
                              </Box>
                            </Box>

                            <Button
                              size="small"
                              variant="outlined"
                              endIcon={<ExternalIcon fontSize="small" />}
                              href={track.downloadInfo.sourcePageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Original Source Link
                            </Button>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Menu
        anchorEl={playlistMenuAnchor}
        open={Boolean(playlistMenuAnchor)}
        onClose={() => setPlaylistMenuAnchor(null)}
      >
        {playlists.map((pl) => (
          <MenuItem
            key={pl.id}
            onClick={() => {
              if (menuTrack) {
                dispatch(addTrackToPlaylist({ playlistId: pl.id, track: menuTrack }));
                setToast({
                  open: true,
                  message: `Added "${menuTrack.title}" to ${pl.name}`,
                  severity: 'success',
                });
              }
              setPlaylistMenuAnchor(null);
            }}
          >
            {pl.name} ({pl.trackIds.length})
          </MenuItem>
        ))}
      </Menu>

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
            setToast({
              open: true,
              message: `Skipped ${dupReport.duplicates.length} duplicate(s) and queued ${queuedCount} new MP3(s).`,
              severity: 'success',
            });
          }
          setDupOpen(false);
        }}
        onDownloadAllAnyway={() => {
          const { queuedCount } = enqueueTracksForDownload(
            pendingDownloadTracks,
            dispatch,
            store.getState,
            { allowDuplicates: true },
          );
          setToast({
            open: true,
            message: `Queued ${queuedCount} MP3 download(s) (duplicates allowed).`,
            severity: 'info',
          });
          setDupOpen(false);
        }}
      />

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          severity={toast.severity}
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </>
  );
};
