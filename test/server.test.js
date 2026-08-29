import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';
import { startServer } from '../app/server.js';

async function withServer(fn) {
  const dataDir = mkdtempSync(join(tmpdir(), 'lifeapp-server-test-'));
  const { server, port, dataFile, backupFile } = await startServer({ dataDir, port: 0, noExit: true });
  const base = `http://127.0.0.1:${port}`;
  try {
    await fn(base, { dataDir, dataFile, backupFile, port });
  } finally {
    await new Promise((r) => server.close(r));
    rmSync(dataDir, { recursive: true, force: true });
  }
}

function rawRequest(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('GET / 返回 index.html', async () => {
  await withServer(async (base) => {
    const res = await fetch(base + '/');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    const text = await res.text();
    assert.match(text, /工作生活专属 APP/);
  });
});

test('GET /api/data 首次访问返回空数据', async () => {
  await withServer(async (base) => {
    const res = await fetch(base + '/api/data');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.data, null);
    assert.equal(body.recovered, false);
  });
});

test('POST /api/data 持久化到磁盘且自动生成备份', async () => {
  await withServer(async (base, { dataFile, backupFile }) => {
    const doc = { version: 1, plan: { '2026-08-30': [{ id: 'a', text: '测试', done: false }] } };
    let res = await fetch(base + '/api/data', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doc),
    });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ok, true);
    assert.equal(existsSync(dataFile), true);
    assert.equal(existsSync(backupFile), false, '第一次保存不应产生备份');

    const doc2 = { version: 1, plan: {} };
    res = await fetch(base + '/api/data', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doc2),
    });
    assert.equal(res.status, 200);
    assert.equal(existsSync(backupFile), true, '第二次保存应产生备份');
    const backup = JSON.parse(readFileSync(backupFile, 'utf8'));
    assert.deepEqual(backup, doc, '备份内容应为上一次数据');
    const main = JSON.parse(readFileSync(dataFile, 'utf8'));
    assert.deepEqual(main, doc2);
  });
});

test('data.json 损坏时从备份自动恢复', async () => {
  await withServer(async (base, { dataFile, backupFile }) => {
    const backup = { version: 1, memo: 'backup' };
    writeFileSync(backupFile, JSON.stringify(backup), 'utf8');
    writeFileSync(dataFile, '{{{corrupted', 'utf8');

    const res = await fetch(base + '/api/data');
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.recovered, true);
    assert.deepEqual(body.data, backup);
    const repaired = JSON.parse(readFileSync(dataFile, 'utf8'));
    assert.deepEqual(repaired, backup, '主文件应被修复为备份内容');
  });
});

test('GET /api/export 返回当前数据文件', async () => {
  await withServer(async (base) => {
    const doc = { version: 1, note: 'export-me' };
    await fetch(base + '/api/data', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doc),
    });
    const res = await fetch(base + '/api/export');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/json/);
    assert.match(res.headers.get('content-disposition'), /attachment/);
    assert.deepEqual(await res.json(), doc);
  });
});

test('POST /api/import 校验并覆盖数据且保留备份', async () => {
  await withServer(async (base, { backupFile }) => {
    const old = { version: 1, note: 'old' };
    await fetch(base + '/api/data', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(old),
    });
    const fresh = { version: 1, note: 'fresh' };
    const res = await fetch(base + '/api/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fresh),
    });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ok, true);
    assert.equal(existsSync(backupFile), true);
    assert.deepEqual(JSON.parse(readFileSync(backupFile, 'utf8')), old, '导入前数据应被备份');

    const bad = await fetch(base + '/api/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ noVersion: true }),
    });
    assert.equal(bad.status, 400);
  });
});

test('POST /api/data 拒绝非法数据', async () => {
  await withServer(async (base) => {
    const res = await fetch(base + '/api/data', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ foo: 1 }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.ok, false);
  });
});

test('未知路径返回 404，路径穿越被拒绝', async () => {
  await withServer(async (base, { port }) => {
    const notFound = await fetch(base + '/no-such-file.js');
    assert.equal(notFound.status, 404);
    const traversal = await rawRequest(port, '/%2e%2e/package.json');
    assert.equal(traversal.status, 403);
  });
});

test('POST /api/shutdown 停止服务', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'lifeapp-shutdown-test-'));
  const { server, port } = await startServer({ dataDir, port: 0, noExit: true });
  const base = `http://127.0.0.1:${port}`;
  const closed = new Promise((r) => server.on('close', r));
  const res = await fetch(base + '/api/shutdown', { method: 'POST' });
  assert.equal(res.status, 200);
  await closed;
  rmSync(dataDir, { recursive: true, force: true });
});