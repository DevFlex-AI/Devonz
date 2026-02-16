import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';

/**
 * Safe file system operations with security checks
 */

/**
 * Validate that a path is safe (no directory traversal)
 */
export function validateSafePath(basePath: string, targetPath: string): boolean {
  const resolved = path.resolve(basePath, targetPath);
  return resolved.startsWith(path.resolve(basePath));
}

/**
 * Read file with path validation
 */
export async function safeReadFile(basePath: string, filePath: string): Promise<string | null> {
  if (!validateSafePath(basePath, filePath)) {
    throw new Error('Invalid file path: potential directory traversal');
  }

  const fullPath = path.join(basePath, filePath);

  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    return content;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Write file with path validation and directory creation
 */
export async function safeWriteFile(basePath: string, filePath: string, content: string): Promise<void> {
  if (!validateSafePath(basePath, filePath)) {
    throw new Error('Invalid file path: potential directory traversal');
  }

  const fullPath = path.join(basePath, filePath);
  const dir = path.dirname(fullPath);

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(fullPath, content, 'utf-8');
}

/**
 * Delete file with path validation
 */
export async function safeDeleteFile(basePath: string, filePath: string): Promise<void> {
  if (!validateSafePath(basePath, filePath)) {
    throw new Error('Invalid file path: potential directory traversal');
  }

  const fullPath = path.join(basePath, filePath);

  try {
    await fs.unlink(fullPath);
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Check if file exists
 */
export async function safeFileExists(basePath: string, filePath: string): Promise<boolean> {
  if (!validateSafePath(basePath, filePath)) {
    return false;
  }

  const fullPath = path.join(basePath, filePath);

  try {
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file stats
 */
export async function safeFileStats(basePath: string, filePath: string): Promise<{ size: number } | null> {
  if (!validateSafePath(basePath, filePath)) {
    return null;
  }

  const fullPath = path.join(basePath, filePath);

  try {
    const stats = await fs.stat(fullPath);
    return { size: stats.size };
  } catch {
    return null;
  }
}

/**
 * Calculate file hash
 */
export async function calculateFileHash(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Read JSON file safely
 */
export async function safeReadJSON<T>(basePath: string, filePath: string): Promise<T | null> {
  const content = await safeReadFile(basePath, filePath);
  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Write JSON file safely
 */
export async function safeWriteJSON<T>(basePath: string, filePath: string, data: T): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  await safeWriteFile(basePath, filePath, content);
}

/**
 * List directory contents with filtering
 */
export async function safeListDirectory(
  basePath: string,
  dirPath: string,
  extensions: string[] = [],
): Promise<string[]> {
  if (!validateSafePath(basePath, dirPath)) {
    throw new Error('Invalid directory path: potential directory traversal');
  }

  const fullPath = path.join(basePath, dirPath);

  try {
    const entries = await fs.readdir(fullPath);

    if (extensions.length === 0) {
      return entries;
    }

    return entries.filter((entry) => {
      const ext = path.extname(entry).toLowerCase();
      return extensions.includes(ext);
    });
  } catch {
    return [];
  }
}

/**
 * Ensure directory exists
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Get temporary directory path
 */
export function getTempPath(subPath: string = ''): string {
  const baseTemp = process.env.TMPDIR || '/tmp';
  return subPath ? path.join(baseTemp, subPath) : baseTemp;
}

/**
 * Clean temporary directory
 */
export async function cleanTempDirectory(tempPath: string): Promise<void> {
  try {
    await fs.rm(tempPath, { recursive: true, force: true });
  } catch {
    // Ignore errors
  }
}
