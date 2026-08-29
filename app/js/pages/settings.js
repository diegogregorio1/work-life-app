// 数据与设置：数据文件位置、导出/导入、主题、每周起始日、首页摘要模块
import * as store from '../store.js';
import * as ui from '../ui.js';

const HOME_MODULES = [
  { id: 'selfmedia', label: '自媒体' },
  { id: 'dev', label: '开发工作' },
  { id: 'consult', label: '咨询工作' },
  { id: 'fitness', label: '健身计划' },
  { id: 'diet', label: '饮食计划' },
  { id: 'gaming', label: '游戏娱乐' },
];

export function render(container) {
  const state = store.getState();
  let dataFile = '加载中…';

  fetch('/api/info')
    .then((r) => r.json())
    .then((j) => { if (j.ok) { dataFile = j.dataFile; redraw(); } })
    .catch(() => {});

  function redraw() {
    container.innerHTML = '';

    // ---------- 数据 ----------
    const dataCard = ui.el('div', { class: 'card mb' });
    dataCard.append(ui.el('h3', { class: 'section-title', text: '数据' }));
    dataCard.append(ui.el('p', { class: 'text-muted', text: '数据文件位置：' + dataFile }));
    dataCard.append(ui.el('p', { class: 'text-muted', text: '所有数据实时自动保存到上面的文件；建议定期导出备份。' }));

    const fileInput = ui.el('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files[0];
      fileInput.value = '';
      if (!f) return;
      if (await ui.confirmBox('导入会覆盖当前全部数据，确定继续吗？', { confirmText: '导入', danger: false })) {
        try {
          await store.importData(f);
          ui.toast('导入成功', 'ok');
          redraw();
        } catch (e) {
          ui.toast('导入失败：' + e.message, 'error');
        }
      }
    });
    dataCard.append(ui.el('div', { class: 'kv mt' }, [
      ui.el('button', {
        class: 'btn btn-primary', text: '导出备份',
        onclick: async () => {
          try { await store.exportData(); ui.toast('已导出备份文件', 'ok'); }
          catch (e) { ui.toast('导出失败：' + e.message, 'error'); }
        },
      }),
      ui.el('button', { class: 'btn btn-ghost', text: '导入恢复', onclick: () => fileInput.click() }),
      fileInput,
    ]));
    container.append(dataCard);

    // ---------- 设置 ----------
    const setCard = ui.el('div', { class: 'card mb' });
    setCard.append(ui.el('h3', { class: 'section-title', text: '设置' }));

    setCard.append(ui.el('label', { class: 'field-label', text: '主题' }));
    const themeSel = ui.el('select', { class: 'input' }, [
      ui.el('option', { value: 'light', text: '浅色' }),
      ui.el('option', { value: 'dark', text: '深色' }),
    ]);
    themeSel.value = state.settings.theme;
    themeSel.onchange = () => {
      state.settings.theme = themeSel.value;
      document.documentElement.setAttribute('data-theme', themeSel.value);
      const btn = document.getElementById('theme-toggle');
      if (btn) btn.textContent = themeSel.value === 'dark' ? '☀️ 浅色' : '🌙 深色';
      store.save();
    };
    setCard.append(themeSel);

    setCard.append(ui.el('label', { class: 'field-label mt', text: '每周从哪一天开始（影响健身周统计）' }));
    const weekSel = ui.el('select', { class: 'input' }, [
      ui.el('option', { value: '0', text: '周日' }),
      ui.el('option', { value: '1', text: '周一' }),
    ]);
    weekSel.value = String(state.settings.weekStart);
    weekSel.onchange = () => { state.settings.weekStart = Number(weekSel.value); store.save(); };
    setCard.append(weekSel);

    setCard.append(ui.el('label', { class: 'field-label mt', text: '首页摘要显示哪些模块' }));
    const homeMods = new Set(state.settings.homeModules || []);
    const grid = ui.el('div', { class: 'grid grid-3 mt' });
    for (const m of HOME_MODULES) {
      const cb = ui.el('input', { type: 'checkbox', class: 'checkbox-lg', checked: homeMods.has(m.id) });
      cb.onchange = () => {
        if (cb.checked) homeMods.add(m.id);
        else homeMods.delete(m.id);
        state.settings.homeModules = HOME_MODULES.map((x) => x.id).filter((id) => homeMods.has(id));
        store.save();
      };
      grid.append(ui.el('label', { class: 'kv' }, [cb, ui.el('span', { text: m.label })]));
    }
    setCard.append(grid);
    container.append(setCard);

    // ---------- 关于 ----------
    const about = ui.el('div', { class: 'card' });
    about.append(ui.el('h3', { class: 'section-title', text: '关于' }));
    about.append(ui.el('p', { class: 'text-muted', text: '工作生活专属 APP · V1.0' }));
    about.append(ui.el('p', { class: 'text-muted', text: '仅在本机运行，不上网、不登录、无手机端。所有数据保存在上方路径的数据文件中。' }));
    container.append(about);
  }

  redraw();
}