import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../app/server.js';
import * as dc from '../app/js/data-core.js';

test('groupBySlot 按时间段分组', () => {
  const items = [
    { id: '1', slot: 'evening' },
    { id: '2', slot: 'morning' },
    { id: '3', slot: 'afternoon' },
    { id: '4', slot: 'morning' },
  ];
  const g = dc.groupBySlot(items);
  assert.equal(g.morning.length, 2);
  assert.equal(g.afternoon.length, 1);
  assert.equal(g.evening.length, 1);
  assert.deepEqual(g.morning.map((x) => x.id), ['2', '4']);
  const empty = dc.groupBySlot([]);
  assert.deepEqual(empty, { morning: [], afternoon: [], evening: [] });
});

test('今日计划完整流程经 API 持久化并重新加载', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'lifeapp-today-test-'));
  const { server, port } = await startServer({ dataDir, port: 0, noExit: true });
  const base = `http://127.0.0.1:${port}`;
  try {
    const state = dc.ensureData(null);
    const a = dc.addPlanItem(state, '2026-08-30', { text: '写周报', slot: 'morning', important: true });
    dc.addPlanItem(state, '2026-08-30', { text: '健身', slot: 'evening' });
    dc.addPlanItem(state, '2026-08-31', { text: '开会', slot: 'afternoon' });
    dc.togglePlanItem(state, '2026-08-30', a.id);
    const copied = dc.copyUnfinishedToNext(state, '2026-08-30');

    // 保存
    let res = await fetch(base + '/api/data', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state),
    });
    assert.equal(res.status, 200);

    // 重新加载
    res = await fetch(base + '/api/data');
    const j = await res.json();
    const loaded = dc.ensureData(j.data);
    assert.equal(loaded.plan['2026-08-30'].length, 2);
    assert.equal(loaded.plan['2026-08-30'].find((x) => x.id === a.id).done, true);
    assert.equal(loaded.plan['2026-08-31'].length, 1 + copied, '未完成项被复制到明天');
    assert.equal(dc.completionRate(loaded.plan['2026-08-30']), 50);
  } finally {
    await new Promise((r) => server.close(r));
    rmSync(dataDir, { recursive: true, force: true });
  }
});