import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AudayRunner, submitNotes } from '../adapters/dsh/runner.mjs';
import { AudayService } from '../dist/index.js';
import { Context } from '@deepseek-ai/cordis';

test('unsupported hosts reject core operations before starting Python; cancel remains available', {
  skip: process.platform === 'darwin',
}, async () => {
  const runner = new AudayRunner({
    resolveExecutable() { assert.fail('Unsupported host resolved Python'); },
    spawn() { assert.fail('Unsupported host started a subprocess'); },
  }, '/synthetic', '/synthetic-cache');
  const service = new AudayService(new Context(), runner, '/synthetic');
  for (const operation of ['doctor', 'status', 'discover', 'pair', 'sync', 'search', 'preview', 'import'])
    await assert.rejects(service.request(operation, '{}'), /^Error: macOS_required$/);
  assert.equal(await service.request('cancel', '{}'), '{}');
  assert.equal(runner.children.size, 0);
  assert.equal(runner.controllers.size, 0);
});

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

test('unknown operations start no child; cancellation waits for the managed range', async () => {
  let finish, terminated = false, waited = false, spawned = false;
  const child = {
    done: new Promise(resolve => { finish = resolve; }),
    terminate() { terminated = true; finish({ exitCode: null }); },
    async waitForExit() { waited = true; return true; },
  };
  const runner = new AudayRunner({ resolveExecutable: async value => value, spawn() { spawned = true; return child; } }, '/synthetic', '/synthetic-cache');
  await assert.rejects(runner.run('shell'), /unknown_operation/);
  assert.equal(spawned, false);
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


test('missing CLT cannot start the Apple Python shim', {
  skip: process.platform !== 'darwin',
}, async () => {
  let probes = 0;
  const runner = new AudayRunner({
    resolveExecutable: async () => '/usr/bin/python3',
    spawn({ argv }) {
      assert.deepEqual(argv, ['/usr/bin/xcode-select', '-p']);
      probes++;
      return {
        done: Promise.resolve({ exitCode: 1 }),
        collected: { stdout: { readFrom: () => ({ lossy: false, text: '' }) } },
        terminate() {}, async waitForExit() {},
      };
    },
  }, '/synthetic', '/synthetic-cache');
  for (const operation of ['discover', 'pair', 'sync'])
    await assert.rejects(runner.run(operation, { service: 'synthetic-phone' }), /apple_command_line_tools_missing/);
  assert.equal(probes, 3);
});

test('a missing Python executable reports the prerequisite without starting a child', async () => {
  const runner = new AudayRunner({
    async resolveExecutable() { throw new Error('Executable not found'); },
    spawn() { assert.fail('No interpreter should have been started'); },
  }, '/synthetic', '/synthetic-cache');
  await assert.rejects(runner.run('doctor'), /python_unavailable/);
  assert.equal(runner.controllers.size, 0);
});

test('real unpaired Python sync returns not_paired in one command', {
  skip: process.platform === 'win32',
}, async () => {
  const home = mkdtempSync(join(tmpdir(), 'auday-unpaired-'));
  const calls = [];
  const runner = new AudayRunner({
    resolveExecutable: async value => value,
    spawn({ argv, cwd, env, stdio }) {
      calls.push(argv);
      const child = spawn(argv[0], argv.slice(1), { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
      let text = '';
      child.stdout.on('data', data => { text += data; });
      child.stderr.resume();
      const done = new Promise((resolve, reject) => { child.on('error', reject); child.on('close', exitCode => resolve({ exitCode })); });
      return { done, collected: { stdout: { readFrom: () => ({ lossy: false, text }) } },
        terminate() { child.kill(); }, async waitForExit() { await done; } };
    },
  }, fileURLToPath(new URL('..', import.meta.url)), home);
  try {
    await assert.rejects(runner.run('sync'), /^Error: not_paired$/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].at(-1), 'sync');
  } finally { await runner.close(); rmSync(home, { recursive: true }); }
});

test('healthy connection commands skip doctor; only unknown failures request toolchain diagnosis', async () => {
  const calls = [];
  let failure, reason = null;
  const runner = new AudayRunner({
    resolveExecutable: async () => '/synthetic-python',
    spawn({ argv }) {
      calls.push(argv.at(-1));
      const doctor = argv.at(-1) === 'doctor';
      const text = doctor ? JSON.stringify({ capabilities: { core: { connectionToolchain: { reason } } } })
        : JSON.stringify(failure ? { ok: false, error: failure } : { services: [] });
      return {
        done: Promise.resolve({ exitCode: doctor || !failure ? 0 : 1 }),
        collected: { stdout: { readFrom: () => ({ lossy: false, text }) } },
        terminate() {}, async waitForExit() {},
      };
    },
  }, '/synthetic', '/synthetic-cache');
  await runner.run('discover');
  assert.deepEqual(calls, ['discover']);
  failure = 'password_input_cancelled';
  await assert.rejects(runner.run('pair', { service: 'synthetic-phone' }), /^Error: password_input_cancelled$/);
  assert.equal(calls.includes('doctor'), false);
  failure = 'unrecognized private data';
  await assert.rejects(runner.run('pair', { service: 'synthetic-phone' }), /^Error: operation_failed$/);
  assert.equal(calls.at(-1), 'doctor');
  reason = 'swift_5_9_or_later_required';
  await assert.rejects(runner.run('discover'), /^Error: swift_5_9_or_later_required$/);
  failure = 'swift_missing: private path';
  await assert.rejects(runner.run('discover'), /^Error: swift_toolchain_unavailable$/);
  assert.equal(calls.at(-1), 'discover');
  assert.equal(runner.children.size, 0);
});
