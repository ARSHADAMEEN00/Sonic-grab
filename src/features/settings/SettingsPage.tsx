import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  Grid2,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  Cached as RefreshIcon,
  CheckCircle as OnlineIcon,
  DeleteSweep as SweepIcon,
  Save as SaveIcon,
  WarningAmber as WarnIcon,
} from '@mui/icons-material';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppDispatch, useAppSelector } from '../../app/store/hooks';
import { resetSettings, updateSettings } from './settingsSlice';
import { toggleFavouriteArtist } from '../library/librarySlice';
import { clearApiCache, getApiCacheStats } from '../../services/api/cache';
import { checkAllProvidersHealth } from '../../services/providers/providerRegistry';
import type { MusicLanguage, ProviderStatus } from '../../types/music';
import { formatBytes } from '../../utils/formatters';
import { clearAllAudioBlobs } from '../../utils/indexedDb';

const ALL_LANGUAGES: MusicLanguage[] = [
  'English',
  'Malayalam',
  'Hindi',
  'Tamil',
  'Arabic',
  'Other',
];

const settingsSchema = z.object({
  defaultPlaylistId: z.string().min(1),
  maxConcurrentDownloads: z.coerce.number().int().min(1).max(10),
  showArtwork: z.boolean(),
  jamendoClientId: z.string().trim(),
  appleMusicDeveloperToken: z.string().trim(),
  spotifyAccessToken: z.string().trim(),
  soundcloudClientId: z.string().trim(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export const SettingsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const settings = useAppSelector((s) => s.settings);
  const playlists = useAppSelector((s) => s.library.playlists);
  const artists = useAppSelector((s) => s.library.artists);

  const [selectedLanguages, setSelectedLanguages] = useState<MusicLanguage[]>(
    settings.preferredLanguages,
  );
  const [statuses, setStatuses] = useState<ProviderStatus[]>([]);
  const [checkingApi, setCheckingApi] = useState(false);
  const [cacheStats, setCacheStats] = useState(getApiCacheStats());
  const [storageEstimate, setStorageEstimate] = useState<{
    usage?: number;
    quota?: number;
  }>({});
  const [notice, setNotice] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      defaultPlaylistId: settings.defaultPlaylistId,
      maxConcurrentDownloads: settings.maxConcurrentDownloads,
      showArtwork: settings.showArtwork,
      jamendoClientId: settings.credentials.jamendoClientId,
      appleMusicDeveloperToken: settings.credentials.appleMusicDeveloperToken,
      spotifyAccessToken: settings.credentials.spotifyAccessToken,
      soundcloudClientId: settings.credentials.soundcloudClientId,
    },
  });

  const refreshStorageStats = async () => {
    setCacheStats(getApiCacheStats());
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      setStorageEstimate({ usage: est.usage, quota: est.quota });
    }
  };

  const runHealthCheck = async () => {
    setCheckingApi(true);
    const res = await checkAllProvidersHealth(settings.credentials);
    setStatuses(res);
    setCheckingApi(false);
  };

  useEffect(() => {
    void refreshStorageStats();
    void runHealthCheck();
  }, []);

  const onSave = (values: SettingsFormValues) => {
    dispatch(
      updateSettings({
        preferredLanguages: selectedLanguages,
        defaultPlaylistId: values.defaultPlaylistId,
        maxConcurrentDownloads: values.maxConcurrentDownloads,
        showArtwork: values.showArtwork,
        credentials: {
          jamendoClientId: values.jamendoClientId,
          appleMusicDeveloperToken: values.appleMusicDeveloperToken,
          spotifyAccessToken: values.spotifyAccessToken,
          soundcloudClientId: values.soundcloudClientId,
        },
      }),
    );
    setNotice('Your preferences and API tokens have been saved in your browser.');
  };

  const toggleLanguage = (lang: MusicLanguage) => {
    setSelectedLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h4">Settings &amp; Bring Your Own Tokens (BYOT)</Typography>
        <Typography variant="body2" color="text.secondary">
          Every user brings their own API tokens. Credentials are stored strictly in your own browser and are never transmitted to any third-party backend.
        </Typography>
      </Box>

      {notice && (
        <Alert severity="success" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit(onSave)} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Grid2 container spacing={2.5}>
          {/* General Preferences */}
          <Grid2 size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="h6">Playback &amp; Download Preferences</Typography>

                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                    Preferred Languages
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={0.75}>
                    {ALL_LANGUAGES.map((lang) => (
                      <Chip
                        key={lang}
                        label={lang}
                        size="small"
                        color={selectedLanguages.includes(lang) ? 'primary' : 'default'}
                        onClick={() => toggleLanguage(lang)}
                      />
                    ))}
                  </Stack>
                </Box>

                <Controller
                  name="defaultPlaylistId"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} select size="small" label="Default Music Collection">
                      {playlists.map((pl) => (
                        <MenuItem key={pl.id} value={pl.id}>
                          {pl.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />

                <Controller
                  name="maxConcurrentDownloads"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      type="number"
                      size="small"
                      label="Concurrent Downloads (1–10)"
                      helperText={
                        errors.maxConcurrentDownloads?.message ||
                        'The queue itself has no track limit; this sets how many MP3s download simultaneously.'
                      }
                      error={Boolean(errors.maxConcurrentDownloads)}
                    />
                  )}
                />

                <Controller
                  name="showArtwork"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch checked={field.value} onChange={field.onChange} />}
                      label="Display album & track artwork"
                    />
                  )}
                />
              </CardContent>
            </Card>
          </Grid2>

          {/* Provider Credentials */}
          <Grid2 size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="h6">Your API Tokens (Browser-Private)</Typography>
                <Alert severity="info" variant="outlined">
                  Each user enters their own tokens here. Never paste confidential server signing keys (like Spotify <code>client_secret</code> or Apple <code>.p8</code> keys) into browser fields.
                </Alert>

                <Controller
                  name="jamendoClientId"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      size="small"
                      label="Jamendo Client ID (Free CC MP3s)"
                      placeholder="From devportal.jamendo.com"
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
                      placeholder="Leave blank to use public iTunes discovery"
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
                      label="Spotify Temporary OAuth Token (Optional, Metadata Only)"
                      placeholder="Requires user OAuth token"
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
              </CardContent>
            </Card>
          </Grid2>
        </Grid2>

        <Stack direction="row" gap={1.5}>
          <Button type="submit" variant="contained" startIcon={<SaveIcon />}>
            Save Settings &amp; Tokens
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              dispatch(resetSettings());
              reset();
              setNotice('Settings reset to defaults.');
            }}
          >
            Reset Defaults
          </Button>
        </Stack>
      </Box>

      {/* Favourite Artists Quick Toggle */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Favourite Artists ({artists.filter((a) => a.favourite).length})
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.75}>
            {artists.map((artist) => (
              <Chip
                key={artist.id}
                label={artist.name}
                size="small"
                color={artist.favourite ? 'primary' : 'default'}
                variant={artist.favourite ? 'filled' : 'outlined'}
                onClick={() => dispatch(toggleFavouriteArtist(artist.id))}
              />
            ))}
          </Stack>
        </CardContent>
      </Card>

      {/* API Status */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">API Provider Status</Typography>
            <Button
              size="small"
              startIcon={<RefreshIcon />}
              disabled={checkingApi}
              onClick={() => void runHealthCheck()}
            >
              {checkingApi ? 'Checking...' : 'Check Status'}
            </Button>
          </Box>
          <Grid2 container spacing={1.5}>
            {statuses.map((st) => (
              <Grid2 key={st.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card variant="outlined" sx={{ bgcolor: 'rgba(255,255,255,0.02)' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="subtitle2">{st.name}</Typography>
                      <Chip
                        size="small"
                        icon={st.reachable === 'online' ? <OnlineIcon /> : <WarnIcon />}
                        label={st.reachable}
                        color={st.reachable === 'online' ? 'success' : 'warning'}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {st.note}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid2>
            ))}
          </Grid2>
        </CardContent>
      </Card>

      {/* Cache & Storage */}
      <Card>
        <CardContent sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Box>
            <Typography variant="h6">Browser Cache &amp; Storage</Typography>
            <Typography variant="body2" color="text.secondary">
              API metadata cache: {cacheStats.entries} entries ({formatBytes(cacheStats.approxBytes)}) •
              Browser Storage used: {formatBytes(storageEstimate.usage)}
              {storageEstimate.quota ? ` / ${formatBytes(storageEstimate.quota)}` : ''}
            </Typography>
          </Box>
          <Stack direction="row" gap={1}>
            <Button
              variant="outlined"
              startIcon={<SweepIcon />}
              onClick={() => {
                const count = clearApiCache();
                void refreshStorageStats();
                setNotice(`Cleared ${count} cached API response(s).`);
              }}
            >
              Clear API Cache
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={() => {
                void clearAllAudioBlobs().then(() => {
                  void refreshStorageStats();
                  setNotice('Cleared cached MP3 audio blobs from browser storage.');
                });
              }}
            >
              Clear Cached MP3s
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};
