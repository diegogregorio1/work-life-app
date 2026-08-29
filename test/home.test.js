import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../app/server.js';
import * as dc from '../app/js/data-core.js';
import { buildHomeSummaries, summaryOf } from '../app/js/pages/home.js';

const DATE = '2026-08-30';

test('summaryOf 各模块摘要文案', () => {
  assert.deepEqual(summaryOf('selfmedia', { toPublishToday: 2, publishedTotal: 5 }), { num: 2, text: '篇今天待发' });
  assert.deepEqual(summaryOf('selfmedia', { toPublishToday: 0, publishedTotal: 5 }), { num: 0, text: '已发布 5 篇' });
  assert.deepEqual(summaryOf('dev', { active: 2, projects: 3 }), { num: 2, text: '个项目进行中' });
  assert.deepEqual(summaryOf('consult', { appointmentsToday: 1, unpaid: 3 }), { num: 1, text: '今天 1 个预约' });
  assert.deepEqual(summaryOf('consult', { appointmentsToday: 0, unpaid: 3 }), { num: 3, text: '有 3 笔未收款' });
  assert.deepEqual(summaryOf('fitness', { weekCount: 2, weeklyGoal: 3, todayWorkout: true }), { num: 2, text: '本周已练 2/3 · 今天已练' });
  assert.deepEqual(summaryOf('diet', { mealsRecorded: 2, water: 3 }), { num: 2, text: '餐已记录（共 4 餐）' });
  assert.deepEqual(summaryOf('gaming', { minutesToday: 90, playing: 1, wishlist: 2 }), { num: 90, text: '分钟（今天）' });
});

test('buildHomeSummaries 按 settings.homeModules 过滤', () => {
  const s = dc.defaultData();
  s.settings.homeModules = ['fitness', 'gaming'];
  const list = buildHomeSummaries(s, DATE);
  assert.deepEqual(list.map((x) => x.id), ['fitness', 'gaming']);
  assert.equal(list[0].title, '健身计划');
  assert.equal(list[0].href, '#/fitness');
});

test('buildHomeSummaries 返回 6 个模块默认摘要', () => {
  const s = dc.defaultData();
  const list = buildHomeSummaries(s, DATE);
  assert.equal(list.length, 6);
  assert.deepEqual(list.map((x) => x.id), ['selfmedia', 'dev', 'consult', 'fitness', 'diet', 'gaming']);
});

test('首页数据完整流程：构建 → 保存 → 重载 → 摘要一致', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'lifeapp-home-test-'));
  const { server, port } = await startServer({ dataDir, port: 0, noExit: true });
  const base = `http://127.0.0.1:${port}`;
  try {
    const state = dc.ensureData(null);
    dc.addMemo(state, '买牛奶');
    dc.addPlanItem(state, DATE, { text: '写周报', slot: 'morning' });
    const a = dc.addPlanItem(state, DATE, { text: '健身', slot: 'evening' });
    dc.togglePlanItem(state, DATE, a.id);
    state.selfmedia.contents.push({ id: 'c1', publishDate: DATE, status: 'scheduled' });
    state.consult.incomes.push({ id: 'i1', status: 'unpaid' });
    state.gaming.sessions.push({ id: 'g1', date: DATE, minutes: 30 });

    let res = await fetch(base + '/api/data', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state),
    });
    assert.equal(res.status, 200);
    res = await fetch(base + '/api/data');
    const loaded = dc.ensureData((await res.json()).data);

    assert.equal(loaded.memos.length, 1);
    assert.equal(dc.todayPlanSummary(loaded, DATE).rate, 50);
    const sums = buildHomeSummaries(loaded, DATE);
    const sm = sums.find((x) => x.id === 'selfmedia');
    assert.equal(sm.num, 1, '今天有一篇待发');
    const cs = sums.find((x) => x.id === 'consult');
    assert.equal(cs.text, '有 1 笔未收款');
    const gm = sums.find((x) => x.id === 'gaming');
    assert.equal(gm.num, 30);
  } finally {
    await new Promise((r) => server.close(r));
    rmSync(dataDir, { recursive: true, force: true });
  }
});