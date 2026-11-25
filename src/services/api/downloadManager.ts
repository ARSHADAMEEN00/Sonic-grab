import type { AppDispatch, RootState } from '../../app/store/store';
import {
  enqueueDownloadItem,
  setDownloadStatus,
  updateDownloadItem,
} from '../../features/downloads/downloadsSlice';
import { recordDownloadHistory } from '../../features/library/librarySlice';
import type { DownloadQueueItem, Track } from '../../types/music';
import { buildMp3FileName } from '../../utils/filename';
import {
  triggerBrowserBlobDownload,
  triggerDirectBrowserDownload,
  validateMp3Blob,
} from '../../utils/fileSystem';
import { getAllAudioBlobs, saveAudioBlob } from '../../utils/indexedDb';
import { buildZipArchive, type ZipFileEntry } from '../../utils/zipBuilder';

const activeControllers = new Map<string, AbortController>();

function normalizeTrackSignature(title: string, artist: string): string {
  return `${artist.trim().toLowerCase()}::${title.trim().toLowerCase()}`;
}

export interface DuplicateCheckResult {
  duplicates: Array<{
    track: Track;
    reason: 'active-queue' | 'already-downloaded';
    downloadedAt?: string;
  }>;
  freshTracks: Track[];
}

export function checkDuplicateDownloads(
  tracks: Track[],
  state: RootState,
): DuplicateCheckResult {
  const activeQueueIds = new Set<string>();
  const activeQueueSigs = new Set<string>();
  const completedQueueIds = new Set<string>();
  const completedQueueSigs = new Set<string>();

  for (const q of state.downloads.queue) {
    const sig = normalizeTrackSignature(q.track.title, q.track.artist);
    if (q.status === 'queued' || q.status === 'downloading' || q.status === 'validating') {
      activeQueueIds.add(q.track.id);
      activeQueueSigs.add(sig);
    } else if (q.status === 'completed' || q.status === 'cors-fallback') {
      completedQueueIds.add(q.track.id);
      completedQueueSigs.add(sig);
    }
  }

  const historyById = new Map(
    state.library.downloadHistory.map((h) => [h.trackId, h]),
  );
  const historyBySig = new Map(
    state.library.downloadHistory.map((h) => [
      normalizeTrackSignature(h.title, h.artist),
      h,
    ]),
  );

  const duplicates: DuplicateCheckResult['duplicates'] = [];
  const freshTracks: Track[] = [];

  for (const track of tracks) {
    const sig = normalizeTrackSignature(track.title, track.artist);
    if (activeQueueIds.has(track.id) || activeQueueSigs.has(sig)) {
      duplicates.push({ track, reason: 'active-queue' });
      continue;
    }

    const histMatch = historyById.get(track.id) ?? historyBySig.get(sig);
    if (histMatch || completedQueueIds.has(track.id) || completedQueueSigs.has(sig)) {
      duplicates.push({
        track,
        reason: 'already-downloaded',
        downloadedAt: histMatch?.downloadedAt,
      });
      continue;
    }

    freshTracks.push(track);
  }

  return { duplicates, freshTracks };
}

export function cancelQueuedDownload(
  itemId: string,
  dispatch: AppDispatch,
  getState?: () => RootState,
): void {
  const controller = activeControllers.get(itemId);
  if (controller) {
    controller.abort();
    activeControllers.delete(itemId);
  }
  dispatch(setDownloadStatus({ id: itemId, status: 'cancelled' }));
  if (getState) {
    pumpDownloadQueue(dispatch, getState);
  }
}

export interface EnqueueOptions {
  allowDuplicates?: boolean;
}

/**
 * Enqueues one or many authorised tracks without capping total queue size.
 * Concurrency is controlled automatically via `maxConcurrentDownloads`.
 */
export function enqueueTracksForDownload(
  tracks: Track[],
  dispatch: AppDispatch,
  getState: () => RootState,
  options: EnqueueOptions = {},
): { queuedCount: number; skippedCount: number } {
  const { allowDuplicates = false } = options;
  const state = getState();
  const existingNames = new Set(
    state.library.downloadHistory.map((h) => h.fileName.toLowerCase()),
  );
  for (const q of state.downloads.queue) {
    existingNames.add(q.fileName.toLowerCase());
  }

  const dupReport = checkDuplicateDownloads(tracks, state);
  const duplicateSet = new Set(dupReport.duplicates.map((d) => d.track.id));
  const activeSet = new Set(
    dupReport.duplicates
      .filter((d) => d.reason === 'active-queue')
      .map((d) => d.track.id),
  );

  let queuedCount = 0;
  let skippedCount = 0;

  for (const track of tracks) {
    if (
      track.availability !== 'FREE DOWNLOAD AVAILABLE' ||
      !track.downloadInfo?.verified ||
      !track.downloadInfo.downloadUrl
    ) {
      skippedCount += 1;
      continue;
    }

    if (activeSet.has(track.id)) {
      skippedCount += 1;
      continue;
    }

    if (!allowDuplicates && duplicateSet.has(track.id)) {
      skippedCount += 1;
      continue;
    }

    const fileName = buildMp3FileName(track.title, track.artist, existingNames);
    const queueItem: DownloadQueueItem = {
      id: `dl-${track.id}-${Date.now()}-${queuedCount}`,
      track,
      fileName,
      status: 'queued',
      progressPercent: 0,
      bytesReceived: 0,
      totalBytes: track.downloadInfo.fileSizeBytes,
      createdAt: new Date().toISOString(),
    };
    dispatch(enqueueDownloadItem(queueItem));
    queuedCount += 1;
  }

  pumpDownloadQueue(dispatch, getState);
  return { queuedCount, skippedCount };
}

export async function startTrackDownload(
  track: Track,
  dispatch: AppDispatch,
  getState: () => RootState,
  options: EnqueueOptions = {},
): Promise<{ started: boolean; reason?: string }> {
  const { queuedCount } = enqueueTracksForDownload([track], dispatch, getState, options);
  if (queuedCount === 0) {
    return {
      started: false,
      reason: 'Track is already downloaded/queued or has no authorised MP3 URL.',
    };
  }
  return { started: true };
}

export function retryDownloadItem(
  item: DownloadQueueItem,
  dispatch: AppDispatch,
  getState: () => RootState,
): void {
  dispatch(
    updateDownloadItem({
      id: item.id,
      patch: {
        status: 'queued',
        progressPercent: 0,
        bytesReceived: 0,
        errorMessage: undefined,
      },
    }),
  );
  pumpDownloadQueue(dispatch, getState);
}

export function pumpDownloadQueue(
  dispatch: AppDispatch,
  getState: () => RootState,
): void {
  const state = getState();
  const maxConcurrent = Math.max(1, state.settings.maxConcurrentDownloads || 3);
  const runningCount = state.downloads.queue.filter(
    (q) => q.status === 'downloading' || q.status === 'validating',
  ).length;

  const availableSlots = Math.max(0, maxConcurrent - runningCount);
  if (availableSlots === 0) return;

  const nextItems = state.downloads.queue
    .filter((q) => q.status === 'queued')
    .slice(0, availableSlots);

  nextItems.forEach((item, index) => {
    if (index === 0) {
      void executeDownload(item, dispatch, getState);
    } else {
      setTimeout(() => {
        void executeDownload(item, dispatch, getState);
      }, index * 250);
    }
  });
}

async function executeDownload(
  item: DownloadQueueItem,
  dispatch: AppDispatch,
  getState: () => RootState,
): Promise<void> {
  const downloadUrl = item.track.downloadInfo?.downloadUrl;
  if (!downloadUrl) {
    dispatch(
      setDownloadStatus({
        id: item.id,
        status: 'failed',
        errorMessage: 'Missing authorised download URL.',
      }),
    );
    pumpDownloadQueue(dispatch, getState);
    return;
  }

  const controller = new AbortController();
  activeControllers.set(item.id, controller);
  dispatch(setDownloadStatus({ id: item.id, status: 'downloading' }));

  const fallbackToDirectLink = (reasonText: string) => {
    const activeBatchCount = getState().downloads.queue.filter(
      (q) =>
        q.status === 'queued' ||
        q.status === 'downloading' ||
        q.status === 'validating' ||
        q.status === 'cors-fallback',
    ).length;

    // Only auto-open for single-item downloads so batch runs don't trigger browser popup blockers
    if (activeBatchCount <= 1) {
      triggerDirectBrowserDownload(downloadUrl, item.fileName);
    }

    dispatch(
      updateDownloadItem({
        id: item.id,
        patch: {
          status: 'cors-fallback',
          errorMessage: reasonText,
        },
      }),
    );
    dispatch(
      recordDownloadHistory({
        id: `hist-${item.track.id}`,
        trackId: item.track.id,
        title: item.track.title,
        artist: item.track.artist,
        album: item.track.album,
        language: item.track.language,
        provider: item.track.provider,
        licence: item.track.downloadInfo?.licence ?? 'Authorised Free Licence',
        fileName: item.fileName,
        fileSizeBytes: item.track.downloadInfo?.fileSizeBytes,
        sourcePageUrl: item.track.sourceUrl,
        downloadedAt: new Date().toISOString(),
        method: 'browser-direct-link',
        hasLocalBlob: false,
      }),
    );
  };

  try {
    const response = await fetch(downloadUrl, {
      method: 'GET',
      mode: 'cors',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Provider responded with HTTP ${response.status}`);
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('text/html') || contentType.includes('application/json')) {
      controller.abort();
      fallbackToDirectLink(
        'Provider returned a web download/redirect page instead of raw MP3 bytes. Use "Direct Download MP3" or "Open Source Page" to download in browser.',
      );
      return;
    }

    const contentLengthHeader = response.headers.get('content-length');
    const totalBytes = contentLengthHeader
      ? Number.parseInt(contentLengthHeader, 10)
      : item.totalBytes;

    let blob: Blob;
    if (response.body) {
      const reader = response.body.getReader();
      const chunks: BlobPart[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(
            value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength),
          );
          received += value.byteLength;
          const pct =
            totalBytes && totalBytes > 0
              ? Math.min(99, Math.round((received / totalBytes) * 100))
              : 0;
          dispatch(
            updateDownloadItem({
              id: item.id,
              patch: {
                bytesReceived: received,
                totalBytes,
                progressPercent: pct,
              },
            }),
          );
        }
      }
      blob = new Blob(chunks, { type: contentType || 'audio/mpeg' });
    } else {
      blob = await response.blob();
    }

    dispatch(setDownloadStatus({ id: item.id, status: 'validating' }));
    const validation = await validateMp3Blob(blob);
    if (!validation.valid) {
      if ((validation.reason || '').toLowerCase().includes('text/html')) {
        fallbackToDirectLink(
          'Provider returned a web download page instead of raw MP3 bytes. Use "Direct Download MP3" or "Open Source Page".',
        );
        return;
      }
      throw new Error(validation.reason || 'Downloaded file failed MP3 validation.');
    }

    await saveAudioBlob({
      trackId: item.track.id,
      fileName: item.fileName,
      mimeType: blob.type || 'audio/mpeg',
      sizeBytes: blob.size,
      blob,
      savedAt: new Date().toISOString(),
    });

    triggerBrowserBlobDownload(blob, item.fileName);

    dispatch(
      updateDownloadItem({
        id: item.id,
        patch: {
          status: 'completed',
          progressPercent: 100,
          bytesReceived: blob.size,
          totalBytes: blob.size,
          storedInIndexedDb: true,
          completedAt: new Date().toISOString(),
        },
      }),
    );

    dispatch(
      recordDownloadHistory({
        id: `hist-${item.track.id}`,
        trackId: item.track.id,
        title: item.track.title,
        artist: item.track.artist,
        album: item.track.album,
        language: item.track.language,
        provider: item.track.provider,
        licence: item.track.downloadInfo?.licence ?? 'Authorised Free Licence',
        fileName: item.fileName,
        fileSizeBytes: blob.size,
        sourcePageUrl: item.track.sourceUrl,
        downloadedAt: new Date().toISOString(),
        method: 'browser-blob',
        hasLocalBlob: true,
      }),
    );
  } catch (err) {
    if (controller.signal.aborted) {
      if (getState().downloads.queue.find((q) => q.id === item.id)?.status !== 'cors-fallback') {
        dispatch(setDownloadStatus({ id: item.id, status: 'cancelled' }));
      }
      return;
    }

    const message = err instanceof Error ? err.message : 'Download failed';
    const lowerMsg = message.toLowerCase();
    const likelyCors =
      err instanceof TypeError ||
      lowerMsg.includes('failed to fetch') ||
      lowerMsg.includes('load failed') ||
      lowerMsg.includes('networkerror') ||
      lowerMsg.includes('cors');

    if (likelyCors) {
      fallbackToDirectLink(
        'Browser fetch blocked by provider CORS policy (common on Safari/CDN redirects). Click "Direct Download MP3" to save directly through your browser.',
      );
    } else {
      dispatch(
        setDownloadStatus({
          id: item.id,
          status: 'failed',
          errorMessage: message,
        }),
      );
    }
  } finally {
    activeControllers.delete(item.id);
    pumpDownloadQueue(dispatch, getState);
  }
}

export async function exportCachedTracksAsZip(
  trackIds?: string[],
  zipFileName = 'sonic-grab-downloads.zip',
): Promise<number> {
  const records = await getAllAudioBlobs();
  const filtered =
    trackIds && trackIds.length > 0
      ? records.filter((r) => trackIds.includes(r.trackId))
      : records;

  if (filtered.length === 0) return 0;

  const entries: ZipFileEntry[] = [];
  for (const rec of filtered) {
    const buf = await rec.blob.arrayBuffer();
    entries.push({
      path: rec.fileName,
      data: new Uint8Array(buf),
      modifiedAt: new Date(rec.savedAt),
    });
  }
  const zipBlob = buildZipArchive(entries);
  triggerBrowserBlobDownload(zipBlob, zipFileName);
  return entries.length;
}
