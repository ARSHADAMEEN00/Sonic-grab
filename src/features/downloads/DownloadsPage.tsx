import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  LinearProgress,
  Paper,
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
  Archive as ZipIcon,
  Cancel as CancelIcon,
  ClearAll as ClearIcon,
  CloudDownload as RedownloadIcon,
  DeleteOutline as DeleteIcon,
  OpenInNew as ExternalIcon,
  Replay as RetryIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../app/store/hooks';
import { store } from '../../app/store/store';
import {
  clearFinishedDownloads,
  removeDownloadQueueItem,
} from './downloadsSlice';
import {
  clearDownloadHistory,
  removeDownloadHistoryItem,
} from '../library/librarySlice';
import {
  cancelQueuedDownload,
  exportCachedTracksAsZip,
  retryDownloadItem,
} from '../../services/api/downloadManager';
import { triggerBrowserBlobDownload } from '../../utils/fileSystem';
import { formatBytes } from '../../utils/formatters';
import { deleteAudioBlob, getAudioBlob } from '../../utils/indexedDb';

export const DownloadsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const queue = useAppSelector((s) => s.downloads.queue);
  const history = useAppSelector((s) => s.library.downloadHistory);
  const maxConcurrent = useAppSelector((s) => s.settings.maxConcurrentDownloads);

  const [notice, setNotice] = useState<string | null>(null);

  const handleRedownloadFromCache = async (trackId: string, fileName: string) => {
    const rec = await getAudioBlob(trackId);
    if (!rec) {
      setNotice('Cached MP3 blob not found in browser storage.');
      return;
    }
    triggerBrowserBlobDownload(rec.blob, fileName);
  };

  const handleExportZip = async () => {
    const count = await exportCachedTracksAsZip(undefined, 'sonic-grab-mp3s.zip');
    setNotice(
      count > 0
        ? `Exported ${count} downloaded MP3(s) as sonic-grab-mp3s.zip.`
        : 'No locally cached MP3 files available to bundle.',
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4">Download Manager</Typography>
          <Typography variant="body2" color="text.secondary">
            Queue supports unlimited tracks • Running up to {maxConcurrent} concurrent browser download(s) at a time
          </Typography>
        </Box>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<ZipIcon />}
            disabled={history.filter((h) => h.hasLocalBlob).length === 0}
            onClick={() => void handleExportZip()}
          >
            Download All as ZIP
          </Button>
          <Button
            variant="outlined"
            startIcon={<ClearIcon />}
            onClick={() => dispatch(clearFinishedDownloads())}
            disabled={queue.length === 0}
          >
            Clear Finished
          </Button>
        </Stack>
      </Box>

      {notice && (
        <Alert severity="info" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {/* Active Queue */}
      <Box>
        <Typography variant="h6" sx={{ mb: 1.5 }}>
          Download Queue ({queue.length})
        </Typography>
        {queue.length === 0 ? (
          <Card>
            <CardContent>
              <Typography color="text.secondary">
                Download queue is empty. Queue authorised MP3 tracks from Discover Free Music or Search.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Stack spacing={1.5}>
            {queue.map((item) => (
              <Card key={item.id}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle1" fontWeight={700} noWrap>
                        {item.track.title} — {item.track.artist}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {item.fileName} • {item.track.downloadInfo?.licence}
                      </Typography>
                    </Box>

                    <Stack direction="row" alignItems="center" gap={1}>
                      <Chip
                        size="small"
                        label={item.status.toUpperCase()}
                        color={
                          item.status === 'completed'
                            ? 'success'
                            : item.status === 'failed'
                              ? 'error'
                              : item.status === 'cors-fallback'
                                ? 'warning'
                                : 'primary'
                        }
                      />
                      {(item.status === 'downloading' || item.status === 'queued') && (
                        <IconButton
                          size="small"
                          onClick={() =>
                            cancelQueuedDownload(item.id, dispatch, store.getState)
                          }
                          title="Cancel"
                        >
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      )}
                      {(item.status === 'failed' || item.status === 'cancelled') && (
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() =>
                            retryDownloadItem(item, dispatch, store.getState)
                          }
                          title="Retry"
                        >
                          <RetryIcon fontSize="small" />
                        </IconButton>
                      )}
                      {item.status === 'cors-fallback' && item.track.downloadInfo?.downloadUrl && (
                        <>
                          <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            startIcon={<RedownloadIcon fontSize="small" />}
                            href={item.track.downloadInfo.downloadUrl}
                            download={item.fileName}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Direct Download MP3
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            endIcon={<ExternalIcon fontSize="small" />}
                            href={item.track.downloadInfo.sourcePageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Source Page
                          </Button>
                        </>
                      )}
                      <IconButton
                        size="small"
                        onClick={() => dispatch(removeDownloadQueueItem(item.id))}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Box>

                  {(item.status === 'downloading' || item.status === 'validating') && (
                    <Box>
                      <LinearProgress
                        variant={item.totalBytes ? 'determinate' : 'indeterminate'}
                        value={item.progressPercent}
                        sx={{ height: 6, borderRadius: 3, mb: 0.5 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {formatBytes(item.bytesReceived)}
                        {item.totalBytes
                          ? ` / ${formatBytes(item.totalBytes)} (${item.progressPercent}%)`
                          : ''}
                      </Typography>
                    </Box>
                  )}

                  {item.errorMessage && (
                    <Alert
                      severity={item.status === 'cors-fallback' ? 'warning' : 'error'}
                      sx={{ mt: 1 }}
                    >
                      {item.errorMessage}
                    </Alert>
                  )}
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Box>

      {/* Download History */}
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="h6">Download History ({history.length})</Typography>
          {history.length > 0 && (
            <Button
              size="small"
              color="error"
              onClick={() => dispatch(clearDownloadHistory())}
            >
              Clear History
            </Button>
          )}
        </Box>

        {history.length === 0 ? (
          <Card>
            <CardContent>
              <Typography color="text.secondary">No completed downloads yet.</Typography>
            </CardContent>
          </Card>
        ) : (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Track</TableCell>
                  <TableCell>Filename</TableCell>
                  <TableCell>Provider / Licence</TableCell>
                  <TableCell>Size</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {item.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.artist}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {item.fileName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {item.provider} • {item.licence}
                      </Typography>
                    </TableCell>
                    <TableCell>{formatBytes(item.fileSizeBytes)}</TableCell>
                    <TableCell align="right">
                      {item.hasLocalBlob && (
                        <Tooltip title="Save MP3 again from browser cache">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() =>
                              void handleRedownloadFromCache(item.trackId, item.fileName)
                            }
                          >
                            <RedownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Open original source link">
                        <IconButton
                          size="small"
                          component="a"
                          href={item.sourcePageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove from history & cache">
                        <IconButton
                          size="small"
                          onClick={() => {
                            void deleteAudioBlob(item.trackId);
                            dispatch(removeDownloadHistoryItem(item.id));
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Box>
  );
};
