// 问题3 验收：开发工作可以添加工作项（任务），且入口明确
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../app/server.js';
import * as dc from '../app/js/data-core.js';

test('addProjectTask 给项目添加任务（自动补全字段/数组）', () => {
  const s = dc.ensureData(null);
  const p = dc.upsert(s.dev.projects, { name: '项目A', status: 'active' });
  delete p.tasks; // 模拟旧数据没有 tasks
  const t = dc.addProjectTask(s, p.id, { text: '写接口' });
  assert.ok(t && t.id);
  assert.equal(t.status, 'todo');
  assert.equal(t.priority, 'normal');
  assert.equal(p.tasks.length, 1);
  assert.equal(dc.projectTaskStats(p).pending, 1);
  assert.equal(dc.addProjectTask(s, 'no-such', { text: 'x' }), null, '项目不存在返回 null');
});

test('添加任务完整流程经 API 持久化', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'lifeapp-dev-workitem-'));
  const { server, port } = await startServer({ dataDir, port: 0, noExit: true });
  const base = `http://127.0.0.1:${port}`;
  try {
    const s = dc.ensureData(null);
    const p = dc.upsert(s.dev.projects, { name: '网站', status: 'active' });
    dc.addProjectTask(s, p.id, { text: '登录功能', priority: 'high' });
    let res = await fetch(base + '/api/data', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s),
    });
    assert.equal(res.status, 200);
    res = await fetch(base + '/api/data');
    const loaded = dc.ensureData((await res.json()).data);
    assert.equal(loaded.dev.projects[0].tasks.length, 1);
    assert.equal(loaded.dev.projects[0].tasks[0].text, '登录功能');
    assert.equal(loaded.dev.projects[0].tasks[0].priority, 'high');
  } finally {
    await new Promise((r) => server.close(r));
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('开发页面包含明确的工作项入口', async () => {
  const src = readFileSync(new URL('../app/js/pages/dev.js', import.meta.url), 'utf8');
  assert.ok(src.includes("text: '进入 ›'"), '项目卡片应有「进入」按钮');
  assert.ok(src.includes("text: '+ 添加任务'"), '应有「添加任务」按钮');
  assert.ok(src.includes('quickAddTask'), '应有快捷添加任务函数');
  const mod = await import('../app/js/pages/dev.js');
  assert.equal(typeof mod.render, 'function');
});