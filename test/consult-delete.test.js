// 问题4 验收：咨询客户可以删除，操作按钮始终可见
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../app/server.js';
import * as dc from '../app/js/data-core.js';

test('样式：行操作按钮不再被隐藏', () => {
  const css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
  assert.ok(!/\.row-actions\s*\{[^}]*opacity:\s*0/i.test(css), '.row-actions 不应再 opacity:0');
  assert.ok(!css.includes('.row:hover .row-actions'), '不应再依赖悬停才显示操作按钮');
  assert.ok(css.includes('.row-actions'), '仍应定义 .row-actions');
});

test('客户删除流程经 API 持久化', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'lifeapp-consult-del-'));
  const { server, port } = await startServer({ dataDir, port: 0, noExit: true });
  const base = `http://127.0.0.1:${port}`;
  try {
    const s = dc.ensureData(null);
    const cl = dc.upsert(s.consult.clients, { name: '王先生', contact: 'wx' });
    s.consult.records.push({ id: 'r1', date: '2026-08-30', clientId: cl.id, topic: '咨询' });

    await fetch(base + '/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });

    // 删除客户
    dc.removeById(s.consult.clients, cl.id);
    await fetch(base + '/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });

    const loaded = dc.ensureData((await (await fetch(base + '/api/data')).json()).data);
    assert.equal(loaded.consult.clients.length, 0, '客户应已被删除');
    assert.equal(loaded.consult.records.length, 1, '关联记录保留');
  } finally {
    await new Promise((r) => server.close(r));
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('咨询页面模块可加载', async () => {
  const mod = await import('../app/js/pages/consult.js');
  assert.equal(typeof mod.render, 'function');
});