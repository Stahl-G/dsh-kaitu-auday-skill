import React, { useEffect, useState } from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-api-remotes/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client';
import contribution from '../../lib/typert.remote-client.js';

export const inject = ['slots', 'remote'];
type Request = (operation: string, input?: object) => Promise<any>;
const labels = {
  zh: { title: 'Auday', check: '检查依赖', discover: '查找手机', pair: '连接（在本机输入密码并保存到钥匙串）',
    sync: '同步一次', list: '查看本机副本', preview: '预览所选', submit: '导入待整理笔记', cancel: '取消',
    next: '下一页', previous: '上一页', busy: '正在处理…', cached: '上次同步', select: '选择记录',
    sent: '已送入开图收件箱，等待处理', missing: '需要已有 Python 3 与 Xcode 命令行工具；此插件不安装依赖。' },
  en: { title: 'Auday', check: 'Check prerequisites', discover: 'Find phone', pair: 'Connect (local password; save in Keychain)',
    sync: 'Sync once', list: 'Browse local copy', preview: 'Preview selection', submit: 'Import as inbox notes', cancel: 'Cancel',
    next: 'Next', previous: 'Previous', busy: 'Working…', cached: 'Last synced', select: 'Select record',
    sent: 'Submitted to the Kaitu inbox for processing', missing: 'Requires existing Python 3 and Xcode Command Line Tools. No dependencies are installed.' },
};

function AudayPage({ request }: { request: Request }) {
  const t = navigator.language.startsWith('zh') ? labels.zh : labels.en;
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [services, setServices] = useState<string[]>([]), [service, setService] = useState('');
  const [page, setPage] = useState<any>({ records: [] }), [offset, setOffset] = useState(0);
  const [ids, setIds] = useState<string[]>([]), [preview, setPreview] = useState<any>(null);
  useEffect(() => () => { void request('cancel').catch(() => {}); }, [request]);
  const run = async (operation: string, input = {}) => {
    setBusy(true); setMessage('');
    try {
      const result = await request(operation, input);
      if (operation === 'discover') { setServices(result.services); setService(result.services[0] || ''); }
      else if (operation === 'search') { setPage(result); setIds([]); setPreview(null); }
      else if (operation === 'preview') setPreview(result);
      else if (operation === 'import') { setMessage(t.sent); setPreview(null); setIds([]); }
      else setMessage(JSON.stringify(result, null, 2));
    } catch (error) { setMessage(String(error)); }
    finally { setBusy(false); }
  };
  return <section style={{ padding: 24, maxWidth: 900, overflow: 'auto', height: '100%', color: 'inherit' }}>
    <h2>{t.title}</h2><p>{t.missing}</p>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button disabled={busy} onClick={() => run('doctor')}>{t.check}</button>
      <button disabled={busy} onClick={() => run('discover')}>{t.discover}</button>
      <select aria-label={t.discover} value={service} disabled={busy} onChange={e => setService(e.target.value)}>
        {services.map(value => <option key={value}>{value}</option>)}
      </select>
      <button disabled={busy || !service} onClick={() => run('pair', { service })}>{t.pair}</button>
      <button disabled={busy} onClick={() => { setPreview(null); run('sync'); }}>{t.sync}</button>
      <button disabled={busy} onClick={() => { setOffset(0); run('search', { offset: 0 }); }}>{t.list}</button>
      {busy && <button onClick={() => request('cancel')}>{t.cancel}</button>}
    </div>
    <p role="status">{busy ? t.busy : message}</p>
    {page.syncedAt && <p>{t.cached}: {page.syncedAt}</p>}
    {page.records.map((record: any) => <article key={record.id} style={{ borderBottom: '1px solid', padding: 12 }}>
      <label><input type="checkbox" disabled={busy} checked={ids.includes(record.id)} aria-label={t.select}
        onChange={e => { setPreview(null); setIds(e.target.checked ? [...ids, record.id] : ids.filter(id => id !== record.id)); }} />
        {record.kind} · {record.start} · {record.state}</label>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{record.text}</pre>
    </article>)}
    <button disabled={busy || offset === 0} onClick={() => { setOffset(offset - 20); run('search', { offset: offset - 20 }); }}>{t.previous}</button>
    <button disabled={busy || page.nextOffset == null} onClick={() => { setOffset(page.nextOffset); run('search', { offset: page.nextOffset }); }}>{t.next}</button>
    <button disabled={busy || !ids.length} onClick={() => run('preview', { ids })}>{t.preview}</button>
    {preview && <><pre style={{ whiteSpace: 'pre-wrap' }}>{preview.notes.map((note: any) => [note.record.kind, note.record.start, note.record.state, note.record.text].filter(Boolean).join('\n')).join('\n\n')}</pre>
      <button disabled={busy} onClick={() => run('import', { ids, names: preview.notes.map((note: any) => note.name) })}>{t.submit}</button></>}
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
