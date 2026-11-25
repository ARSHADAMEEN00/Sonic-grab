export interface ZipFileEntry {
  path: string;
  data: Uint8Array;
  modifiedAt?: Date;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosTimeDate(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  return { dosTime, dosDate };
}

/**
 * Pure TypeScript Store (method 0) ZIP archive builder for browser exports.
 * Uses Store mode because MP3 files are already compressed.
 */
export function buildZipArchive(entries: ZipFileEntry[]): Blob {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const cleanPath = entry.path.replace(/^\/+/, '');
    const nameBytes = encoder.encode(cleanPath);
    const data = entry.data;
    const checksum = crc32(data);
    const { dosTime, dosDate } = toDosTimeDate(entry.modifiedAt ?? new Date());

    // Local file header (30 bytes + nameBytes.length)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const ldv = new DataView(localHeader.buffer);
    ldv.setUint32(0, 0x04034b50, true); // signature
    ldv.setUint16(4, 20, true); // version needed
    ldv.setUint16(6, 0x0800, true); // UTF-8 flag
    ldv.setUint16(8, 0, true); // compression: 0 (store)
    ldv.setUint16(10, dosTime, true);
    ldv.setUint16(12, dosDate, true);
    ldv.setUint32(14, checksum, true);
    ldv.setUint32(18, data.length, true);
    ldv.setUint32(22, data.length, true);
    ldv.setUint16(26, nameBytes.length, true);
    ldv.setUint16(28, 0, true); // extra length
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, data);

    // Central directory header (46 bytes + nameBytes.length)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cdv = new DataView(centralHeader.buffer);
    cdv.setUint32(0, 0x02014b50, true);
    cdv.setUint16(4, 20, true);
    cdv.setUint16(6, 20, true);
    cdv.setUint16(8, 0x0800, true);
    cdv.setUint16(10, 0, true);
    cdv.setUint16(12, dosTime, true);
    cdv.setUint16(14, dosDate, true);
    cdv.setUint32(16, checksum, true);
    cdv.setUint32(20, data.length, true);
    cdv.setUint32(24, data.length, true);
    cdv.setUint16(28, nameBytes.length, true);
    cdv.setUint16(30, 0, true);
    cdv.setUint16(32, 0, true);
    cdv.setUint16(34, 0, true);
    cdv.setUint16(36, 0, true);
    cdv.setUint32(38, 0, true);
    cdv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  }

  const centralSize = centralParts.reduce((acc, p) => acc + p.length, 0);
  const eocd = new Uint8Array(22);
  const edv = new DataView(eocd.buffer);
  edv.setUint32(0, 0x06054b50, true);
  edv.setUint16(4, 0, true);
  edv.setUint16(6, 0, true);
  edv.setUint16(8, entries.length, true);
  edv.setUint16(10, entries.length, true);
  edv.setUint32(12, centralSize, true);
  edv.setUint32(16, offset, true);
  edv.setUint16(20, 0, true);

  const blobParts: BlobPart[] = [
    ...localParts.map((part) => part.buffer as ArrayBuffer),
    ...centralParts.map((part) => part.buffer as ArrayBuffer),
    eocd.buffer as ArrayBuffer,
  ];
  return new Blob(blobParts, { type: 'application/zip' });
}
