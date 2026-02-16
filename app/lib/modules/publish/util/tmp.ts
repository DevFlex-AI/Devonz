import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { randomBytes } from 'crypto';
import { getTempPath, cleanTempDirectory, ensureDirectory } from './fsSafe';

/**
 * Temporary directory and file management
 */

/**
 * Create a unique temporary directory
 */
export async function createTempDir(prefix: string = 'publish-'): Promise<string> {
  const uniqueId = randomBytes(8).toString('hex');
  const tempDir = path.join(getTempPath(), `${prefix}${uniqueId}`);
  await ensureDirectory(tempDir);
  return tempDir;
}

/**
 * Create a temporary file with content
 */
export async function createTempFile(
  content: string | Buffer,
  prefix: string = 'file-',
  extension: string = '.tmp',
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const uniqueId = randomBytes(8).toString('hex');
  const tempDir = getTempPath();
  const fileName = `${prefix}${uniqueId}${extension}`;
  const filePath = path.join(tempDir, fileName);

  await ensureDirectory(tempDir);
  await fs.writeFile(filePath, content);

  const cleanup = async () => {
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore errors
    }
  };

  return { path: filePath, cleanup };
}

/**
 * Write buffer to temporary file
 */
export async function writeBufferToTemp(
  buffer: Buffer,
  prefix: string = 'buffer-',
  extension: string = '.bin',
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  return createTempFile(buffer, prefix, extension);
}

/**
 * Write base64 to temporary file
 */
export async function writeBase64ToTemp(
  base64: string,
  prefix: string = 'base64-',
  extension: string = '.bin',
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const buffer = Buffer.from(base64, 'base64');
  return writeBufferToTemp(buffer, prefix, extension);
}

/**
 * Create temporary directory with auto-cleanup
 */
export async function createTempDirWithCleanup(
  prefix: string = 'publish-',
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const tempDir = await createTempDir(prefix);

  const cleanup = async () => {
    await cleanTempDirectory(tempDir);
  };

  return { path: tempDir, cleanup };
}

/**
 * Temporary directory manager
 */
export class TempDirManager {
  private directories: string[] = [];
  private files: string[] = [];

  async createDir(prefix: string = 'publish-'): Promise<string> {
    const tempDir = await createTempDir(prefix);
    this.directories.push(tempDir);
    return tempDir;
  }

  async createFile(
    content: string | Buffer,
    prefix: string = 'file-',
    extension: string = '.tmp',
  ): Promise<string> {
    const result = await createTempFile(content, prefix, extension);
    this.files.push(result.path);
    return result.path;
  }

  async cleanup(): Promise<void> {
    const errors: Error[] = [];

    for (const filePath of this.files) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        errors.push(error as Error);
      }
    }

    for (const dirPath of this.directories) {
      try {
        await cleanTempDirectory(dirPath);
      } catch (error) {
        errors.push(error as Error);
      }
    }

    this.files = [];
    this.directories = [];

    if (errors.length > 0) {
      throw new Error(`Cleanup errors: ${errors.map((e) => e.message).join(', ')}`);
    }
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.cleanup();
  }
}

/**
 * Create scoped temporary directory manager
 */
export async function withTempDir<T>(
  fn: (manager: TempDirManager, dir: string) => Promise<T>,
): Promise<T> {
  const manager = new TempDirManager();
  const tempDir = await manager.createDir();

  try {
    return await fn(manager, tempDir);
  } finally {
    await manager.cleanup();
  }
}

/**
 * Download file to temporary directory
 */
export async function downloadToTemp(
  url: string,
  prefix: string = 'download-',
  extension: string = '',
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return writeBufferToTemp(buffer, prefix, extension);
}
