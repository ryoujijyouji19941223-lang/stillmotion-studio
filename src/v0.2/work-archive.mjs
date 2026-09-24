// A small ZIP (stored entries) implementation so editing backups work offline.
// Page images and compressed audio are already compressed; ZIP's store method
// avoids a second, slow compression pass and preserves the original bytes.
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
export const MAX_WORK_ARCHIVE_BYTES = 512 * 1024 * 1024;

const crcTable = Array.from({ length: 256 }, (_, i) => {
  let n = i;
  for (let j = 0; j < 8; j++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0);
  return n >>> 0;
});

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function header(size) {
  const bytes = new Uint8Array(size);
  return { bytes, view: new DataView(bytes.buffer) };
}

export async function writeWorkZip(entries) {
  if (!Array.isArray(entries) || !entries.length || entries.length > 500) throw new Error('保存するファイル数が多すぎます。');
  const names = new Set();
  const pieces = [];
  const directory = [];
  let offset = 0;
  let directorySize = 0;
  for (const { path, blob } of entries) {
    if (typeof path !== 'string' || !path || path.startsWith('/') || path.includes('..') || path.includes('\\') || names.has(path)) {
      throw new Error('保存するファイル名が正しくありません。');
    }
    names.add(path);
    if (!(blob instanceof Blob)) throw new Error('保存する素材を読み込めませんでした。');
    const name = encoder.encode(path);
    if (name.length > 65535) throw new Error('保存するファイル名が長すぎます。');
    if (offset + 30 + name.length + blob.size + directorySize + 46 + name.length + 22 > MAX_WORK_ARCHIVE_BYTES) throw new Error('素材の合計が512MBを超えています。');
    const data = new Uint8Array(await blob.arrayBuffer());
    const checksum = crc32(data);
    const local = header(30);
    local.view.setUint32(0, 0x04034b50, true);
    local.view.setUint16(4, 20, true);
    local.view.setUint16(6, 0x0800, true);
    local.view.setUint32(14, checksum, true);
    local.view.setUint32(18, data.length, true);
    local.view.setUint32(22, data.length, true);
    local.view.setUint16(26, name.length, true);
    pieces.push(local.bytes, name, data);
    const central = header(46);
    central.view.setUint32(0, 0x02014b50, true);
    central.view.setUint16(4, 20, true);
    central.view.setUint16(6, 20, true);
    central.view.setUint16(8, 0x0800, true);
    central.view.setUint32(16, checksum, true);
    central.view.setUint32(20, data.length, true);
    central.view.setUint32(24, data.length, true);
    central.view.setUint16(28, name.length, true);
    central.view.setUint32(42, offset, true);
    directory.push(central.bytes, name);
    offset += 30 + name.length + data.length;
    directorySize += 46 + name.length;
  }
  const end = header(22);
  end.view.setUint32(0, 0x06054b50, true);
  end.view.setUint16(8, entries.length, true);
  end.view.setUint16(10, entries.length, true);
  end.view.setUint32(12, directorySize, true);
  end.view.setUint32(16, offset, true);
  return new Blob([...pieces, ...directory, end.bytes], { type: 'application/zip' });
}

export async function readWorkZip(file) {
  if (!file || file.size > MAX_WORK_ARCHIVE_BYTES || file.size < 22) throw new Error('編集用ZIPが大きすぎるか、正しくありません。');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw new Error('編集用ZIPを読み取れません。');
  const count = view.getUint16(end + 10, true);
  const size = view.getUint32(end + 12, true);
  let at = view.getUint32(end + 16, true);
  if (count > 500 || at + size !== end) throw new Error('編集用ZIPの構造が正しくありません。');
  const files = new Map();
  const directoryStart = at;
  const directoryEnd = at + size;
  for (let i = 0; i < count; i++) {
    if (at + 46 > directoryEnd || view.getUint32(at, true) !== 0x02014b50) throw new Error('編集用ZIPの一覧が壊れています。');
    const method = view.getUint16(at + 10, true);
    const checksum = view.getUint32(at + 16, true);
    const length = view.getUint32(at + 20, true);
    const rawLength = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extra = view.getUint16(at + 30, true);
    const comment = view.getUint16(at + 32, true);
    const localOffset = view.getUint32(at + 42, true);
    const next = at + 46 + nameLength + extra + comment;
    if (next > directoryEnd || method !== 0 || length !== rawLength || localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('未対応または破損した編集用ZIPです。');
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    if (!name || name.startsWith('/') || name.includes('..') || name.includes('\\') || files.has(name)) throw new Error('編集用ZIPのファイル名が正しくありません。');
    const localNameLength = view.getUint16(localOffset + 26, true);
    const start = localOffset + 30 + localNameLength + view.getUint16(localOffset + 28, true);
    if (localOffset + 30 + localNameLength > bytes.length || decoder.decode(bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength)) !== name || start + length > directoryStart || crc32(bytes.subarray(start, start + length)) !== checksum) {
      throw new Error('編集用ZIPの素材が壊れています。');
    }
    files.set(name, bytes.subarray(start, start + length));
    at = next;
  }
  if (at !== directoryEnd) throw new Error('編集用ZIPの一覧が壊れています。');
  return files;
}
