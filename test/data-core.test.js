import test from 'node:test';
import assert from 'node:assert/strict';
import * as dc from '../app/js/data-core.js';

test('defaultData 包含全部模块与设置', () => {
  const d = dc.defaultData();
  assert.equal(d.version, 1);
  assert.ok(d.settings.theme);
  assert.ok(Array.isArray(d.settings.homeModules));
  assert.deepEqual(d.memos, []);
  assert.deepEqual(d.plan, {});
  assert.deepEqual(Object.keys(d.selfmedia).sort(), ['contents', 'ideas', 'platforms', 'publishStats']);
  assert.deepEqual(Object.keys(d.dev), ['projects']);
  assert.deepEqual(Object.keys(d.consult).sort(), ['appointments', 'clients', 'incomes', 'records']);
  assert.deepEqual(Object.keys(d.fitness).sort(), ['bodyMetrics', 'templates', 'weeklyGoal', 'workouts']);
  assert.deepEqual(Object.keys(d.diet).sort(), ['days', 'templates']);
  assert.deepEqual(Object.keys(d.gaming).sort(), ['library', 'sessions', 'wishlist']);
});

test('ensureData 修补缺失字段且保留已有数据', () => {
  const d = dc.ensureData({ version: 1, memos: [{ id: 'm1', text: 'x' }] });
  assert.equal(d.memos.length, 1);
  assert.ok(Array.isArray(d.dev.projects));
  assert.ok(Array.isArray(d.selfmedia.platforms));
  assert.equal(d.settings.theme, 'light');
  const n = dc.ensureData(null);
  assert.deepEqual(n, dc.defaultData());
});

test('日期工具：todayStr / addDays / weekStartDate', () => {
  assert.match(dc.todayStr(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(dc.addDays('2026-08-30', 1), '2026-08-31');
  assert.equal(dc.addDays('2026-08-31', -1), '2026-08-30');
  assert.equal(dc.addDays('2026-08-01', -1), '2026-07-31');
  // 每周从周一开始：2026-08-30 是周日，应归到 2026-08-24 那一周
  assert.equal(dc.weekStartDate('2026-08-30', 1), '2026-08-24');
  assert.equal(dc.weekStartDate('2026-08-24', 1), '2026-08-24');
});

test('备忘：添加/勾选/删除', () => {
  const s = dc.defaultData();
  const m = dc.addMemo(s, '  记得买牛奶  ');
  assert.ok(m && m.id);
  assert.equal(m.text, '记得买牛奶');
  dc.toggleMemo(s, m.id);
  assert.equal(dc.byId(s.memos, m.id).done, true);
  dc.toggleMemo(s, m.id);
  assert.equal(dc.byId(s.memos, m.id).done, false);
  assert.equal(dc.removeMemo(s, m.id), true);
  assert.equal(s.memos.length, 0);
  assert.equal(dc.addMemo(s, '   '), null);
});

test('今日计划：增删改/勾选/完成率/复制到明天', () => {
  const s = dc.defaultData();
  const a = dc.addPlanItem(s, '2026-08-30', { text: '写周报', slot: 'morning', important: true });
  const b = dc.addPlanItem(s, '2026-08-30', { text: '健身', slot: 'evening' });
  assert.equal(dc.planItems(s, '2026-08-30').length, 2);
  dc.togglePlanItem(s, '2026-08-30', a.id);
  assert.equal(dc.byId(s.plan['2026-08-30'], a.id).done, true);
  assert.equal(dc.completionRate(s.plan['2026-08-30']), 50);
  dc.updatePlanItem(s, '2026-08-30', b.id, { text: '健身+跑步' });
  assert.equal(dc.byId(s.plan['2026-08-30'], b.id).text, '健身+跑步');
  const copied = dc.copyUnfinishedToNext(s, '2026-08-30');
  assert.equal(copied, 1, '只有未完成项被复制');
  const next = s.plan['2026-08-31'];
  assert.equal(next.length, 1);
  assert.equal(next[0].text, '健身+跑步');
  assert.equal(next[0].done, false);
  assert.equal(dc.removePlanItem(s, '2026-08-30', a.id), true);
  assert.equal(s.plan['2026-08-30'].length, 1);
});

test('今日计划摘要', () => {
  const s = dc.defaultData();
  dc.addPlanItem(s, '2026-08-30', { text: 'a' });
  const b = dc.addPlanItem(s, '2026-08-30', { text: 'b' });
  dc.togglePlanItem(s, '2026-08-30', b.id);
  const sum = dc.todayPlanSummary(s, '2026-08-30');
  assert.deepEqual(sum, { total: 2, done: 1, pending: 1, rate: 50 });
});

test('自媒体状态流转', () => {
  assert.equal(dc.nextContentStatus('drafting'), 'writing');
  assert.equal(dc.nextContentStatus('writing'), 'scheduled');
  assert.equal(dc.nextContentStatus('scheduled'), 'published');
  assert.equal(dc.nextContentStatus('published'), null);
  assert.equal(dc.contentStatusLabel('scheduled'), '待发布');
});

test('各模块首页摘要', () => {
  const s = dc.defaultData();
  // 自媒体
  s.selfmedia.contents.push(
    { id: 'c1', publishDate: '2026-08-30', status: 'scheduled' },
    { id: 'c2', publishDate: '2026-08-29', status: 'published' }
  );
  s.selfmedia.ideas.push({ id: 'i1' });
  const sm = dc.selfmediaSummary(s, '2026-08-30');
  assert.equal(sm.toPublishToday, 1);
  assert.equal(sm.publishedTotal, 1);
  assert.equal(sm.ideas, 1);
  // 开发
  s.dev.projects.push({ id: 'p1', status: 'active', tasks: [{ status: 'todo' }, { status: 'done' }] });
  const dv = dc.devSummary(s);
  assert.equal(dv.projects, 1);
  assert.equal(dv.active, 1);
  assert.equal(dv.openTasks, 1);
  // 咨询
  s.consult.appointments.push({ id: 'ap1', date: '2026-08-30' });
  s.consult.incomes.push({ id: 'in1', status: 'unpaid' }, { id: 'in2', status: 'paid' });
  const cs = dc.consultSummary(s, '2026-08-30');
  assert.equal(cs.appointmentsToday, 1);
  assert.equal(cs.unpaid, 1);
  // 健身：本周 2 次，目标 3 次
  s.fitness.weeklyGoal = 3;
  s.fitness.workouts.push({ id: 'w1', date: '2026-08-25' }, { id: 'w2', date: '2026-08-30' });
  const fs = dc.fitnessSummary(s, '2026-08-30');
  assert.equal(fs.weekCount, 2);
  assert.equal(fs.todayWorkout, true);
  assert.equal(fs.goalMet, false);
  // 饮食：记了 2 餐 + 3 杯水
  dc.dietDay(s, '2026-08-30');
  s.diet.days['2026-08-30'].breakfast = '鸡蛋';
  s.diet.days['2026-08-30'].lunch = '米饭';
  s.diet.days['2026-08-30'].water = 3;
  const dt = dc.dietSummary(s, '2026-08-30');
  assert.equal(dt.mealsRecorded, 2);
  assert.equal(dt.water, 3);
  assert.equal(dt.allMeals, false);
  // 游戏：今天 90 分钟，2 款在玩，1 个心愿单
  s.gaming.sessions.push({ id: 'g1', date: '2026-08-30', minutes: 60 }, { id: 'g2', date: '2026-08-30', minutes: 30 });
  s.gaming.library.push({ id: 'l1', status: 'playing' }, { id: 'l2', status: 'playing' });
  s.gaming.wishlist.push({ id: 'w1', bought: false });
  const gm = dc.gamingSummary(s, '2026-08-30');
  assert.equal(gm.minutesToday, 90);
  assert.equal(gm.playing, 2);
  assert.equal(gm.wishlist, 1);
});

test('每周起始日影响健身周统计', () => {
  const s = dc.defaultData();
  s.settings.weekStart = 0; // 周日
  s.fitness.workouts.push({ id: 'w1', date: '2026-08-30' }); // 周日
  const fs = dc.fitnessSummary(s, '2026-08-30');
  assert.equal(fs.weekCount, 1);
  s.settings.weekStart = 1;
  assert.equal(dc.fitnessSummary(s, '2026-08-30').weekCount, 1);
});