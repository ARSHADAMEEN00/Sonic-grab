import { createTheme } from '@mui/material/styles';

export const sonicTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00E5A3',
      contrastText: '#06120E',
    },
    secondary: {
      main: '#7C4DFF',
    },
    background: {
      default: '#0B0E14',
      paper: '#131823',
    },
    text: {
      primary: '#F3F6FC',
      secondary: '#9AA4B8',
    },
    divider: 'rgba(255, 255, 255, 0.08)',
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    h4: {
      fontFamily: "'Space Grotesk', 'Inter', sans-serif",
      fontWeight: 700,
      letterSpacing: '-0.02em',
      fontSize: 'clamp(1.45rem, 4vw, 2.125rem)',
    },
    h5: {
      fontFamily: "'Space Grotesk', 'Inter', sans-serif",
      fontWeight: 700,
      letterSpacing: '-0.015em',
      fontSize: 'clamp(1.15rem, 3vw, 1.5rem)',
    },
    h6: {
      fontFamily: "'Space Grotesk', 'Inter', sans-serif",
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        'html, body': {
          overflowX: 'hidden',
          WebkitTapHighlightColor: 'transparent',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(255, 255, 255, 0.07)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#131823',
          border: '1px solid rgba(255, 255, 255, 0.07)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 10,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
      },
    },
  },
});
