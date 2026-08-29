// 端到端验收测试：对照 PRD 第 10 节，模拟「构建数据 → 保存 → 关闭 → 重启 → 数据仍在」
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../app/server.js';
import * as dc from '../app/js/data-core.js';

function buildFullState() {
  const s = dc.ensureData(null);
  dc.addMemo(s, '买牛奶');
  dc.addPlanItem(s, '2026-08-30', { text: '写周报', slot: 'morning', important: true });
  dc.addPlanItem(s, '2026-08-30', { text: '健身', slot: 'evening' });
  s.selfmedia.platforms.push({ id: 'p1', name: '公众号', account: 'acc' });
  s.selfmedia.contents.push({ id: 'c1', title: '我的文章', platformId: 'p1', status: 'scheduled', publishDate: '2026-08-30' });
  s.selfmedia.ideas.push({ id: 'i1', text: '灵感', source: '书' });
  s.selfmedia.publishStats.push({ id: 'st1', contentId: 'c1', publishDate: '2026-08-29', views: 100, likes: 5, comments: 2 });
  s.dev.projects.push({ id: 'd1', name: '个人网站', stack: 'Node.js', status: 'active', tasks: [{ id: 't1', text: '写后端', status: 'doing', priority: 'high' }], logs: [{ id: 'l1', date: '2026-08-30', text: '完成 API' }] });
  s.consult.clients.push({ id: 'k1', name: '王先生', contact: 'wx' });
  s.consult.appointments.push({ id: 'a1', date: '2026-08-30', time: '14:00', clientId: 'k1', topic: '面谈' });
  s.consult.records.push({ id: 'r1', date: '2026-08-30', clientId: 'k1', topic: '职业咨询', duration: 60, note: '建议' });
  s.consult.incomes.push({ id: 'in1', date: '2026-08-30', clientId: 'k1', amount: 500, status: 'unpaid' });
  s.fitness.weeklyGoal = 3;
  s.fitness.templates.push({ id: 't1', name: '胸', exercises: [{ id: 'e1', name: '卧推', sets: 4, reps: 10 }] });
  dc.addWorkout(s, { id: 'w1', date: '2026-08-30', templateId: 't1', exercises: [{ name: '卧推', weight: 60, sets: 4, reps: 10, done: true }] });
  s.fitness.bodyMetrics.push({ id: 'b1', date: '2026-08-30', weight: 65 });
  dc.dietDay(s, '2026-08-30').lunch = '米饭';
  dc.dietDay(s, '2026-08-30').water = 4;
  s.diet.templates.push({ id: 'dt1', name: '正常日', breakfast: '粥', lunch: '饭', dinner: '菜' });
  s.gaming.library.push({ id: 'g1', name: '塞尔达', status: 'playing' });
  s.gaming.sessions.push({ id: 's1', date: '2026-08-30', game: '塞尔达', minutes: 60 });
  s.gaming.wishlist.push({ id: 'w1', name: '老头环', price: 299, priority: 'high', bought: false });
  s.settings.theme = 'dark';
  s.settings.weekStart = 1;
  s.settings.homeModules = ['selfmedia', 'dev', 'consult', 'fitness', 'diet', 'gaming'];
  return s;
}

async function start(dir) {
  return startServer({ dataDir: dir, port: 0, noExit: true });
}

test('PRD 验收：全部模块数据经「保存 → 关闭 → 重启」后不丢失', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'lifeapp-accept-'));
  let srv = await start(dataDir);
  try {
    const s = buildFullState();
    const res = await fetch(`http://127.0.0.1:${srv.port}/api/data`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s),
    });
    assert.equal(res.status, 200);
    assert.equal(existsSync(join(dataDir, 'data.json')), true, 'data.json 应存在');
  } finally {
    await new Promise((r) => srv.server.close(r));
  }

  // 模拟关闭后重新启动（同一数据目录）
  srv = await start(dataDir);
  try {
    const res = await fetch(`http://127.0.0.1:${srv.port}/api/data`);
    const j = await res.json();
    assert.equal(j.ok, true);
    const loaded = dc.ensureData(j.data);
    // 每个模块抽查
    assert.equal(loaded.memos[0].text, '买牛奶');
    assert.equal(loaded.plan['2026-08-30'].length, 2);
    assert.equal(loaded.selfmedia.contents[0].status, 'scheduled');
    assert.equal(loaded.selfmedia.publishStats[0].views, 100);
    assert.equal(loaded.dev.projects[0].tasks[0].status, 'doing');
    assert.equal(loaded.consult.appointments.length, 1);
    assert.equal(loaded.consult.incomes[0].status, 'unpaid');
    assert.equal(loaded.fitness.workouts.length, 1);
    assert.equal(loaded.fitness.bodyMetrics[0].weight, 65);
    assert.equal(loaded.diet.days['2026-08-30'].lunch, '米饭');
    assert.equal(loaded.gaming.sessions[0].minutes, 60);
    assert.equal(loaded.gaming.wishlist.length, 1);
    assert.equal(loaded.settings.theme, 'dark');

    // 首页摘要可正常生成
    const { buildHomeSummaries } = await import('../app/js/pages/home.js');
    const sums = buildHomeSummaries(loaded, '2026-08-30');
    assert.equal(sums.length, 6);
    assert.equal(sums.find((x) => x.id === 'selfmedia').num, 1, '今天有 1 篇待发');
    assert.equal(sums.find((x) => x.id === 'consult').text, '今天 1 个预约');
    assert.equal(sums.find((x) => x.id === 'gaming').num, 60);
  } finally {
    await new Promise((r) => srv.server.close(r));
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('PRD 验收：服务只绑定本机 127.0.0.1', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'lifeapp-bind-'));
  const srv = await start(dataDir);
  try {
    const addr = srv.server.address();
    assert.equal(addr.address, '127.0.0.1', '只应监听本机地址');
  } finally {
    await new Promise((r) => srv.server.close(r));
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('PRD 验收：导出 → 清空 → 导入 → 损坏恢复 全流程', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'lifeapp-br-'));
  const srv = await start(dataDir);
  const base = `http://127.0.0.1:${srv.port}`;
  try {
    const s = buildFullState();
    await fetch(base + '/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
    // 第二次保存产生备份
    await fetch(base + '/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dc.ensureData(s)) });

    const exported = await (await fetch(base + '/api/export')).json();
    assert.equal(exported.memos.length, 1);

    // 清空
    await fetch(base + '/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dc.ensureData(null)) });
    let cur = dc.ensureData((await (await fetch(base + '/api/data')).json()).data);
    assert.equal(cur.memos.length, 0);

    // 导入恢复
    await fetch(base + '/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(exported) });
    cur = dc.ensureData((await (await fetch(base + '/api/data')).json()).data);
    assert.equal(cur.memos.length, 1);

    // 损坏主文件 → 从备份自动恢复
    writeFileSync(join(dataDir, 'data.json'), '{broken', 'utf8');
    const j = await (await fetch(base + '/api/data')).json();
    assert.equal(j.recovered, true, '损坏时应标记 recovered');
    assert.equal(j.data.version, 1);
    assert.ok(existsSync(join(dataDir, 'data.json')));
  } finally {
    await new Promise((r) => srv.server.close(r));
    rmSync(dataDir, { recursive: true, force: true });
  }
});