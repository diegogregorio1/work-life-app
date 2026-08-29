// 饮食计划：今日饮食 / 饮食模板 / 记录回顾
import * as dc from '../data-core.js';
import * as store from '../store.js';
import * as ui from '../ui.js';

const TABS = [
  { key: 'today', label: '今日饮食' },
  { key: 'templates', label: '饮食模板' },
  { key: 'review', label: '记录回顾' },
  { key: 'calendar', label: '日历' },
];

const MEALS = [
  { key: 'breakfast', label: '早餐' },
  { key: 'lunch', label: '午餐' },
  { key: 'dinner', label: '晚餐' },
  { key: 'snack', label: '加餐' },
];

export function render(container) {
  const state = store.getState();
  let tab = 'today';
  let date = dc.todayStr();
  let calYear = null;
  let calMonth = null;
  let calSelected = null;

  function redraw() {
    container.innerHTML = '';
    container.append(ui.el('div', { class: 'tabs' }, TABS.map((t) => ui.el('button', {
      class: 'tab' + (tab === t.key ? ' active' : ''),
      text: t.label,
      onclick: () => { tab = t.key; redraw(); },
    }))));
    if (tab === 'today') renderToday();
    else if (tab === 'templates') renderTemplates();
    else if (tab === 'calendar') renderCalendar();
    else renderReview();
  }

  // ---------- 今日饮食 ----------
  function renderToday() {
    container.append(ui.dateStrip({ date, onChange: (d) => { date = d; redraw(); } }));

    const day = dc.dietDay(state, date);
    const sum = dc.dietSummary(state, date);

    const toolbar = ui.el('div', { class: 'toolbar' }, [
      ui.el('span', { class: 'text-muted', text: `已记录 ${sum.mealsRecorded}/4 餐 · 喝水 ${sum.water} 杯` }),
      ui.el('div', { class: 'kv' }, [
        ui.el('select', { class: 'input', id: 'diet-template-select', style: 'max-width:200px' }, templateOptions()),
        ui.el('button', { class: 'btn btn-ghost btn-sm', text: '套用模板', onclick: applyTemplate }),
      ]),
    ]);
    container.append(toolbar);

    container.append(ui.el('div', { class: 'grid grid-2' }, MEALS.map((m) => {
      const ta = ui.el('textarea', { class: 'input', rows: 3, placeholder: `吃了什么？${m.label}…`, text: day[m.key] || '' });
      ta.oninput = () => { day[m.key] = ta.value; store.save(); };
      return ui.el('div', { class: 'card' }, [
        ui.el('div', { class: 'toolbar' }, [ui.el('b', { text: m.label })]),
        ta,
      ]);
    })));

    const water = ui.el('div', { class: 'card mt' });
    water.append(ui.el('div', { class: 'toolbar' }, [
      ui.el('b', { text: '喝水' }),
      ui.el('div', { class: 'kv' }, [
        ui.el('button', { class: 'btn btn-ghost btn-sm', text: '−1', onclick: () => { day.water = Math.max(0, (Number(day.water) || 0) - 1); store.save(); redraw(); } }),
        ui.el('span', { class: 'text-muted', text: `${day.water || 0} 杯` }),
        ui.el('button', { class: 'btn btn-ghost btn-sm', text: '+1', onclick: () => { day.water = (Number(day.water) || 0) + 1; store.save(); redraw(); } }),
      ]),
    ]));
    container.append(water);
  }

  function templateOptions() {
    const sel = [];
    for (const t of state.diet.templates) {
      const opt = ui.el('option', { value: t.id, text: t.name });
      sel.push(opt);
    }
    return sel;
  }

  function applyTemplate() {
    const select = document.getElementById('diet-template-select');
    if (!select || !select.value) { ui.toast('还没有可用模板，先去「饮食模板」创建一个', 'warn'); return; }
    if (dc.applyDietTemplate(state, date, select.value)) {
      store.save();
      ui.toast('已套用模板到' + date, 'ok');
      redraw();
    }
  }

  // ---------- 饮食模板 ----------
  function renderTemplates() {
    container.append(ui.el('div', { class: 'toolbar' }, [
      ui.el('span', { class: 'text-muted', text: `共 ${state.diet.templates.length} 个模板` }),
      ui.el('button', { class: 'btn btn-primary', text: '+ 新建模板', onclick: () => editTemplate(null) }),
    ]));
    if (state.diet.templates.length === 0) {
      container.append(ui.emptyState('还没有饮食模板，点「+ 新建模板」创建'));
      return;
    }
    container.append(ui.el('div', { class: 'grid grid-2' }, state.diet.templates.map((t) => {
      const card = ui.el('div', { class: 'card' });
      card.append(ui.el('div', { class: 'toolbar' }, [
        ui.el('b', { text: t.name }),
        ui.el('div', { class: 'kv' }, [
          ui.el('button', { class: 'btn btn-ghost btn-sm', text: '套用', onclick: () => { dc.applyDietTemplate(state, dc.todayStr(), t.id); store.save(); ui.toast('已套用到今天', 'ok'); redraw(); } }),
          ui.iconBtn('✏️', '编辑', () => editTemplate(t)),
          ui.iconBtn('🗑️', '删除', async () => {
            if (await ui.confirmBox(`删除模板「${t.name}」？`)) {
              dc.removeById(state.diet.templates, t.id);
              store.save(); redraw();
            }
          }),
        ]),
      ]));
      for (const m of MEALS.slice(0, 3)) {
        if (String(t[m.key] || '').trim()) card.append(ui.el('div', { class: 'text-muted', text: `${m.label}：${t[m.key]}` }));
      }
      return card;
    })));
  }

  function editTemplate(t) {
    ui.formModal({
      title: t ? '编辑模板' : '新建模板',
      fields: [
        { key: 'name', label: '模板名', required: true, placeholder: '如：减脂日 / 正常日' },
        { key: 'breakfast', label: '早餐', type: 'textarea', rows: 2 },
        { key: 'lunch', label: '午餐', type: 'textarea', rows: 2 },
        { key: 'dinner', label: '晚餐', type: 'textarea', rows: 2 },
      ],
      values: t ? { name: t.name, breakfast: t.breakfast || '', lunch: t.lunch || '', dinner: t.dinner || '' } : {},
      onSubmit: (v) => {
        const data = {
          name: v.name.trim(),
          breakfast: (v.breakfast || '').trim(),
          lunch: (v.lunch || '').trim(),
          dinner: (v.dinner || '').trim(),
        };
        if (t) Object.assign(t, data);
        else state.diet.templates.push({ id: dc.uid(), ...data });
        store.save(); redraw();
      },
    });
  }

  // ---------- 记录回顾 ----------
  function renderReview() {
    container.append(ui.dateStrip({ date, onChange: (d) => { date = d; redraw(); } }));
    const day = dc.dietDay(state, date);
    const card = ui.el('div', { class: 'card mb' });
    card.append(ui.el('h3', { class: 'section-title', text: date + ' 的饮食' }));
    for (const m of MEALS) {
      const v = String(day[m.key] || '').trim();
      card.append(ui.el('div', { class: 'row' }, [
        ui.el('span', { class: 'badge badge-neutral', text: m.label }),
        ui.el('span', { class: 'row-text' + (v ? '' : ' text-muted'), text: v || '未记录' }),
      ]));
    }
    card.append(ui.el('div', { class: 'row' }, [
      ui.el('span', { class: 'badge badge-neutral', text: '喝水' }),
      ui.el('span', { class: 'row-text', text: (day.water || 0) + ' 杯' }),
    ]));
    container.append(card);

    const days = dc.recordedDietDays(state);
    container.append(ui.el('h3', { class: 'section-title', text: '有记录的日期' }));
    if (days.length === 0) {
      container.append(ui.emptyState('还没有任何饮食记录'));
      return;
    }
    container.append(ui.el('div', { class: 'card' }, days.map((d) => {
      const dsum = dc.dietSummary(state, d);
      return ui.el('div', { class: 'row' }, [
        ui.el('span', { class: 'row-text', text: d }),
        ui.el('span', { class: 'text-muted', text: `${dsum.mealsRecorded}/4 餐 · ${dsum.water} 杯水` }),
        ui.el('button', { class: 'btn btn-ghost btn-sm', text: '查看', onclick: () => { date = d; redraw(); } }),
      ]);
    })));
  }

  // ---------- 日历 ----------
  function renderCalendar() {
    const now = new Date();
    if (calMonth === null) {
      calYear = now.getFullYear();
      calMonth = now.getMonth() + 1;
      calSelected = dc.todayStr();
    }
    const monthMap = dc.dietMonthMap(state, calYear, calMonth);
    const title = `${calYear}年${calMonth}月`;
    const nav = (dm) => {
      calMonth += dm;
      if (calMonth < 1) { calMonth = 12; calYear--; }
      if (calMonth > 12) { calMonth = 1; calYear++; }
      redraw();
    };
    container.append(ui.el('div', { class: 'calendar-toolbar' }, [
      ui.el('button', { class: 'btn btn-ghost btn-sm', text: '‹ 上月', onclick: () => nav(-1) }),
      ui.el('span', { class: 'calendar-title', text: title }),
      ui.el('button', { class: 'btn btn-ghost btn-sm', text: '下月 ›', onclick: () => nav(1) }),
      ui.el('button', { class: 'btn btn-ghost btn-sm', text: '回到本月', onclick: () => {
        calYear = now.getFullYear();
        calMonth = now.getMonth() + 1;
        calSelected = dc.todayStr();
        redraw();
      } }),
    ]));
    container.append(ui.monthCalendar({
      year: calYear,
      month: calMonth,
      weekStart: state.settings.weekStart,
      selected: calSelected,
      cellRender: (dateStr) => {
        const d = monthMap[dateStr];
        if (!d) return null;
        return ui.el('div', {}, [
          ui.el('span', { class: 'calendar-chip warn', text: `${d.mealsRecorded}/4 餐` }),
          d.water > 0 ? ui.el('span', { class: 'calendar-chip success', text: `${d.water} 杯水` }) : null,
        ]);
      },
      onSelect: (dateStr) => { calSelected = dateStr; redraw(); },
    }));

    const detail = ui.el('div', { class: 'card mt' });
    detail.append(ui.el('h3', { class: 'section-title', text: calSelected + ' 的饮食' }));
    const day = dc.dietDay(state, calSelected);
    for (const m of MEALS) {
      const v = String(day[m.key] || '').trim();
      detail.append(ui.el('div', { class: 'row' }, [
        ui.el('span', { class: 'badge badge-neutral', text: m.label }),
        ui.el('span', { class: 'row-text' + (v ? '' : ' text-muted'), text: v || '未记录' }),
      ]));
    }
    detail.append(ui.el('div', { class: 'row' }, [
      ui.el('span', { class: 'badge badge-neutral', text: '喝水' }),
      ui.el('span', { class: 'row-text', text: (day.water || 0) + ' 杯' }),
    ]));
    container.append(detail);
  }
  redraw();
}