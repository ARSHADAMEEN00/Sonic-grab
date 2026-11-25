const INVALID_CHARS_REGEX = /[<>:"/\\|?*\x00-\x1F]/g;

export function sanitizeSegment(input: string, fallback = 'Unknown'): string {
  const cleaned = input
    .normalize('NFKD')
    .replace(INVALID_CHARS_REGEX, '')
    .replace(/\s+/g, ' ')
    .replace(/^\.+|\.+$/g, '')
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 90) : fallback;
}

export function buildMp3FileName(
  title: string,
  artist: string,
  existingNames: Set<string> = new Set(),
): string {
  const safeArtist = sanitizeSegment(artist, 'Unknown Artist');
  const safeTitle = sanitizeSegment(title, 'Untitled Track');
  const baseName = `${safeArtist} - ${safeTitle}`;
  let candidate = `${baseName}.mp3`;
  let counter = 2;
  while (existingNames.has(candidate.toLowerCase())) {
    candidate = `${baseName} (${counter}).mp3`;
    counter += 1;
  }
  existingNames.add(candidate.toLowerCase());
  return candidate;
}
