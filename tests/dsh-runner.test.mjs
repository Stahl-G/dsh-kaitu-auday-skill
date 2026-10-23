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
  await assert.rejects(runner.run('shell', { command: 'echo secret' }), /unknown_operation/);
  const running = runner.run('sync');
  await Promise.resolve();
  await runner.close();
  await assert.rejects(running, { name: 'AbortError' });
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


test('missing CLT is actionable and cannot start live operations or the Apple Python shim', async () => {
  const calls = [];
  const runner = new AudayRunner({
    resolveExecutable: async () => '/usr/bin/python3',
    spawn({ argv }) {
      calls.push(argv);
      const shimCheck = argv[0] === '/usr/bin/xcode-select';
      return {
        done: Promise.resolve({ exitCode: shimCheck ? 1 : 0 }),
        collected: { stdout: { readFrom: () => ({ lossy: false, text: JSON.stringify({
          tools: { swift: '/usr/bin/swift' },
          capabilities: { core: { connectionToolchain: { ready: false, reason: 'apple_command_line_tools_missing' } } },
        }) }) } },
        terminate() {}, async waitForExit() {},
      };
    },
  }, '/synthetic', '/synthetic-cache');
  for (const operation of ['discover', 'pair', 'sync'])
    await assert.rejects(runner.run(operation, { service: 'synthetic-phone' }), /apple_command_line_tools_missing/);
  assert.ok(calls.every(argv => argv[0] === '/usr/bin/xcode-select' || argv.at(-1) === 'doctor'));
  assert.equal(runner.children.size, 0);
  assert.equal(runner.controllers.size, 0);
});

test('a missing Python executable reports the prerequisite without starting a child', async () => {
  const runner = new AudayRunner({
    async resolveExecutable() { throw new Error('Executable not found'); },
    spawn() { assert.fail('No interpreter should have been started'); },
  }, '/synthetic', '/synthetic-cache');
  await assert.rejects(runner.run('doctor'), /python_unavailable/);
  assert.equal(runner.controllers.size, 0);
});

test('unpaired sync stops before a phone request; known CLI failures keep only their safe code', async () => {
  let calls = 0, paired = false, failure = 'password_input_cancelled';
  const runner = new AudayRunner({
    resolveExecutable: async () => '/synthetic-python',
    spawn({ argv }) {
      calls++;
      const doctor = argv.at(-1) === 'doctor';
      const text = doctor ? JSON.stringify({ capabilities: { paired, core: { connectionToolchain: { ready: true } } } })
        : JSON.stringify({ ok: false, error: failure }) + '\n' + JSON.stringify({ ok: false, error: 'private diagnostic must not escape' });
      return {
        done: Promise.resolve({ exitCode: doctor ? 0 : 1 }),
        collected: { stdout: { readFrom: () => ({ lossy: false, text }) } },
        terminate() {}, async waitForExit() {},
      };
    },
  }, '/synthetic', '/synthetic-cache');
  await assert.rejects(runner.run('sync'), /^Error: not_paired$/);
  assert.equal(calls, 1);
  paired = true;
  await assert.rejects(runner.run('pair', { service: 'synthetic-phone' }), /^Error: password_input_cancelled$/);
  failure = 'unrecognized private data';
  await assert.rejects(runner.run('pair', { service: 'synthetic-phone' }), /^Error: operation_failed$/);
  assert.equal(runner.children.size, 0);
});
