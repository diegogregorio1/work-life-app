// 今日计划页面
import * as dc from '../data-core.js';
import * as store from '../store.js';
import * as ui from '../ui.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function render(container, ctx) {
  let date = ctx.param && DATE_RE.test(ctx.param) ? ctx.param : dc.todayStr();
  const state = store.getState();

  function redraw() {
    container.innerHTML = '';
    container.append(ui.dateStrip({ date, onChange: (d) => { date = d; redraw(); } }));

    const items = dc.planItems(state, date);
    const rate = dc.completionRate(items);

    container.append(ui.el('div', { class: 'toolbar' }, [
      ui.el('span', { class: 'text-muted', text: `共 ${items.length} 项 · 完成率 ${rate}%` }),
      ui.el('button', { class: 'btn btn-primary', text: '+ 添加事项', onclick: addItem }),
    ]));
    if (items.length > 0) container.append(ui.progressBar(rate));

    if (items.length === 0) {
      container.append(ui.emptyState('这一天还没有安排，点「+ 添加事项」开始吧'));
    } else {
      const groups = dc.groupBySlot(items);
      for (const slot of dc.SLOTS) {
        const slotItems = groups[slot.key];
        if (!slotItems || slotItems.length === 0) continue;
        container.append(ui.el('h3', { class: 'section-title', text: slot.label }));
        container.append(ui.el('div', { class: 'card' }, slotItems.map((it) => row(it))));
      }
    }

    const pending = items.filter((x) => !x.done).length;
    if (pending > 0) {
      container.append(ui.el('button', {
        class: 'btn btn-ghost mt',
        text: `把 ${pending} 项未完成复制到明天`,
        onclick: copyNext,
      }));
    }
  }

  function row(it) {
    return ui.el('div', { class: 'row' }, [
      ui.el('input', {
        class: 'checkbox-lg', type: 'checkbox', checked: it.done,
        onclick: () => { dc.togglePlanItem(state, date, it.id); store.save(); redraw(); },
      }),
      ui.el('span', { class: 'row-text' + (it.done ? ' done' : ''), text: it.text }),
      it.important ? ui.badge('重要', 'badge-danger') : null,
      it.note ? ui.el('span', { class: 'text-muted', text: it.note }) : null,
      ui.el('div', { class: 'row-actions' }, [
        ui.iconBtn('✏️', '编辑', () => editItem(it)),
        ui.iconBtn('🗑️', '删除', async () => {
          if (await ui.confirmBox(`确定删除「${it.text}」？`)) {
            dc.removePlanItem(state, date, it.id);
            store.save();
            redraw();
          }
        }),
      ]),
    ]);
  }

  const PLAN_FIELDS = [
    { key: 'text', label: '内容', required: true, placeholder: '要做什么？' },
    { key: 'slot', label: '时间段', type: 'select', options: dc.SLOTS },
    {
      key: 'important', label: '是否重要', type: 'select',
      options: [{ value: 'false', label: '普通' }, { value: 'true', label: '重要' }],
    },
    { key: 'note', label: '备注', type: 'textarea', rows: 2 },
  ];

  function addItem() {
    ui.formModal({
      title: `添加事项（${date}）`,
      fields: PLAN_FIELDS,
      values: { slot: 'morning', important: 'false' },
      onSubmit: (v) => {
        dc.addPlanItem(state, date, {
          text: v.text.trim(),
          slot: v.slot,
          important: v.important === 'true',
          note: (v.note || '').trim(),
        });
        store.save();
        redraw();
      },
    });
  }

  function editItem(it) {
    ui.formModal({
      title: '编辑事项',
      fields: PLAN_FIELDS,
      values: { text: it.text, slot: it.slot, important: String(it.important), note: it.note || '' },
      onSubmit: (v) => {
        dc.updatePlanItem(state, date, it.id, {
          text: v.text.trim(),
          slot: v.slot,
          important: v.important === 'true',
          note: (v.note || '').trim(),
        });
        store.save();
        redraw();
      },
    });
  }

  function copyNext() {
    const n = dc.copyUnfinishedToNext(state, date);
    if (n === 0) return;
    store.save();
    ui.toast(`已把 ${n} 项未完成复制到明天`, 'ok');
    redraw();
  }

  redraw();
}