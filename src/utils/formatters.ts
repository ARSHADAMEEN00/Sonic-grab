export function formatDuration(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '—';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatBytes(bytes?: number): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return 'Unknown size';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIdx = 0;
  while (value >= 1024 && unitIdx < units.length - 1) {
    value /= 1024;
    unitIdx += 1;
  }
  return `${value.toFixed(unitIdx === 0 ? 0 : 1)} ${units[unitIdx]}`;
}

export function formatReleaseDate(dateStr?: string): string {
  if (!dateStr) return 'Unknown date';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}
