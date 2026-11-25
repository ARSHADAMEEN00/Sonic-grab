import React, { useState } from 'react';
import {
  AppBar,
  Badge,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  InputAdornment,
  Link,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Album as AlbumIcon,
  CloudDownload as DownloadIcon,
  GraphicEq as LogoIcon,
  Home as HomeIcon,
  InstallMobile as InstallIcon,
  Key as KeyIcon,
  LibraryMusic as CollectionIcon,
  Menu as MenuIcon,
  MusicNote as FreeMusicIcon,
  NewReleases as ReleasesIcon,
  People as ArtistsIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  TrendingUp as TrendingIcon,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../app/store/hooks';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { MiniPlayer } from '../music/MiniPlayer';
import { SeoHead } from './SeoHead';
import { TokenSetupDialog } from './TokenSetupDialog';

const DRAWER_WIDTH = 244;

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', path: '/', icon: <HomeIcon /> },
  { label: 'Trending', path: '/trending', icon: <TrendingIcon /> },
  { label: 'Latest Releases', path: '/releases', icon: <ReleasesIcon /> },
  { label: 'Artists', path: '/artists', icon: <ArtistsIcon /> },
  { label: 'Albums', path: '/albums', icon: <AlbumIcon /> },
  { label: 'Discover Free Music', path: '/free-music', icon: <FreeMusicIcon /> },
  { label: 'Downloads', path: '/downloads', icon: <DownloadIcon /> },
  { label: 'My Collection', path: '/collection', icon: <CollectionIcon /> },
  { label: 'Settings & Tokens', path: '/settings', icon: <SettingsIcon /> },
];

const MOBILE_BOTTOM_PATHS = ['/', '/free-music', '/search', '/downloads', '/collection'];

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { canInstall, promptInstall } = usePwaInstall();

  const activeDownloads = useAppSelector(
    (s) =>
      s.downloads.queue.filter(
        (q) => q.status === 'queued' || q.status === 'downloading' || q.status === 'validating',
      ).length,
  );
  const credentials = useAppSelector((s) => s.settings.credentials);
  const hasPlayer = useAppSelector((s) => Boolean(s.player.currentTrack));

  const configuredTokenCount = [
    credentials.jamendoClientId,
    credentials.appleMusicDeveloperToken,
    credentials.spotifyAccessToken,
    credentials.soundcloudClientId,
  ].filter((v) => Boolean(v?.trim())).length;

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickQuery.trim();
    if (!trimmed) {
      navigate('/search');
      return;
    }
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const bottomNavValue = MOBILE_BOTTOM_PATHS.includes(location.pathname)
    ? location.pathname
    : false;

  const drawerContent = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#0E121B',
        borderRight: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <Box
        sx={{
          px: 2.5,
          py: 2.25,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          cursor: 'pointer',
        }}
        onClick={() => {
          navigate('/');
          setMobileOpen(false);
        }}
      >
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #00E5A3 0%, #7C4DFF 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#06120E',
          }}
        >
          <LogoIcon />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ lineHeight: 1.1, letterSpacing: '0.03em' }}>
            SONIC GRAB
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Ad-Free Music &amp; MP3s
          </Typography>
        </Box>
      </Box>

      <List sx={{ px: 1.25, flex: 1, overflowY: 'auto' }}>
        {NAV_ITEMS.map((item) => {
          const selected =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
          return (
            <ListItemButton
              key={item.path}
              selected={selected}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
              sx={{
                borderRadius: 2,
                mb: 0.4,
                '&.Mui-selected': {
                  bgcolor: 'rgba(0, 229, 163, 0.14)',
                  color: '#00E5A3',
                  '& .MuiListItemIcon-root': { color: '#00E5A3' },
                },
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.05)',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 38, color: 'text.secondary' }}>
                {item.path === '/downloads' && activeDownloads > 0 ? (
                  <Badge badgeContent={activeDownloads} color="primary">
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontSize: 13.5, fontWeight: selected ? 700 : 500 }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        {canInstall && (
          <Button
            fullWidth
            size="small"
            variant="outlined"
            color="primary"
            startIcon={<InstallIcon />}
            onClick={() => void promptInstall()}
            sx={{ mb: 1.25 }}
          >
            Install PWA App
          </Button>
        )}
        <Typography variant="caption" color="text.secondary" display="block">
          100% Ad-Free • BYOT SaaS
        </Typography>
        <Typography variant="caption" color="primary.main" fontWeight={600} display="block">
          Authorised Free MP3s Only
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
          by AFO •{' '}
          <Link
            href="https://ameen.osperb.com"
            target="_blank"
            rel="noopener noreferrer"
            color="primary.main"
            underline="hover"
            fontWeight={600}
          >
            ameen.osperb.com
          </Link>
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <SeoHead />

      <Box
        component="nav"
        sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, border: 'none' },
          }}
        >
          {drawerContent}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, border: 'none' },
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: 'rgba(11, 14, 20, 0.88)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <Toolbar sx={{ gap: { xs: 1, sm: 2 }, justifyContent: 'space-between', px: { xs: 1.5, sm: 2.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 }, flex: 1, minWidth: 0, maxWidth: 560 }}>
              <IconButton
                color="inherit"
                edge="start"
                onClick={() => setMobileOpen(true)}
                sx={{ display: { md: 'none' } }}
                aria-label="Open navigation menu"
              >
                <MenuIcon />
              </IconButton>
              <Box component="form" onSubmit={handleQuickSearch} sx={{ width: '100%', minWidth: 0 }}>
                <TextField
                  fullWidth
                  size="small"
                  value={quickQuery}
                  onChange={(e) => setQuickQuery(e.target.value)}
                  placeholder="Search songs, artists, free MP3s..."
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                    sx: {
                      bgcolor: '#131823',
                      borderRadius: 2.5,
                      fontSize: { xs: 13, sm: 14 },
                    },
                  }}
                />
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
              {canInstall && (
                <Tooltip title="Install SONIC GRAB App">
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => void promptInstall()}
                    sx={{ display: { xs: 'inline-flex', md: 'none' } }}
                  >
                    <InstallIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}

              <Chip
                icon={<KeyIcon fontSize="small" />}
                label={
                  <Box component="span">
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                      My API Tokens{' '}
                    </Box>
                    ({configuredTokenCount}/4)
                  </Box>
                }
                size="small"
                color={configuredTokenCount > 0 ? 'primary' : 'warning'}
                variant="outlined"
                onClick={() => setTokenDialogOpen(true)}
                sx={{ cursor: 'pointer' }}
              />
            </Box>
          </Toolbar>
        </AppBar>

        <Box
          component="main"
          sx={{
            flex: 1,
            p: { xs: 1.5, sm: 3 },
            pb: {
              xs: hasPlayer ? 18 : 10,
              md: hasPlayer ? 13 : 4,
            },
            maxWidth: 1480,
            width: '100%',
            mx: 'auto',
          }}
        >
          {children}
        </Box>
      </Box>

      {/* Mobile Bottom Navigation */}
      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1150,
          display: { xs: 'block', md: 'none' },
          borderRadius: 0,
          borderTop: '1px solid rgba(255,255,255,0.1)',
          bgcolor: 'rgba(14, 18, 27, 0.96)',
          backdropFilter: 'blur(12px)',
          pb: 'env(safe-area-inset-bottom)',
        }}
      >
        <BottomNavigation
          value={bottomNavValue}
          onChange={(_, newValue: string) => navigate(newValue)}
          showLabels
          sx={{
            bgcolor: 'transparent',
            height: 56,
            '& .MuiBottomNavigationAction-root': {
              minWidth: 0,
              px: 0.5,
              color: 'text.secondary',
            },
            '& .Mui-selected': {
              color: '#00E5A3',
            },
          }}
        >
          <BottomNavigationAction label="Home" value="/" icon={<HomeIcon fontSize="small" />} />
          <BottomNavigationAction
            label="Free MP3"
            value="/free-music"
            icon={<FreeMusicIcon fontSize="small" />}
          />
          <BottomNavigationAction label="Search" value="/search" icon={<SearchIcon fontSize="small" />} />
          <BottomNavigationAction
            label="Downloads"
            value="/downloads"
            icon={
              activeDownloads > 0 ? (
                <Badge badgeContent={activeDownloads} color="primary">
                  <DownloadIcon fontSize="small" />
                </Badge>
              ) : (
                <DownloadIcon fontSize="small" />
              )
            }
          />
          <BottomNavigationAction
            label="Library"
            value="/collection"
            icon={<CollectionIcon fontSize="small" />}
          />
        </BottomNavigation>
      </Paper>

      <TokenSetupDialog
        open={tokenDialogOpen}
        onClose={() => setTokenDialogOpen(false)}
      />
      <MiniPlayer />
    </Box>
  );
};
