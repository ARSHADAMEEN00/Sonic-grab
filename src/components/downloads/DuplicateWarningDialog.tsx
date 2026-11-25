import React from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import { WarningAmber as WarningIcon } from '@mui/icons-material';
import type { DuplicateCheckResult } from '../../services/api/downloadManager';

interface DuplicateWarningDialogProps {
  open: boolean;
  report: DuplicateCheckResult | null;
  onClose: () => void;
  onSkipDuplicates: () => void;
  onDownloadAllAnyway: () => void;
}

export const DuplicateWarningDialog: React.FC<DuplicateWarningDialogProps> = ({
  open,
  report,
  onClose,
  onSkipDuplicates,
  onDownloadAllAnyway,
}) => {
  if (!report) return null;

  const prevDownloaded = report.duplicates.filter(
    (d) => d.reason === 'already-downloaded',
  );
  const inActiveQueue = report.duplicates.filter((d) => d.reason === 'active-queue');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningIcon color="warning" />
        <Typography variant="h6">Duplicate Download Warning</Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Alert severity="warning" variant="outlined">
          {prevDownloaded.length > 0 && (
            <Box>
              <strong>{prevDownloaded.length}</strong> track(s) in this request have{' '}
              <strong>already been downloaded</strong> previously.
            </Box>
          )}
          {inActiveQueue.length > 0 && (
            <Box>
              <strong>{inActiveQueue.length}</strong> track(s) are already in your active
              download queue.
            </Box>
          )}
        </Alert>

        <List dense sx={{ bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2 }}>
          {report.duplicates.slice(0, 6).map((dup) => (
            <ListItem key={dup.track.id}>
              <ListItemText
                primary={`${dup.track.title} — ${dup.track.artist}`}
                secondary={
                  dup.reason === 'active-queue'
                    ? 'Currently in active download queue'
                    : dup.downloadedAt
                      ? `Previously downloaded on ${new Date(dup.downloadedAt).toLocaleString()}`
                      : 'Previously downloaded'
                }
              />
            </ListItem>
          ))}
          {report.duplicates.length > 6 && (
            <ListItem>
              <ListItemText
                secondary={`+ ${report.duplicates.length - 6} more duplicate track(s)`}
              />
            </ListItem>
          )}
        </List>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1, p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        {report.freshTracks.length > 0 && (
          <Button variant="outlined" color="primary" onClick={onSkipDuplicates}>
            Skip Duplicates &amp; Download New ({report.freshTracks.length})
          </Button>
        )}
        {prevDownloaded.length > 0 && (
          <Button variant="contained" color="warning" onClick={onDownloadAllAnyway}>
            Download Again Anyway ({report.freshTracks.length + prevDownloaded.length})
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
