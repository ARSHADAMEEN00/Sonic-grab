import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AlbumsPage } from '../../features/discovery/AlbumsPage';
import { ArtistsPage } from '../../features/discovery/ArtistsPage';
import { FreeMusicPage } from '../../features/discovery/FreeMusicPage';
import { HomePage } from '../../features/discovery/HomePage';
import { DownloadsPage } from '../../features/downloads/DownloadsPage';
import { CollectionPage } from '../../features/library/CollectionPage';
import { LatestReleasesPage } from '../../features/releases/LatestReleasesPage';
import { SearchPage } from '../../features/search/SearchPage';
import { SettingsPage } from '../../features/settings/SettingsPage';
import { TrendingPage } from '../../features/trending/TrendingPage';

export const AppRouter: React.FC = () => (
  <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/trending" element={<TrendingPage />} />
    <Route path="/releases" element={<LatestReleasesPage />} />
    <Route path="/artists" element={<ArtistsPage />} />
    <Route path="/albums" element={<AlbumsPage />} />
    <Route path="/free-music" element={<FreeMusicPage />} />
    <Route path="/search" element={<SearchPage />} />
    <Route path="/downloads" element={<DownloadsPage />} />
    <Route path="/collection" element={<CollectionPage />} />
    <Route path="/settings" element={<SettingsPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
