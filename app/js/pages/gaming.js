// 游戏娱乐：游戏库 / 时间记录 / 心愿单
import * as dc from '../data-core.js';
import * as store from '../store.js';
import * as ui from '../ui.js';

const TABS = [
  { key: 'library', label: '游戏库' },
  { key: 'sessions', label: '时间记录' },
  { key: 'wishlist', label: '心愿单' },
];

export function render(container) {
  const state = store.getState();
  let tab = 'library';
  let date = dc.todayStr();

  function g() { return state.gaming; }

  function redraw() {
    container.innerHTML = '';
    container.append(ui.el('div', { class: 'tabs' }, TABS.map((t) => ui.el('button', {
      class: 'tab' + (tab === t.key ? ' active' : ''),
      text: t.label,
      onclick: () => { tab = t.key; redraw(); },
    }))));
    if (tab === 'library') renderLibrary();
    else if (tab === 'sessions') renderSessions();
    else renderWishlist();
  }

  // ---------- 游戏库 ----------
  function renderLibrary() {
    container.append(ui.el('div', { class: 'toolbar' }, [
      ui.el('span', { class: 'text-muted', text: `共 ${g().library.length} 款游戏` }),
      ui.el('button', { class: 'btn btn-primary', text: '+ 添加游戏', onclick: () => editGame(null) }),
    ]));
    if (g().library.length === 0) {
      container.append(ui.emptyState('游戏库是空的，点「+ 添加游戏」'));
      return;
    }
    container.append(ui.el('div', { class: 'card' }, g().library.map((game) => ui.el('div', { class: 'row' }, [
      ui.el('div', { class: 'row-text' }, [
        ui.el('div', { text: game.name + (game.note ? `（${game.note}）` : '') }),
      ]),
      statusSelect(game),
      ui.el('div', { class: 'row-actions' }, [
        ui.iconBtn('✏️', '编辑', () => editGame(game)),
        ui.iconBtn('🗑️', '删除', async () => {
          if (await ui.confirmBox(`从游戏库删除「${game.name}」？`)) {
            dc.removeById(g().library, game.id);
            store.save(); redraw();
          }
        }),
      ]),
    ]))));
  }

  function statusSelect(game) {
    return ui.el('select', {
      class: 'input', style: 'max-width:110px',
      onchange: (e) => { game.status = e.target.value; store.save(); redraw(); },
    }, dc.GAME_STATUSES.map((s) => ui.el('option', { value: s.key, text: s.label })), );
  }

  function editGame(game) {
    ui.formModal({
      title: game ? '编辑游戏' : '添加游戏',
      fields: [
        { key: 'name', label: '游戏名', required: true, placeholder: '如：塞尔达' },
        { key: 'status', label: '状态', type: 'select', options: dc.GAME_STATUSES },
        { key: 'note', label: '备注', type: 'textarea', rows: 2 },
      ],
      values: game ? { name: game.name, status: game.status, note: game.note || '' } : { status: 'want' },
      onSubmit: (v) => {
        const data = { name: v.name.trim(), status: v.status, note: (v.note || '').trim() };
        if (game) Object.assign(game, data);
        else g().library.push({ id: dc.uid(), ...data });
        store.save(); redraw();
      },
    });
  }

  // ---------- 时间记录 ----------
  function renderSessions() {
    container.append(ui.dateStrip({ date, onChange: (d) => { date = d; redraw(); } }));
    const minutes = dc.sessionMinutesOn(state, date);
    container.append(ui.el('div', { class: 'toolbar' }, [
      ui.el('span', { class: 'text-muted', text: `${date} 共玩 ${minutes} 分钟（${(minutes / 60).toFixed(1)} 小时）` }),
      ui.el('button', { class: 'btn btn-primary', text: '+ 添加记录', onclick: () => editSession(null) }),
    ]));
    const list = dc.sessionsOn(state, date).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if (list.length === 0) {
      container.append(ui.emptyState('这一天还没有游戏时间记录'));
      return;
    }
    container.append(ui.el('div', { class: 'card' }, list.map((s) => ui.el('div', { class: 'row' }, [
      ui.el('span', { class: 'row-text', text: s.game }),
      ui.el('span', { class: 'text-muted', text: s.minutes + ' 分钟' }),
      s.note ? ui.el('span', { class: 'text-muted', text: s.note }) : null,
      ui.el('div', { class: 'row-actions' }, [
        ui.iconBtn('✏️', '编辑', () => editSession(s)),
        ui.iconBtn('🗑️', '删除', async () => {
          if (await ui.confirmBox('删除这条记录？')) {
            dc.removeById(g().sessions, s.id);
            store.save(); redraw();
          }
        }),
      ]),
    ]))));
  }

  function editSession(s) {
    ui.formModal({
      title: s ? '编辑记录' : '添加记录',
      fields: [
        { key: 'date', label: '日期', type: 'date', required: true, default: dc.todayStr() },
        { key: 'game', label: '游戏', required: true },
        { key: 'minutes', label: '时长（分钟）', type: 'number', min: 1, required: true },
        { key: 'note', label: '备注', type: 'textarea', rows: 2 },
      ],
      values: s ? { date: s.date, game: s.game, minutes: s.minutes, note: s.note || '' } : { date: dc.todayStr(), minutes: 30 },
      onSubmit: (v) => {
        const data = { date: v.date, game: v.game.trim(), minutes: Number(v.minutes) || 0, note: (v.note || '').trim() };
        if (s) Object.assign(s, data);
        else g().sessions.push({ id: dc.uid(), ...data });
        store.save(); redraw();
      },
    });
  }

  // ---------- 心愿单 ----------
  function renderWishlist() {
    const pending = g().wishlist.filter((w) => !w.bought).length;
    container.append(ui.el('div', { class: 'toolbar' }, [
      ui.el('span', { class: 'text-muted', text: `共 ${g().wishlist.length} 款 · 未买 ${pending} 款` }),
      ui.el('button', { class: 'btn btn-primary', text: '+ 添加心愿', onclick: () => editWish(null) }),
    ]));
    if (g().wishlist.length === 0) {
      container.append(ui.emptyState('心愿单是空的'));
      return;
    }
    container.append(ui.el('div', { class: 'card' }, g().wishlist.map((w) => ui.el('div', { class: 'row' }, [
      ui.el('span', { class: 'row-text' + (w.bought ? ' done' : ''), text: w.name + (w.price ? `（¥${w.price}）` : '') }),
      w.priority === 'high' ? ui.badge('高优先', 'badge-danger') : null,
      ui.el('button', {
        class: 'btn btn-sm ' + (w.bought ? 'btn-ghost' : 'btn-primary'),
        text: w.bought ? '✓ 已买' : '标记已买',
        onclick: () => { w.bought = !w.bought; store.save(); redraw(); },
      }),
      ui.el('div', { class: 'row-actions' }, [
        ui.iconBtn('✏️', '编辑', () => editWish(w)),
        ui.iconBtn('🗑️', '删除', async () => {
          if (await ui.confirmBox('从心愿单删除？')) {
            dc.removeById(g().wishlist, w.id);
            store.save(); redraw();
          }
        }),
      ]),
    ]))));
  }

  function editWish(w) {
    ui.formModal({
      title: w ? '编辑心愿' : '添加心愿',
      fields: [
        { key: 'name', label: '游戏名', required: true },
        { key: 'price', label: '价格（元）', type: 'number', min: 0 },
        {
          key: 'priority', label: '优先级', type: 'select',
          options: [{ value: 'normal', label: '普通' }, { value: 'high', label: '高' }],
        },
      ],
      values: w ? { name: w.name, price: w.price ?? '', priority: w.priority || 'normal' } : { price: '', priority: 'normal' },
      onSubmit: (v) => {
        const data = {
          name: v.name.trim(),
          price: v.price === null || v.price === '' ? null : Number(v.price),
          priority: v.priority,
        };
        if (w) Object.assign(w, data);
        else g().wishlist.push({ id: dc.uid(), ...data, bought: false });
        store.save(); redraw();
      },
    });
  }

  redraw();
}