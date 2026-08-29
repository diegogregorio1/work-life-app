import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../app/server.js';
import * as dc from '../app/js/data-core.js';

test('projectTaskStats 统计任务进度', () => {
  const p = { tasks: [
    { id: '1', status: 'done' },
    { id: '2', status: 'todo' },
    { id: '3', status: 'doing' },
  ] };
  assert.deepEqual(dc.projectTaskStats(p), { total: 3, done: 1, pending: 2 });
  assert.deepEqual(dc.projectTaskStats({}), { total: 0, done: 0, pending: 0 });
});

test('项目/任务/日志 完整流程经 API 持久化', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'lifeapp-dev-test-'));
  const { server, port } = await startServer({ dataDir, port: 0, noExit: true });
  const base = `http://127.0.0.1:${port}`;
  try {
    const s = dc.ensureData(null);
    const p = dc.upsert(s.dev.projects, { name: '个人网站', stack: 'Node.js', status: 'active', note: 'demo' });
    p.tasks = [];
    const t = dc.upsert(p.tasks, { text: '写后端', status: 'todo', priority: 'high' });
    t.status = 'doing';
    p.logs = [{ id: dc.uid(), date: '2026-08-30', text: '完成了 API' }];

    let res = await fetch(base + '/api/data', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s),
    });
    assert.equal(res.status, 200);
    res = await fetch(base + '/api/data');
    const loaded = dc.ensureData((await res.json()).data);
    assert.equal(loaded.dev.projects.length, 1);
    const lp = loaded.dev.projects[0];
    assert.equal(lp.name, '个人网站');
    assert.equal(lp.tasks[0].status, 'doing');
    assert.equal(lp.logs.length, 1);
    assert.equal(dc.projectTaskStats(lp).pending, 1);
    const sum = dc.devSummary(loaded);
    assert.equal(sum.active, 1);
    assert.equal(sum.openTasks, 1);
  } finally {
    await new Promise((r) => server.close(r));
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('任务勾选在 done/todo 之间切换', () => {
  const s = dc.ensureData(null);
  const p = dc.upsert(s.dev.projects, { name: 'P', status: 'active' });
  p.tasks = [];
  const t = dc.upsert(p.tasks, { text: '任务', status: 'todo' });
  t.status = t.status === 'done' ? 'todo' : 'done';
  assert.equal(t.status, 'done');
  t.status = t.status === 'done' ? 'todo' : 'done';
  assert.equal(t.status, 'todo');
});