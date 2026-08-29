import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../app/server.js';
import { NAV_ITEMS, parseHash, navTitle } from '../app/js/nav.js';

async function withServer(fn) {
  const dataDir = mkdtempSync(join(tmpdir(), 'lifeapp-framework-test-'));
  const { server, port } = await startServer({ dataDir, port: 0, noExit: true });
  const base = `http://127.0.0.1:${port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((r) => server.close(r));
    rmSync(dataDir, { recursive: true, force: true });
  }
}

test('导航配置包含 9 个模块且顺序正确', () => {
  assert.equal(NAV_ITEMS.length, 9);
  assert.deepEqual(
    NAV_ITEMS.map((x) => x.title),
    ['首页总览', '今日计划', '自媒体', '开发工作', '咨询工作', '健身计划', '饮食计划', '游戏娱乐', '数据与设置']
  );
});

test('parseHash 解析各种 hash', () => {
  assert.deepEqual(parseHash(''), { page: 'home', param: '' });
  assert.deepEqual(parseHash('#/home'), { page: 'home', param: '' });
  assert.deepEqual(parseHash('#/today'), { page: 'today', param: '' });
  assert.deepEqual(parseHash('#/dev/p1'), { page: 'dev', param: 'p1' });
  assert.deepEqual(parseHash('#/dev/%E9%A1%B9%E7%9B%AE'), { page: 'dev', param: '项目' });
  assert.equal(navTitle('fitness'), '健身计划');
  assert.equal(navTitle('nope'), '未知页面');
});

test('index.html 包含核心骨架且无登录入口（导航标题由 nav.js 动态生成）', async () => {
  await withServer(async (base) => {
    const res = await fetch(base + '/');
    const html = await res.text();
    for (const id of ['sidebar', 'nav', 'main', 'topbar', 'save-status', 'theme-toggle']) {
      assert.ok(html.includes('id="' + id + '"'), `缺少骨架节点: ${id}`);
    }
    assert.ok(!/login|登录|注册/i.test(html), '不应出现登录/注册入口');
    assert.ok(html.includes('type="module" src="js/app.js"'));
  });
});

test('所有前端资源文件均可访问且 MIME 正确', async () => {
  await withServer(async (base) => {
    const jsFiles = [
      'js/app.js', 'js/nav.js', 'js/ui.js', 'js/store.js', 'js/data-core.js',
      'js/pages/home.js', 'js/pages/today.js', 'js/pages/selfmedia.js', 'js/pages/dev.js',
      'js/pages/consult.js', 'js/pages/fitness.js', 'js/pages/diet.js', 'js/pages/gaming.js',
      'js/pages/settings.js',
    ];
    for (const f of jsFiles) {
      const res = await fetch(base + '/' + f);
      assert.equal(res.status, 200, `${f} 应可访问`);
      assert.match(res.headers.get('content-type'), /text\/javascript/, `${f} MIME 应为 js`);
    }
    const css = await fetch(base + '/css/style.css');
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type'), /text\/css/);
  });
});

test('每个页面 JS 都是 ES 模块且导出 render 函数', async () => {
  const pages = ['home', 'today', 'selfmedia', 'dev', 'consult', 'fitness', 'diet', 'gaming', 'settings'];
  for (const p of pages) {
    const mod = await import('../app/js/pages/' + p + '.js');
    assert.equal(typeof mod.render, 'function', `${p}.js 应导出 render`);
  }
});