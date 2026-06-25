import { describe, it, expect, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { FilesystemStorageBackend, InMemoryStorageBackend } from '../src/memory/storage';

describe('InMemoryStorageBackend', () => {
  it('reads, writes, appends, lists, checks existence', async () => {
    const s = new InMemoryStorageBackend();
    expect(await s.read('k')).toBeNull();
    expect(await s.exists('k')).toBe(false);
    await s.write('a/b.json', 'hello');
    expect(await s.read('a/b.json')).toBe('hello');
    expect(await s.exists('a/b.json')).toBe(true);
    await s.append('log.jsonl', '{"n":1}');
    await s.append('log.jsonl', '{"n":2}');
    expect(await s.read('log.jsonl')).toBe('{"n":1}\n{"n":2}\n');
    expect(await s.list('a/')).toEqual(['a/b.json']);
  });
});

describe('FilesystemStorageBackend', () => {
  let dir: string;

  it('round-trips through the filesystem', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ma1-store-'));
    const s = new FilesystemStorageBackend(dir);
    expect(await s.read('nope.txt')).toBeNull();
    await s.write('cards/c1.json', '{"id":"c1"}');
    expect(await s.read('cards/c1.json')).toBe('{"id":"c1"}');
    expect(await s.exists('cards/c1.json')).toBe(true);
    await s.append('index.jsonl', 'line1');
    await s.append('index.jsonl', 'line2');
    expect(await s.read('index.jsonl')).toBe('line1\nline2\n');
    const listed = await s.list('cards');
    expect(listed.some((k) => k.endsWith('c1.json'))).toBe(true);
  });

  it('rejects path traversal outside the base directory', async () => {
    const s = new FilesystemStorageBackend(dir);
    await expect(s.read('../escape.txt')).rejects.toThrow(/escapes base/);
  });

  afterAll(async () => {
    if (dir) await fs.rm(dir, { recursive: true, force: true });
  });
});
