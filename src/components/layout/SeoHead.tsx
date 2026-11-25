import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface RouteMeta {
  title: string;
  description: string;
}

const ROUTE_SEO: Record<string, RouteMeta> = {
  '/': {
    title: 'SONIC GRAB — Ad-Free Music Discovery & Free Legal MP3 Downloads',
    description:
      'Discover ad-free music with zero audio ads, live trending charts, and verified free Creative Commons & Public Domain MP3 downloads.',
  },
  '/free-music': {
    title: 'Discover Free Downloadable MP3s (Ad-Free) — SONIC GRAB',
    description:
      'Browse and batch-download verified Creative Commons & Public Domain MP3 music with zero ads and full licence transparency.',
  },
  '/trending': {
    title: 'Ad-Free Trending Charts Worldwide & India — SONIC GRAB',
    description:
      'Explore live global and Indian trending songs and albums in a clean, ad-free music interface.',
  },
  '/releases': {
    title: 'Latest Music Releases (Ad-Free) — SONIC GRAB',
    description:
      'Track the newest albums and singles from international and Indian artists with zero ads.',
  },
  '/artists': {
    title: 'Artist Catalogue & Releases — SONIC GRAB',
    description:
      'Follow international and Indian artists and browse their latest releases and free CC audio.',
  },
  '/albums': {
    title: 'Explore Music Albums (Ad-Free) — SONIC GRAB',
    description:
      'Inspect live album tracklists and discover free downloadable releases without ads.',
  },
  '/search': {
    title: 'Search Ad-Free Music & Free MP3 Downloads — SONIC GRAB',
    description:
      'Unified search across ad-free music discovery and legal downloadable MP3 tracks by song, artist, album, genre, and language.',
  },
  '/downloads': {
    title: 'MP3 Download Manager & History — SONIC GRAB',
    description:
      'Manage active MP3 downloads, duplicate detection, and ZIP exports in your browser.',
  },
  '/collection': {
    title: 'My Ad-Free Music Collection & Playlists — SONIC GRAB',
    description:
      'Play cached MP3s and manage your personal ad-free playlists and favourite songs.',
  },
  '/settings': {
    title: 'Settings & API Tokens (BYOT) — SONIC GRAB',
    description:
      'Configure your own private browser API tokens for Jamendo, Apple Music, Spotify, and SoundCloud.',
  },
};

function upsertMeta(selector: string, attrName: 'name' | 'property', key: string, content: string): void {
  let el = document.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export const SeoHead: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = ROUTE_SEO[pathname] ?? ROUTE_SEO['/'];
    document.title = meta.title;
    upsertMeta('meta[name="description"]', 'name', 'description', meta.description);
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', meta.title);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', meta.description);
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', meta.title);
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', meta.description);

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', `${window.location.origin}${pathname}`);
  }, [pathname]);

  return null;
};
