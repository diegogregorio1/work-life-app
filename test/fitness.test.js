import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../app/server.js';
import * as dc from '../app/js/data-core.js';

const DATE = '2026-08-30';

test('addWorkout：同日同模板覆盖，不同模板追加', () => {
  const s = dc.ensureData(null);
  const w1 = { id: 'a', date: DATE, templateId: 't1', exercises: [{ name: '卧推', weight: 60 }] };
  dc.addWorkout(s, w1);
  dc.addWorkout(s, { id: 'b', date: DATE, templateId: 't1', exercises: [{ name: '卧推', weight: 65 }] });
  assert.equal(s.fitness.workouts.length, 1, '同日同模板应覆盖');
  assert.equal(s.fitness.workouts[0].weight || s.fitness.workouts[0].exercises[0].weight, 65);
  dc.addWorkout(s, { id: 'c', date: DATE, templateId: 't2', exercises: [] });
  assert.equal(s.fitness.workouts.length, 2, '不同模板应追加');
});

test('workoutsOn / bodyLatest / bodySorted', () => {
  const s = dc.ensureData(null);
  assert.equal(dc.workoutsOn(s, DATE).length, 0);
  s.fitness.bodyMetrics.push({ id: '1', date: '2026-08-01', weight: 70 }, { id: '2', date: '2026-08-30', weight: 68.5 });
  assert.deepEqual(dc.bodyLatest(s), { id: '2', date: '2026-08-30', weight: 68.5 });
  assert.equal(dc.bodySorted(s)[0].id, '2');
  assert.equal(dc.bodyLatest(dc.ensureData(null)), null);
});

test('健身完整流程经 API 持久化且周目标达标', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'lifeapp-fitness-test-'));
  const { server, port } = await startServer({ dataDir, port: 0, noExit: true });
  const base = `http://127.0.0.1:${port}`;
  try {
    const s = dc.ensureData(null);
    s.fitness.weeklyGoal = 3;
    const tpl = dc.upsert(s.fitness.templates, { name: '胸', exercises: [{ id: 'e1', name: '卧推', sets: 4, reps: 10 }] });
    dc.addWorkout(s, { id: 'w1', date: DATE, templateId: tpl.id, exercises: [{ name: '卧推', weight: 60, sets: 4, reps: 10, done: true }] });
    s.fitness.bodyMetrics.push({ id: 'b1', date: DATE, weight: 65 });

    let res = await fetch(base + '/api/data', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s),
    });
    assert.equal(res.status, 200);
    res = await fetch(base + '/api/data');
    const loaded = dc.ensureData((await res.json()).data);
    assert.equal(loaded.fitness.templates.length, 1);
    assert.equal(loaded.fitness.workouts.length, 1);
    assert.equal(loaded.fitness.bodyMetrics.length, 1);
    const sum = dc.fitnessSummary(loaded, DATE);
    assert.equal(sum.weekCount, 1);
    assert.equal(sum.todayWorkout, true);
    assert.equal(sum.goalMet, false);
    assert.equal(dc.bodyLatest(loaded).weight, 65);
  } finally {
    await new Promise((r) => server.close(r));
    rmSync(dataDir, { recursive: true, force: true });
  }
});