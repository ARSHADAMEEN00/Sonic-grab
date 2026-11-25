export function triggerBrowserBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function triggerDirectBrowserDownload(url: string, fileName: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export async function validateMp3Blob(blob: Blob): Promise<{
  valid: boolean;
  reason?: string;
}> {
  if (blob.size < 1024) {
    return { valid: false, reason: 'File is too small to be a valid MP3 audio file.' };
  }
  const type = blob.type.toLowerCase();
  if (type.includes('text/html') || type.includes('application/json')) {
    return { valid: false, reason: `Unexpected response content type (${type}).` };
  }
  const headerSlice = await blob.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(headerSlice);
  const isId3 = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
  const isMpegFrame = bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
  const isAudioMime =
    type.startsWith('audio/') || type === 'application/octet-stream' || type === '';

  if (!isAudioMime && !isId3 && !isMpegFrame) {
    return { valid: false, reason: `Unrecognised audio header (${type || 'unknown'}).` };
  }
  return { valid: true };
}
