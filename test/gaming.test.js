import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../app/server.js';
import * as dc from '../app/js/data-core.js';

const DATE = '2026-08-30';

test('sessionMinutesOn 汇总当天游戏时长', () => {
  const s = dc.ensureData(null);
  s.gaming.sessions.push(
    { id: '1', date: DATE, minutes: 45 },
    { id: '2', date: DATE, minutes: '30' },
    { id: '3', date: '2026-08-29', minutes: 60 }
  );
  assert.equal(dc.sessionMinutesOn(s, DATE), 75);
  assert.equal(dc.sessionsOn(s, DATE).length, 2);
});

test('游戏状态常量完整', () => {
  assert.deepEqual(dc.GAME_STATUSES.map((x) => x.key), ['want', 'playing', 'done', 'dropped']);
});

test('游戏娱乐完整流程经 API 持久化', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'lifeapp-gaming-test-'));
  const { server, port } = await startServer({ dataDir, port: 0, noExit: true });
  const base = `http://127.0.0.1:${port}`;
  try {
    const s = dc.ensureData(null);
    const game = dc.upsert(s.gaming.library, { name: '塞尔达', status: 'want' });
    game.status = 'playing';
    s.gaming.sessions.push({ id: 's1', date: DATE, game: '塞尔达', minutes: 90 });
    const wish = dc.upsert(s.gaming.wishlist, { name: '老头环', price: 299, priority: 'high', bought: false });
    wish.bought = true;

    let res = await fetch(base + '/api/data', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s),
    });
    assert.equal(res.status, 200);
    res = await fetch(base + '/api/data');
    const loaded = dc.ensureData((await res.json()).data);
    assert.equal(loaded.gaming.library[0].status, 'playing');
    assert.equal(loaded.gaming.sessions.length, 1);
    assert.equal(loaded.gaming.wishlist[0].bought, true);
    assert.equal(dc.sessionMinutesOn(loaded, DATE), 90);
    const sum = dc.gamingSummary(loaded, DATE);
    assert.equal(sum.minutesToday, 90);
    assert.equal(sum.playing, 1);
    assert.equal(sum.wishlist, 0, '已买的愿望不算待买');
  } finally {
    await new Promise((r) => server.close(r));
    rmSync(dataDir, { recursive: true, force: true });
  }
});