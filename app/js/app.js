// 应用入口：侧边栏、顶部栏、路由、主题
import { NAV_ITEMS, parseHash, navTitle } from './nav.js';
import * as store from './store.js';
import * as ui from './ui.js';
import { render as renderHome } from './pages/home.js';
import { render as renderToday } from './pages/today.js';
import { render as renderSelfmedia } from './pages/selfmedia.js';
import { render as renderDev } from './pages/dev.js';
import { render as renderConsult } from './pages/consult.js';
import { render as renderFitness } from './pages/fitness.js';
import { render as renderDiet } from './pages/diet.js';
import { render as renderGaming } from './pages/gaming.js';
import { render as renderSettings } from './pages/settings.js';

const PAGES = {
  home: renderHome,
  today: renderToday,
  selfmedia: renderSelfmedia,
  dev: renderDev,
  consult: renderConsult,
  fitness: renderFitness,
  diet: renderDiet,
  gaming: renderGaming,
  settings: renderSettings,
};

async function init() {
  const nav = document.getElementById('nav');
  for (const item of NAV_ITEMS) {
    nav.append(ui.el('a', { class: 'nav-item', href: '#/' + item.id, 'data-page': item.id }, [
      ui.el('span', { class: 'nav-icon', text: item.icon }),
      ui.el('span', { class: 'nav-text', text: item.title }),
    ]));
  }

  const dateEl = document.getElementById('header-date');
  const now = new Date();
  dateEl.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${'日一二三四五六'[now.getDay()]}`;

  store.setStatusEl(document.getElementById('save-status'));
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  const state = await store.load();
  document.documentElement.setAttribute('data-theme', state.settings.theme);
  document.getElementById('theme-toggle').textContent = state.settings.theme === 'dark' ? '☀️ 浅色' : '🌙 深色';

  window.addEventListener('hashchange', route);
  route();
}

function toggleTheme() {
  const state = store.getState();
  const next = state.settings.theme === 'dark' ? 'light' : 'dark';
  state.settings.theme = next;
  document.documentElement.setAttribute('data-theme', next);
  document.getElementById('theme-toggle').textContent = next === 'dark' ? '☀️ 浅色' : '🌙 深色';
  store.save();
}

function route() {
  const { page, param } = parseHash(location.hash);
  const render = PAGES[page];
  const main = document.getElementById('main');
  main.innerHTML = '';
  document.querySelectorAll('.nav-item').forEach((a) => a.classList.toggle('active', a.dataset.page === page));
  const header = ui.el('div', { class: 'page-header' }, [ui.el('h2', { class: 'page-title', text: navTitle(page) })]);
  main.append(header);
  if (render) render(main, { page, param });
  else main.append(ui.el('div', { class: 'empty-state', text: '页面不存在' }));
}

init();