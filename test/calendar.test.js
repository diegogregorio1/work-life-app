// 问题5 验收：健身与饮食模块日历视图
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as dc from '../app/js/data-core.js';

test('monthDays 生成正确的当月日期', () => {
  assert.equal(dc.monthDays(2026, 2).length, 28);
  assert.equal(dc.monthDays(2028, 2).length, 29, '闰年2月');
  assert.equal(dc.monthDays(2026, 4).length, 30);
  assert.equal(dc.monthDays(2026, 3).length, 31);
  assert.equal(dc.monthDays(2026, 1)[0], '2026-01-01');
  assert.equal(dc.monthDays(2026, 12)[30], '2026-12-31');
});

test('fitnessMonthMap 汇总每日训练（部位/动作/组数次数）', () => {
  const s = dc.ensureData(null);
  s.fitness.templates.push({ id: 't1', name: '胸', exercises: [{ id: 'e1', name: '卧推', sets: 4, reps: 10 }] });
  s.fitness.workouts.push(
    { id: 'w1', date: '2026-08-10', templateId: 't1', exercises: [{ name: '卧推', sets: 4, reps: 10, weight: 60, done: true }] },
    { id: 'w2', date: '2026-08-10', templateId: 'gone', exercises: [{ name: '深蹲', sets: 3, reps: 8, weight: 80, done: true }] },
    { id: 'w3', date: '2026-08-20', templateId: 't1', exercises: [{ name: '飞鸟', sets: 3, reps: 12, weight: 20, done: false }] }
  );
  const map = dc.fitnessMonthMap(s, 2026, 8);
  assert.ok(map['2026-08-10'], '10 日应有记录');
  assert.equal(map['2026-08-10'].length, 2);
  assert.equal(map['2026-08-10'][0].templateName, '胸');
  assert.equal(map['2026-08-10'][1].templateName, '（已删除模板）');
  assert.equal(map['2026-08-20'][0].exercises[0].reps, 12);
  assert.ok(!map['2026-08-11'], '无训练的日期不应出现');
  assert.equal(Object.keys(map).length, 2);
});

test('dietMonthMap 只汇总有内容的日期', () => {
  const s = dc.ensureData(null);
  dc.dietDay(s, '2026-08-05').lunch = '面条';
  dc.dietDay(s, '2026-08-06').water = 3;
  dc.dietDay(s, '2026-08-07');
  const map = dc.dietMonthMap(s, 2026, 8);
  assert.deepEqual(map['2026-08-05'], { mealsRecorded: 1, water: 0 });
  assert.deepEqual(map['2026-08-06'], { mealsRecorded: 0, water: 3 });
  assert.ok(!map['2026-08-07'], '全空日期不出现');
});

test('健身与饮食页面包含日历页签且模块可加载', async () => {
  const fit = readFileSync(new URL('../app/js/pages/fitness.js', import.meta.url), 'utf8');
  assert.ok(fit.includes("key: 'calendar', label: '日历'"));
  assert.ok(fit.includes('fitnessMonthMap'));
  const fmod = await import('../app/js/pages/fitness.js');
  assert.equal(typeof fmod.render, 'function');

  const diet = readFileSync(new URL('../app/js/pages/diet.js', import.meta.url), 'utf8');
  assert.ok(diet.includes("key: 'calendar', label: '日历'"));
  assert.ok(diet.includes('dietMonthMap'));
  const dmod = await import('../app/js/pages/diet.js');
  assert.equal(typeof dmod.render, 'function');
});