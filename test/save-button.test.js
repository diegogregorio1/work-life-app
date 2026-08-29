// 问题6 验收：手动保存按钮
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../app/server.js';

test('顶部栏包含手动保存按钮', () => {
  const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="save-btn"'), '应有 save-btn');
  assert.ok(html.includes('💾 保存'), '按钮应显示保存');
});

test('store.js 导出 saveNow 且 app.js 已接线', async () => {
  const store = await import('../app/js/store.js');
  assert.equal(typeof store.saveNow, 'function', 'store 应导出 saveNow');
  const app = readFileSync(new URL('../app/js/app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("getElementById('save-btn')"), 'app.js 应绑定 save-btn');
  assert.ok(app.includes('store.saveNow()'), 'app.js 应调用 saveNow');
});

test('手动保存立即写入文件', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'lifeapp-save-now-'));
  const { server, port, dataFile } = await startServer({ dataDir, port: 0, noExit: true });
  const base = `http://127.0.0.1:${port}`;
  try {
    const doc = { version: 1, memos: [{ id: 'm1', text: '手动保存测试', done: false }] };
    const res = await fetch(base + '/api/data', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doc),
    });
    assert.equal(res.status, 200);
    assert.equal(existsSync(dataFile), true, '保存后 data.json 应立刻存在');
    const onDisk = JSON.parse(readFileSync(dataFile, 'utf8'));
    assert.equal(onDisk.memos[0].text, '手动保存测试');
  } finally {
    await new Promise((r) => server.close(r));
    rmSync(dataDir, { recursive: true, force: true });
  }
});