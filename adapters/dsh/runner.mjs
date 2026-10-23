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
        if (typeof input.service !== 'string' || !input.service.trim()) throw new Error('device_required');
        args = ['pair-dialog', '--service', input.service]; break;
      case 'search':
        if (!Number.isInteger(input.offset ?? 0) || (input.offset ?? 0) < 0) throw new Error('invalid_page');
        args = ['search', '--limit', '20', '--offset', String(input.offset ?? 0)]; break;
      case 'preview': args = ['handoff']; break;
      default: throw new Error('unknown_operation');
    }
    const controller = new AbortController();
    this.controllers.add(controller);
    const execute = async (argv, stdin = 'ignore') => {
      controller.signal.throwIfAborted();
      const child = this.subprocess.spawn({
        argv, cwd: this.root, graceMs: 1000, signal: controller.signal,
        env: { AUDAY_PROGRESS: '0' },
        stdio: { stdin, stdout: { maxBytes: 16 * 1024 * 1024 }, stderr: { maxBytes: 4096 } },
      });
      this.children.add(child);
      try {
        const outcome = await child.done;
        controller.signal.throwIfAborted();
        return { ...outcome, output: child.collected.stdout.readFrom(0) };
      } finally {
        child.terminate();
        await child.waitForExit();
        this.children.delete(child);
      }
    };
    const parse = ({ exitCode, output }) => {
      if (exitCode !== 0) {
        const known = ['not_paired', 'password_input_cancelled', 'use_generated_16_character_communication_password',
          'authentication_or_connection_failed', 'awaiting_phone_or_wrong_password', 'keychain_save_failed'];
        for (const line of output.text.split('\n')) {
          let error;
          try { error = JSON.parse(line).error; } catch { continue; }
          const code = typeof error === 'string' ? error.split(':')[0] : '';
          if (known.includes(code)) throw new Error(code);
        }
        throw new Error('operation_failed');
      }
      if (output.lossy) throw new Error('selection_too_large');
      return JSON.parse(output.text);
    };
    try {
      let python;
      try { python = await this.subprocess.resolveExecutable(this.python, undefined, controller.signal); }
      catch (error) {
        controller.signal.throwIfAborted();
        throw new Error('python_unavailable');
      }
      // Apple's Python shim can open an installer when CLT is absent. Probe without starting it.
      if (process.platform === 'darwin' && python === '/usr/bin/python3') {
        if ((await execute(['/usr/bin/xcode-select', '-p'])).exitCode !== 0)
          throw new Error('apple_command_line_tools_missing');
      }
      const command = (...args) => [python, join(this.root, 'scripts/auday.py'), '--home', this.home, ...args];
      if (['discover', 'pair', 'sync'].includes(operation)) {
        const doctor = parse(await execute(command('doctor')));
        const tools = doctor.capabilities.core.connectionToolchain;
        if (!tools.ready) throw new Error(tools.reason);
        if (operation === 'sync' && !doctor.capabilities.paired) throw new Error('not_paired');
      }
      return parse(await execute(command(...args), operation === 'preview' ? { data: JSON.stringify(input.ids) } : 'ignore'));
    } finally {
      this.controllers.delete(controller);
    }
  }
}

/** Submit stable, selected revisions to Kaitu's existing plain-Markdown inbox. */
export function submitNotes(workspace, notes) {
  if (!isAbsolute(workspace) || !existsSync(join(workspace, '.kaitu/config.json')))
    throw new Error('workspace_missing');
  const directory = join(workspace, 'inbox/agents');
  mkdirSync(directory, { recursive: true });
  for (const note of notes) {
    if (!/^auday-[a-f0-9]{64}-[a-f0-9]{64}\.md$/.test(note.name) || typeof note.text !== 'string')
      throw new Error('invalid_handoff');
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
