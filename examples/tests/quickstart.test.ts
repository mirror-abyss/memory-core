import { describe, it, expect, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runQuickstart } from '../quickstart';

describe('quickstart demo', () => {
  let dir: string;

  it('remembers a fact across a simulated restart', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ma1-quickstart-test-'));
    const result = await runQuickstart(dir);

    expect(result.rememberedAcrossRestart).toBe(true);
    expect(result.recalledCardIds).toContain(result.cardId);
    expect(result.systemPrompt.toLowerCase()).toContain('cloudflare');
  });

  afterAll(async () => {
    if (dir) await fs.rm(dir, { recursive: true, force: true });
  });
});
