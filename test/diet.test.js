import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../app/server.js';
import * as dc from '../app/js/data-core.js';

const DATE = '2026-08-30';

test('applyDietTemplate 把模板三餐套用到某天', () => {
  const s = dc.ensureData(null);
  const t = dc.upsert(s.diet.templates, { name: '减脂日', breakfast: '鸡蛋牛奶', lunch: '鸡胸饭', dinner: '沙拉' });
  const ok = dc.applyDietTemplate(s, DATE, t.id);
  assert.equal(ok, true);
  const day = s.diet.days[DATE];
  assert.equal(day.breakfast, '鸡蛋牛奶');
  assert.equal(day.lunch, '鸡胸饭');
  assert.equal(day.dinner, '沙拉');
  assert.equal(dc.applyDietTemplate(s, DATE, 'no-such'), false);
});

test('recordedDietDays 只列出有内容的日期', () => {
  const s = dc.ensureData(null);
  dc.dietDay(s, '2026-08-28').water = 2;
  dc.dietDay(s, '2026-08-29').lunch = '面条';
  dc.dietDay(s, '2026-08-30');
  assert.deepEqual(dc.recordedDietDays(s), ['2026-08-29', '2026-08-28']);
});

test('饮食完整流程经 API 持久化', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'lifeapp-diet-test-'));
  const { server, port } = await startServer({ dataDir, port: 0, noExit: true });
  const base = `http://127.0.0.1:${port}`;
  try {
    const s = dc.ensureData(null);
    const t = dc.upsert(s.diet.templates, { name: '正常日', breakfast: '粥', lunch: '饭', dinner: '菜' });
    dc.applyDietTemplate(s, DATE, t.id);
    const day = dc.dietDay(s, DATE);
    day.snack = '水果';
    day.water = 4;

    let res = await fetch(base + '/api/data', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s),
    });
    assert.equal(res.status, 200);
    res = await fetch(base + '/api/data');
    const loaded = dc.ensureData((await res.json()).data);
    assert.equal(loaded.diet.templates.length, 1);
    assert.equal(loaded.diet.days[DATE].lunch, '饭');
    assert.equal(loaded.diet.days[DATE].water, 4);
    const sum = dc.dietSummary(loaded, DATE);
    assert.equal(sum.mealsRecorded, 4);
    assert.equal(sum.allMeals, true);
    assert.deepEqual(dc.recordedDietDays(loaded), [DATE]);
  } finally {
    await new Promise((r) => server.close(r));
    rmSync(dataDir, { recursive: true, force: true });
  }
});