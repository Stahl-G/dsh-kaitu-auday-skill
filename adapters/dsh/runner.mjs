import { existsSync, linkSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { isAbsolute, join } from 'node:path';

/** Fixed Auday operations. The subprocess provider owns descendants and cancellation. */
export class AudayRunner {
  constructor(subprocess, root, home, python = 'python3') {
    Object.assign(this, { subprocess, root, home, python });
    this.children = new Set();
    this.controllers = new Set();
  }
  async close() {
    for (const controller of this.controllers) controller.abort();
    const children = [...this.children];
    for (const child of children) child.terminate();
    await Promise.all(children.map(child => child.waitForExit()));
  }
  async run(operation, input = {}) {
    let args;
    switch (operation) {
      case 'doctor': case 'status': case 'sync': case 'discover': args = [operation]; break;
      case 'pair':
        if (typeof input.service !== 'string' || !input.service.trim()) throw new Error('Select a device');
        args = ['pair-dialog', '--service', input.service]; break;
      case 'search':
        if (!Number.isInteger(input.offset ?? 0) || (input.offset ?? 0) < 0) throw new Error('Invalid page');
        args = ['search', '--limit', '20', '--offset', String(input.offset ?? 0)]; break;
      case 'preview': args = ['handoff']; break;
      default: throw new Error('Unknown Auday operation');
    }
    const controller = new AbortController();
    this.controllers.add(controller);
    let child;
    try {
      const python = await this.subprocess.resolveExecutable(this.python, undefined, controller.signal);
      controller.signal.throwIfAborted();
      child = this.subprocess.spawn({
        argv: [python, join(this.root, 'scripts/auday.py'), '--home', this.home, ...args],
        cwd: this.root, graceMs: 1000, signal: controller.signal,
        env: { AUDAY_PROGRESS: '0' },
        stdio: { stdin: operation === 'preview' ? { data: JSON.stringify(input.ids) } : 'ignore',
          stdout: { maxBytes: 16 * 1024 * 1024 }, stderr: { maxBytes: 4096 } },
      });
      this.children.add(child);
      const outcome = await child.done;
      if (outcome.exitCode !== 0) throw new Error('Auday operation did not complete; check local prerequisites or retry connection');
      const output = child.collected.stdout.readFrom(0);
      if (output.lossy) throw new Error('Selection too large; select fewer records');
      return JSON.parse(output.text);
    } finally {
      if (child) {
        child.terminate();
        await child.waitForExit();
        this.children.delete(child);
      }
      this.controllers.delete(controller);
    }
  }
}

/** Submit stable, selected revisions to Kaitu's existing plain-Markdown inbox. */
export function submitNotes(workspace, notes) {
  if (!isAbsolute(workspace) || !existsSync(join(workspace, '.kaitu/config.json')))
    throw new Error('Configure an existing Kaitu workspace');
  const directory = join(workspace, 'inbox/agents');
  mkdirSync(directory, { recursive: true });
  for (const note of notes) {
    if (!/^auday-[a-f0-9]{64}-[a-f0-9]{64}\.md$/.test(note.name) || typeof note.text !== 'string')
      throw new Error('Invalid Auday handoff');
    const path = join(directory, note.name);
    // Kaitu ignores hidden files; publish only the completed note, without replacing a pending one.
    const temporary = join(directory, `.auday-${randomUUID()}.tmp`);
    writeFileSync(temporary, note.text, { flag: 'wx', mode: 0o600 });
    try { linkSync(temporary, path); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    finally { unlinkSync(temporary); }
  }
  return { submitted: notes.length };
}
