import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AudayRunner, submitNotes } from '../adapters/dsh/runner.mjs';

test('selected revisions enter the existing inbox once per pending file', () => {
  const root = mkdtempSync(join(tmpdir(), 'auday-inbox-'));
  try {
    mkdirSync(join(root, '.kaitu'));
    writeFileSync(join(root, '.kaitu/config.json'), '{}');
    const note = { name: `auday-${'a'.repeat(64)}-${'b'.repeat(64)}.md`, text: 'Synthetic candidate' };
    submitNotes(root, [note]); submitNotes(root, [note]);
    assert.equal(readdirSync(join(root, 'inbox/agents')).length, 1);
    assert.equal(readFileSync(join(root, 'inbox/agents', note.name), 'utf8'), note.text);
  } finally { rmSync(root, { recursive: true }); }
});

test('fixed operations reject arbitrary commands; cancellation waits for the managed range', async () => {
  let finish, terminated = false, waited = false;
  const child = {
    done: new Promise(resolve => { finish = resolve; }),
    terminate() { terminated = true; finish({ exitCode: null }); },
    async waitForExit() { waited = true; return true; },
  };
  const runner = new AudayRunner({ resolveExecutable: async value => value, spawn: () => child }, '/synthetic', '/synthetic-cache');
  await assert.rejects(runner.run('shell', { command: 'echo secret' }), /Unknown Auday operation/);
  const running = runner.run('sync');
  await Promise.resolve();
  await runner.close();
  await assert.rejects(running, /did not complete/);
  assert.equal(terminated && waited, true);
  assert.equal(runner.children.size, 0);
});

test('cancel during executable lookup cannot start a late child', async () => {
  let resolveLookup;
  const runner = new AudayRunner({
    resolveExecutable: () => new Promise(resolve => { resolveLookup = resolve; }),
    spawn() { assert.fail('Canceled lookup started a child'); },
  }, '/synthetic', '/synthetic-cache');
  const running = runner.run('sync');
  await runner.close();
  resolveLookup('/synthetic-python');
  await assert.rejects(running, { name: 'AbortError' });
});
