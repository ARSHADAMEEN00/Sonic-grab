import React from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import { Close as CloseIcon, Key as KeyIcon } from '@mui/icons-material';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppDispatch, useAppSelector } from '../../app/store/hooks';
import { updateCredentials } from '../../features/settings/settingsSlice';

const tokenSchema = z.object({
  jamendoClientId: z.string().trim(),
  appleMusicDeveloperToken: z.string().trim(),
  spotifyAccessToken: z.string().trim(),
  soundcloudClientId: z.string().trim(),
});

type TokenFormValues = z.infer<typeof tokenSchema>;

interface TokenSetupDialogProps {
  open: boolean;
  onClose: () => void;
}

export const TokenSetupDialog: React.FC<TokenSetupDialogProps> = ({ open, onClose }) => {
  const dispatch = useAppDispatch();
  const credentials = useAppSelector((s) => s.settings.credentials);

  const { control, handleSubmit } = useForm<TokenFormValues>({
    resolver: zodResolver(tokenSchema),
    values: credentials,
  });

  const onSubmit = (values: TokenFormValues) => {
    dispatch(updateCredentials(values));
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <KeyIcon color="primary" />
          <Typography variant="h6">Your API Tokens (BYOT)</Typography>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <Box component="form" onSubmit={handleSubmit(onSubmit)}>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Alert severity="info" variant="outlined">
            Your tokens stay strictly in <strong>your own browser</strong> (<code>localStorage</code>) and are sent only from your browser to the official music APIs. No server stores your keys.
          </Alert>

          <Controller
            name="jamendoClientId"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                size="small"
                label="Jamendo Client ID (Free CC MP3s)"
                placeholder="Paste your client_id from devportal.jamendo.com"
                helperText="Required for Jamendo CC-licensed MP3 downloads. Internet Archive & Apple/iTunes & MusicBrainz work without any key."
                fullWidth
              />
            )}
          />

          <Controller
            name="appleMusicDeveloperToken"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                size="small"
                label="Apple Music Developer JWT (Optional)"
                placeholder="Leave blank to use public iTunes catalog discovery"
                fullWidth
              />
            )}
          />

          <Controller
            name="spotifyAccessToken"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                size="small"
                label="Spotify User OAuth Token (Optional, Metadata Only)"
                placeholder="Bearer token"
                fullWidth
              />
            )}
          />

          <Controller
            name="soundcloudClientId"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                size="small"
                label="SoundCloud Client ID (Optional)"
                fullWidth
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            Save My Tokens
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};
