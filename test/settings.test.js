import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../app/server.js';
import * as dc from '../app/js/data-core.js';

test('/api/info 返回数据文件路径', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'lifeapp-info-test-'));
  const { server, port, dataFile } = await startServer({ dataDir, port: 0, noExit: true });
  const base = `http://127.0.0.1:${port}`;
  try {
    const res = await fetch(base + '/api/info');
    const j = await res.json();
    assert.equal(j.ok, true);
    assert.equal(j.dataFile, dataFile);
    assert.ok(j.dataFile.endsWith('data.json'));
  } finally {
    await new Promise((r) => server.close(r));
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('设置持久化：主题/每周起始日/首页模块', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'lifeapp-settings-test-'));
  const { server, port } = await startServer({ dataDir, port: 0, noExit: true });
  const base = `http://127.0.0.1:${port}`;
  try {
    const s = dc.ensureData(null);
    s.settings.theme = 'dark';
    s.settings.weekStart = 0;
    s.settings.homeModules = ['fitness', 'gaming'];

    let res = await fetch(base + '/api/data', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s),
    });
    assert.equal(res.status, 200);
    res = await fetch(base + '/api/data');
    const loaded = dc.ensureData((await res.json()).data);
    assert.equal(loaded.settings.theme, 'dark');
    assert.equal(loaded.settings.weekStart, 0);
    assert.deepEqual(loaded.settings.homeModules, ['fitness', 'gaming']);
  } finally {
    await new Promise((r) => server.close(r));
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('导出 → 清空 → 导入 可恢复数据', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'lifeapp-import-test-'));
  const { server, port } = await startServer({ dataDir, port: 0, noExit: true });
  const base = `http://127.0.0.1:${port}`;
  try {
    const s = dc.ensureData(null);
    dc.addMemo(s, '重要备忘');
    dc.addPlanItem(s, '2026-08-30', { text: '写周报' });
    await fetch(base + '/api/data', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s),
    });

    const exp = await fetch(base + '/api/export');
    const exported = await exp.json();

    // 清空数据
    const empty = dc.ensureData(null);
    await fetch(base + '/api/data', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(empty),
    });
    let check = dc.ensureData((await (await fetch(base + '/api/data')).json()).data);
    assert.equal(check.memos.length, 0);

    // 导入恢复
    const imp = await fetch(base + '/api/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(exported),
    });
    assert.equal(imp.status, 200);
    check = dc.ensureData((await (await fetch(base + '/api/data')).json()).data);
    assert.equal(check.memos.length, 1);
    assert.equal(check.memos[0].text, '重要备忘');
    assert.ok(check.plan['2026-08-30']);
  } finally {
    await new Promise((r) => server.close(r));
    rmSync(dataDir, { recursive: true, force: true });
  }
});