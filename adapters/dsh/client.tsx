import React, { useEffect, useState } from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-api-remotes/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client';
import contribution from '../../lib/typert.remote-client.js';
import styles from './client.css';

export const inject = ['slots', 'remote'];
type Request = (operation: string, input?: object) => Promise<any>;
const labels = {
  zh: { title: 'Auday', check: '检查依赖', discover: '查找手机', pair: '连接（在本机输入密码并保存到钥匙串）',
    sync: '同步一次', list: '查看本机副本', preview: '预览所选', submit: '送入开图收件箱', cancel: '取消',
    next: '下一页', previous: '上一页', busy: '正在处理…', cached: '上次同步', select: '选择记录',
    sent: '已送入开图收件箱，等待处理', connection: '连接手机', library: '本机副本', empty: '同步后，查看本机副本，选择要送入开图的原文。', selected: '已选', ready: '连接依赖已就绪', connected: '已连接，可以同步一次。', synced: '同步完成，可以查看本机副本。', noPhone: '未找到手机。请打开 Auday 接入页，并保持同一 Wi-Fi。', original: '所选原文', missing: '需要已有 Python 3 与 Xcode 命令行工具；此插件不安装依赖。' },
  en: { title: 'Auday', check: 'Check prerequisites', discover: 'Find phone', pair: 'Connect (local password; save in Keychain)',
    sync: 'Sync once', list: 'Browse local copy', preview: 'Preview selection', submit: 'Import as inbox notes', cancel: 'Cancel',
    next: 'Next', previous: 'Previous', busy: 'Working…', cached: 'Last synced', select: 'Select record',
    sent: 'Submitted to the Kaitu inbox for processing', connection: 'Connect your phone', library: 'Local copy', empty: 'After syncing, browse the local copy and select original records to send to Kaitu.', selected: 'Selected', ready: 'Connection prerequisites are ready', connected: 'Connected. You can sync once now.', synced: 'Sync complete. You can browse the local copy.', noPhone: 'No phone found. Open the Auday access page and stay on the same Wi-Fi.', original: 'Selected original text', missing: 'Requires existing Python 3 and Xcode Command Line Tools. No dependencies are installed.' },
};

function useTheme() {
  const read = () => document.body.hasAttribute('data-ds-dark-theme') || matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const [theme, setTheme] = useState(read);
  useEffect(() => {
    const update = () => setTheme(read());
    const media = matchMedia('(prefers-color-scheme: dark)');
    const observer = new MutationObserver(update);
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] });
    media.addEventListener('change', update);
    return () => { observer.disconnect(); media.removeEventListener('change', update); };
  }, []);
  return theme;
}

function AudayPage({ request }: { request: Request }) {
  const zh = navigator.language.startsWith('zh');
  const t = zh ? labels.zh : labels.en;
  const theme = useTheme();
  const embedded = new URLSearchParams(window.location.hash.slice(1)).get('kaitu-embed') === '1';
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [services, setServices] = useState<string[]>([]), [service, setService] = useState('');
  const [page, setPage] = useState<any>({ records: [] }), [offset, setOffset] = useState(0);
  const [ids, setIds] = useState<string[]>([]), [preview, setPreview] = useState<any>(null);
  useEffect(() => () => { void request('cancel').catch(() => {}); }, [request]);
  const errorText = (error: unknown) => {
    const text = String(error).replace(/^Error: /, '');
    const known: Record<string, [string, string]> = {
      python_unavailable: ['未找到可用的 Python 3。请先安装 Python 3，或在插件配置中选择已有解释器。', 'Python 3 was not found. Install it or select an existing interpreter in the plugin configuration.'],
      apple_command_line_tools_missing: ['缺少 Xcode 命令行工具。请先完成 Apple Command Line Tools 安装，再检查依赖。', 'Xcode Command Line Tools are missing. Complete their installation, then check prerequisites again.'],
      swift_toolchain_unavailable: ['当前 Xcode 工具链中没有可用的 Swift。请检查开发工具选择。', 'Swift is unavailable in the selected Xcode toolchain. Check your developer tools selection.'],
      swift_5_9_or_later_required: ['连接需要 Swift 5.9 或更新版本。请更新 Xcode 命令行工具。', 'Connection requires Swift 5.9 or newer. Update Xcode Command Line Tools.'],
      macOS_required: ['连接 Auday 需要 macOS。', 'Connecting Auday requires macOS.'],
    };
    return known[text]?.[zh ? 0 : 1] || text;
  };
  const run = async (operation: string, input = {}) => {
    setBusy(true); setMessage(''); setFailed(false);
    try {
      const result = await request(operation, input);
      if (operation === 'doctor') {
        const tools = result.capabilities.core.connectionToolchain;
        if (!tools.ready) throw new Error(tools.reason);
        setMessage(t.ready);
      } else if (operation === 'discover') {
        setServices(result.services); setService(result.services[0] || '');
        if (!result.services.length) setMessage(t.noPhone);
      } else if (operation === 'search') { setPage(result); setIds([]); setPreview(null); }
      else if (operation === 'preview') setPreview(result);
      else if (operation === 'import') { setMessage(t.sent); setPreview(null); setIds([]); }
      else if (operation === 'pair') setMessage(t.connected);
      else if (operation === 'sync') setMessage(t.synced);
    } catch (error) { setFailed(true); setMessage(errorText(error)); }
    finally { setBusy(false); }
  };
  return <section className="auday" data-theme={theme} aria-label={t.title} aria-busy={busy}>
    <style>{styles}</style>
    {!embedded && <header className="auday-intro"><h1>{t.title}</h1></header>}
    <section className="auday-card" aria-label={t.connection}>
      <h2>{t.connection}</h2><p>{t.missing}</p>
      <div className="auday-row">
        <button disabled={busy} onClick={() => run('doctor')}>{t.check}</button>
        <button disabled={busy} onClick={() => run('discover')}>{t.discover}</button>
        {services.length > 0 && <><select aria-label={t.discover} value={service} disabled={busy} onChange={e => setService(e.target.value)}>
          {services.map(value => <option key={value}>{value}</option>)}
        </select>
        <button disabled={busy || !service} onClick={() => run('pair', { service })}>{t.pair}</button></>}
      </div>
      <div className="auday-row">
        <button className={!ids.length ? 'auday-primary' : ''} disabled={busy} onClick={() => { setPreview(null); void run('sync'); }}>{t.sync}</button>
        <button disabled={busy} onClick={() => { setOffset(0); void run('search', { offset: 0 }); }}>{t.list}</button>
        {busy && <button className="auday-link" onClick={() => request('cancel')}>{t.cancel}</button>}
      </div>
    </section>
    {(busy || message) && <p className="auday-status" role={failed ? 'alert' : 'status'} data-error={failed} data-success={!failed && !busy}>{busy ? t.busy : message}</p>}
    <section className="auday-card" aria-label={t.library}>
      <div className="auday-row auday-between" style={{ marginTop: 0 }}><h2>{t.library}</h2><small>{t.selected}: {ids.length}</small></div>
      {page.syncedAt && <p className="auday-meta">{t.cached}: {page.syncedAt}</p>}
      {!page.records.length && <p className="auday-empty">{t.empty}</p>}
      {page.records.map((record: any) => <article key={record.id}>
        <label><input type="checkbox" disabled={busy} checked={ids.includes(record.id)} aria-label={`${t.select}: ${record.start || record.id}`}
          onChange={e => { setPreview(null); setIds(e.target.checked ? [...ids, record.id] : ids.filter(id => id !== record.id)); }} />
          <span className="auday-meta">Auday · {[record.kind, record.start, record.state].filter(Boolean).join(' · ')}</span></label>
        <pre>{record.text}</pre>
      </article>)}
      <div className="auday-row">
        <button disabled={busy || offset === 0} onClick={() => { setOffset(offset - 20); void run('search', { offset: offset - 20 }); }}>{t.previous}</button>
        <button disabled={busy || page.nextOffset == null} onClick={() => { setOffset(page.nextOffset); void run('search', { offset: page.nextOffset }); }}>{t.next}</button>
        <button className={ids.length && !preview ? 'auday-primary' : ''} disabled={busy || !ids.length} onClick={() => run('preview', { ids })}>{t.preview}</button>
      </div>
    </section>
    {preview && <section className="auday-card auday-preview" aria-label={t.original}>
      <h2>{t.original}</h2>
      <pre>{preview.notes.map((note: any) => [note.record.kind, note.record.start, note.record.state, note.record.text].filter(Boolean).join('\n')).join('\n\n')}</pre>
      <div className="auday-row"><button className="auday-primary" disabled={busy} onClick={() => run('import', { ids, names: preview.notes.map((note: any) => note.name) })}>{t.submit}</button></div>
    </section>}
  </section>;
}

export async function apply(ctx: Context) {
  const unmount = await ctx.remote.$mount(contribution);
  ctx.effect(() => unmount);
  ctx.plugin({ inject: ['slots', 'remote.kaituAuday'], apply(ctx: Context) {
    const request: Request = async (operation, input = {}) => {
      const result = await ctx.remote.kaituAuday.request(operation, JSON.stringify(input));
      if (!result.ok) throw new Error(result.error.message);
      return JSON.parse(result.value);
    };
    ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'kaitu-auday', inject: () => ({ request }) }, AudayPage));
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'kaitu-auday', order: 27, label: () => 'Auday' }, () => <span>A</span>));
  } });
}
