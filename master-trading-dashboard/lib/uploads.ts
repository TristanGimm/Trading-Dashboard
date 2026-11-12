import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type ImageType = { mime: string; ext: string };

const MAX_UPLOAD_MB = Math.max(1, Math.min(50, Number(process.env.MAX_UPLOAD_MB || 12)));

export function uploadLimitBytes(): number {
  return MAX_UPLOAD_MB * 1024 * 1024;
}

function uploadDirectory(): string {
  return path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
}

/** Identify images by magic bytes; the client-provided MIME type is not trusted. */
export function detectImage(buffer: Buffer): ImageType | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  if (buffer.length >= 6) {
    const header = buffer.subarray(0, 6).toString('ascii');
    if (header === 'GIF87a' || header === 'GIF89a') return { mime: 'image/gif', ext: 'gif' };
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { mime: 'image/webp', ext: 'webp' };
  }
  return null;
}

export async function saveUpload(id: string, ext: string, data: Buffer): Promise<string> {
  if (!/^[a-f0-9-]{36}$/i.test(id) || !/^[a-z0-9]{2,5}$/.test(ext)) throw new Error('Invalid upload name.');
  const directory = uploadDirectory();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const filename = `${id}.${ext}`;
  await writeFile(path.join(directory, filename), data, { mode: 0o600 });
  return filename;
}

export async function readUpload(filename: string): Promise<Buffer> {
  if (path.basename(filename) !== filename) throw new Error('Invalid upload path.');
  return readFile(path.join(uploadDirectory(), filename));
}

export async function deleteUpload(filename: string): Promise<void> {
  if (!filename || path.basename(filename) !== filename) return;
  try {
    await unlink(path.join(uploadDirectory(), filename));
  } catch {
    // A missing file is already the desired state.
  }
}
