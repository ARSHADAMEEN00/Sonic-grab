import React, { useEffect } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import { useAppDispatch } from './app/store/hooks';
import { AppRouter } from './app/router/AppRouter';
import { sonicTheme } from './app/theme';
import { AppShell } from './components/layout/AppShell';
import { hydrateLibrary } from './features/library/librarySlice';

const Bootstrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    void dispatch(hydrateLibrary());
  }, [dispatch]);

  return <>{children}</>;
};

export const App: React.FC = () => (
  <ThemeProvider theme={sonicTheme}>
    <CssBaseline />
    <BrowserRouter>
      <Bootstrapper>
        <AppShell>
          <AppRouter />
        </AppShell>
      </Bootstrapper>
    </BrowserRouter>
  </ThemeProvider>
);

export default App;
