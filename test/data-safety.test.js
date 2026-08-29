// 首页拉取不到其他模块 + 数据被空数据覆盖 的修复验收
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../app/server.js';
import * as dc from '../app/js/data-core.js';
import { buildHomeSummaries } from '../app/js/pages/home.js';

test('server: 首次访问自动创建数据文件，且不丢已有数据', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'lifeapp-fix-'));
  assert.equal(existsSync(join(dataDir, 'data.json')), false, '初始无数据文件');
  const srv = await startServer({ dataDir, port: 0, noExit: true });
  const base = `http://127.0.0.1:${srv.port}`;
  try {
    let j = await (await fetch(base + '/api/data')).json();
    assert.equal(j.fileExists, true, '首次访问后应自动创建数据文件');
    assert.equal(j.data, null, '占位文件本身无业务数据');
    const s = dc.ensureData(null);
    dc.addMemo(s, '真实数据');
    await fetch(base + '/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
    j = await (await fetch(base + '/api/data')).json();
    assert.equal(j.fileExists, true);
    assert.equal(j.data.memos.length, 1, '保存的数据应能读回');
  } finally {
    await new Promise((r) => srv.server.close(r));
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('ensureData 归一化 homeModules：空/非法回退默认，有效子集保留', () => {
  assert.deepEqual(dc.ensureData({ settings: { homeModules: [] } }).settings.homeModules, dc.DEFAULT_HOME_MODULES);
  assert.deepEqual(dc.ensureData({ settings: { homeModules: null } }).settings.homeModules, dc.DEFAULT_HOME_MODULES);
  assert.deepEqual(dc.ensureData({ settings: { homeModules: ['bogus'] } }).settings.homeModules, dc.DEFAULT_HOME_MODULES);
  assert.deepEqual(dc.ensureData({ settings: { homeModules: ['fitness', 'gaming'] } }).settings.homeModules, ['fitness', 'gaming']);
  assert.deepEqual(dc.ensureData(null).settings.homeModules, dc.DEFAULT_HOME_MODULES);
  assert.equal(dc.DEFAULT_HOME_MODULES.length, 6);
});

test('首页摘要：homeModules 为空时回退显示全部模块', () => {
  const s = dc.ensureData({ settings: { homeModules: [] } });
  const list = buildHomeSummaries(s, '2026-08-30');
  assert.equal(list.length, 6, '空配置也应显示全部 6 个模块');
  assert.deepEqual(list.map((x) => x.id), dc.DEFAULT_HOME_MODULES);
});

test('首页摘要：子集配置仍只显示勾选模块', () => {
  const s = dc.ensureData({ settings: { homeModules: ['dev', 'diet'] } });
  const list = buildHomeSummaries(s, '2026-08-30');
  assert.deepEqual(list.map((x) => x.id), ['dev', 'diet']);
});

test('store.js 加载时绝不自动写盘（防止空数据覆盖已有文件）', () => {
  const src = readFileSync(new URL('../app/js/store.js', import.meta.url), 'utf8');
  assert.ok(src.includes('if (j.ok && j.data)'), '有数据时加载数据');
  assert.ok(!src.includes('fileExists === false'), '不应依赖服务端 fileExists 字段');
  assert.ok(src.includes('不自动写盘'), '加载分支不应自动写盘');
  assert.ok(!/save\(\);/m.test(src.split('if (j.ok && j.data)')[1].split('}')[1] || ''), '无数据分支不应调用 save()');
});

test('数据文件存在且有内容时，服务返回的数据与文件一致', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'lifeapp-fix2-'));
  const srv = await startServer({ dataDir, port: 0, noExit: true });
  const base = `http://127.0.0.1:${srv.port}`;
  try {
    const s = dc.ensureData(null);
    dc.addMemo(s, '真实数据');
    s.selfmedia.contents.push({ id: 'c1', title: '文章', status: 'published' });
    await fetch(base + '/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
    const j = await (await fetch(base + '/api/data')).json();
    assert.equal(j.data.memos.length, 1);
    assert.equal(j.data.selfmedia.contents.length, 1);
    assert.equal(existsSync(join(dataDir, 'data.json')), true);
  } finally {
    await new Promise((r) => srv.server.close(r));
    rmSync(dataDir, { recursive: true, force: true });
  }
});