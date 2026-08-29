import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../app/server.js';
import * as dc from '../app/js/data-core.js';

test('内容状态完整流转：构思中 → 撰写中 → 待发布 → 已发布', () => {
  const s = dc.ensureData(null);
  const c = { id: dc.uid(), title: '我的文章', status: 'drafting', publishDate: null };
  s.selfmedia.contents.push(c);
  let status = c.status;
  const chain = [status];
  let next = dc.nextContentStatus(status);
  while (next) {
    c.status = next;
    chain.push(next);
    next = dc.nextContentStatus(c.status);
  }
  assert.deepEqual(chain, ['drafting', 'writing', 'scheduled', 'published']);
});

test('平台与内容增删改', () => {
  const s = dc.ensureData(null);
  const p = dc.upsert(s.selfmedia.platforms, { name: '公众号', account: 'my-account' });
  assert.equal(s.selfmedia.platforms.length, 1);
  assert.ok(p.id);
  const c = dc.upsert(s.selfmedia.contents, { title: '标题', platformId: p.id, status: 'drafting' });
  assert.equal(s.selfmedia.contents.length, 1);
  dc.upsert(s.selfmedia.contents, { id: c.id, title: '改过的标题' });
  assert.equal(s.selfmedia.contents[0].title, '改过的标题');
  dc.removeById(s.selfmedia.contents, c.id);
  assert.equal(s.selfmedia.contents.length, 0);
  dc.removeById(s.selfmedia.platforms, p.id);
  assert.equal(s.selfmedia.platforms.length, 0);
});

test('自媒体完整流程经 API 持久化', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'lifeapp-selfmedia-test-'));
  const { server, port } = await startServer({ dataDir, port: 0, noExit: true });
  const base = `http://127.0.0.1:${port}`;
  try {
    const s = dc.ensureData(null);
    const p = dc.upsert(s.selfmedia.platforms, { name: 'B站', account: 'up' });
    const c = dc.upsert(s.selfmedia.contents, { title: '视频', platformId: p.id, status: 'drafting', publishDate: '2026-08-30' });
    c.status = 'scheduled';
    s.selfmedia.ideas.unshift({ id: dc.uid(), text: '一个灵感', source: '看书' });
    s.selfmedia.publishStats.push({ id: dc.uid(), contentId: c.id, publishDate: '2026-08-30', views: 100, likes: 5, comments: 2 });

    let res = await fetch(base + '/api/data', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s),
    });
    assert.equal(res.status, 200);
    res = await fetch(base + '/api/data');
    const loaded = dc.ensureData((await res.json()).data);
    assert.equal(loaded.selfmedia.platforms.length, 1);
    assert.equal(loaded.selfmedia.contents[0].status, 'scheduled');
    assert.equal(loaded.selfmedia.ideas.length, 1);
    assert.equal(loaded.selfmedia.publishStats[0].views, 100);
    const sum = dc.selfmediaSummary(loaded, '2026-08-30');
    assert.equal(sum.toPublishToday, 1, '待发布且排期在今天的算今天待发');
  } finally {
    await new Promise((r) => server.close(r));
    rmSync(dataDir, { recursive: true, force: true });
  }
});