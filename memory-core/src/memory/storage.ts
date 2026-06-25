import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { StorageBackend } from '../types';

/**
 * §5.2 — a JSONL/filesystem StorageBackend. Keys are backend-relative paths under a
 * base directory. Uses only `node:fs` — never a shell or child process (§7.1).
 */
export class FilesystemStorageBackend implements StorageBackend {
  constructor(private readonly baseDir: string) {}

  private resolve(key: string): string {
    const full = path.resolve(this.baseDir, key);
    const base = path.resolve(this.baseDir);
    // Prevent path traversal outside the configured base directory.
    if (full !== base && !full.startsWith(base + path.sep)) {
      throw new Error(`storage key escapes base directory: ${key}`);
    }
    return full;
  }

  async read(key: string): Promise<string | null> {
    try {
      return await fs.readFile(this.resolve(key), 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  }

  async write(key: string, content: string): Promise<void> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, 'utf8');
  }

  async append(key: string, line: string): Promise<void> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.appendFile(full, line.endsWith('\n') ? line : line + '\n', 'utf8');
  }

  async list(prefix: string): Promise<string[]> {
    const full = this.resolve(prefix);
    let dir = full;
    let filter = '';
    try {
      const stat = await fs.stat(full);
      if (!stat.isDirectory()) {
        dir = path.dirname(full);
        filter = path.basename(full);
      }
    } catch {
      dir = path.dirname(full);
      filter = path.basename(full);
    }

    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw e;
    }

    const base = path.resolve(this.baseDir);
    return entries
      .filter((name) => filter === '' || name.startsWith(filter))
      .map((name) => path.relative(base, path.join(dir, name)))
      .sort();
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * In-memory StorageBackend for tests and ephemeral hosts. Same contract as the
 * filesystem backend, no I/O.
 */
export class InMemoryStorageBackend implements StorageBackend {
  private readonly store = new Map<string, string>();

  async read(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async write(key: string, content: string): Promise<void> {
    this.store.set(key, content);
  }

  async append(key: string, line: string): Promise<void> {
    const prev = this.store.get(key) ?? '';
    this.store.set(key, prev + (line.endsWith('\n') ? line : line + '\n'));
  }

  async list(prefix: string): Promise<string[]> {
    return [...this.store.keys()].filter((k) => k.startsWith(prefix)).sort();
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }
}
