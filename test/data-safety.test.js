// 首页拉取不到其他模块 + 数据被空数据覆盖 的修复验收
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../app/server.js';
import * as dc from '../app/js/data-core.js';
import { buildHomeSummaries } from '../app/js/pages/home.js';

test('server: /api/data 返回 fileExists', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'lifeapp-fix-'));
  const srv = await startServer({ dataDir, port: 0, noExit: true });
  const base = `http://127.0.0.1:${srv.port}`;
  try {
    let j = await (await fetch(base + '/api/data')).json();
    assert.equal(j.fileExists, false, '无文件时 fileExists=false');
    await fetch(base + '/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dc.ensureData(null)) });
    j = await (await fetch(base + '/api/data')).json();
    assert.equal(j.fileExists, true, '有文件时 fileExists=true');
    assert.ok(j.data, '有文件时应返回数据');
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

test('store.js 不再无条件用空数据覆盖已有文件', () => {
  const src = readFileSync(new URL('../app/js/store.js', import.meta.url), 'utf8');
  assert.ok(src.includes('fileExists === false'), '只有确认无数据文件才创建默认数据');
  assert.ok(src.includes('未自动覆盖'), '文件异常时应警示而不是覆盖');
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