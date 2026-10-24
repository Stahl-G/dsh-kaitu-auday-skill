import { Context } from '@deepseek-ai/cordis';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AudayRunner, submitNotes } from './runner.mjs';

declare module '@deepseek-ai/cordis' { interface Context { kaituAuday: AudayService } }
export const name = 'kaitu-auday';
export const inject = ['subprocess'];
export interface Config { python?: string; workspace?: string }

/** UI-only operations: no command, password, or model tool entry point. */
export class AudayService extends TypertRemoteService {
  constructor(ctx: Context, private runner: AudayRunner, private workspace: string) { super(ctx, 'kaituAuday'); }
  @Remote('request')
  async request(operation: string, input: string): Promise<string> {
    const args = JSON.parse(input);
    if (operation === 'cancel') { await this.runner.close(); return '{}'; }
    // The shared Python/Swift core and native password dialog are macOS-only.
    if (process.platform !== 'darwin') throw new Error('macOS_required');
    if (operation === 'import') {
      const preview = await this.runner.run('preview', args);
      if (JSON.stringify(preview.notes.map((note: { name: string }) => note.name)) !== JSON.stringify(args.names))
        throw new Error('source_changed');
      return JSON.stringify(submitNotes(this.workspace, preview.notes));
    }
    return JSON.stringify(await this.runner.run(operation, args));
  }
}

/** The desktop supplies KAITU_DIR; plain DSH can configure an explicit workspace. */
export function apply(ctx: Context, config: Config = {}) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const runner = new AudayRunner(ctx.get('subprocess'), root,
    join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'auday'), config.python);
  new AudayService(ctx, runner, config.workspace || process.env.KAITU_DIR || '');
  ctx.effect(() => () => runner.close());
}
