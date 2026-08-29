// 旧数据枚举迁移验收：中文值 -> 英文键
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../app/server.js';
import * as dc from '../app/js/data-core.js';

test('normalizeEnums 把中文枚举值转为英文键', () => {
  const legacy = dc.ensureData({
    plan: { '2026-08-30': [{ id: 'p1', slot: '晚上' }] },
    selfmedia: { contents: [{ id: 'c1', status: '构思中' }, { id: 'c2', status: '已发布' }] },
    dev: {
      projects: [{
        id: 'd1', status: '进行中',
        tasks: [{ id: 't1', status: '待办', priority: '重要' }],
      }],
    },
    consult: { incomes: [{ id: 'i1', status: '未收' }] },
    gaming: {
      library: [{ id: 'g1', status: '在玩' }],
      wishlist: [{ id: 'w1', priority: '高' }],
    },
  });
  assert.equal(legacy.plan['2026-08-30'][0].slot, 'evening');
  assert.equal(legacy.selfmedia.contents[0].status, 'drafting');
  assert.equal(legacy.selfmedia.contents[1].status, 'published');
  assert.equal(legacy.dev.projects[0].status, 'active');
  assert.equal(legacy.dev.projects[0].tasks[0].status, 'todo');
  assert.equal(legacy.dev.projects[0].tasks[0].priority, 'high');
  assert.equal(legacy.consult.incomes[0].status, 'unpaid');
  assert.equal(legacy.gaming.library[0].status, 'playing');
  assert.equal(legacy.gaming.wishlist[0].priority, 'high');
});

test('normalizeEnums 幂等：英文键保持不变', () => {
  const s = dc.ensureData(null);
  dc.addPlanItem(s, '2026-08-30', { text: 'x', slot: 'evening' });
  const before = JSON.stringify(s);
  dc.normalizeEnums(s);
  assert.equal(JSON.stringify(s), before);
});

test('迁移后各模块统计恢复正常', () => {
  const legacy = dc.ensureData({
    selfmedia: { contents: [{ id: 'c1', status: '撰写中' }] },
    dev: { projects: [{ id: 'd1', status: '进行中', tasks: [{ id: 't1', status: '待办' }] }] },
  });
  const sm = dc.selfmediaSummary(legacy, '2026-08-30');
  assert.equal(sm.total, 1);
  assert.equal(sm.inProgress, 1);
  const dv = dc.devSummary(legacy);
  assert.equal(dv.active, 1, '迁移后项目应算作进行中');
  assert.equal(dv.openTasks, 1);
});

test('旧中文数据经 API 保存/加载后为英文键', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'lifeapp-migrate-'));
  const srv = await startServer({ dataDir, port: 0, noExit: true });
  const base = `http://127.0.0.1:${srv.port}`;
  try {
    const legacy = {
      version: 1,
      plan: { '2026-08-30': [{ id: 'p1', text: '任务', slot: '上午', done: false }] },
    };
    await fetch(base + '/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(legacy) });
    const loaded = dc.ensureData((await (await fetch(base + '/api/data')).json()).data);
    assert.equal(loaded.plan['2026-08-30'][0].slot, 'morning');
  } finally {
    await new Promise((r) => srv.server.close(r));
    rmSync(dataDir, { recursive: true, force: true });
  }
});