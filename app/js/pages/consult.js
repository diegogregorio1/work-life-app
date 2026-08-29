// 咨询工作：客户 / 预约 / 咨询记录 / 收入
import * as dc from '../data-core.js';
import * as store from '../store.js';
import * as ui from '../ui.js';

const TABS = [
  { key: 'clients', label: '客户' },
  { key: 'appointments', label: '预约' },
  { key: 'records', label: '咨询记录' },
  { key: 'incomes', label: '收入' },
];

export function render(container) {
  const state = store.getState();
  let tab = 'clients';
  let clientId = null;

  function c() { return state.consult; }
  function clientName(id) {
    const cl = dc.byId(c().clients, id);
    return cl ? cl.name : '（已删除客户）';
  }
  function clientOptions() {
    return c().clients.map((cl) => ({ value: cl.id, label: cl.name }));
  }

  function redraw() {
    container.innerHTML = '';
    container.append(ui.el('div', { class: 'tabs' }, TABS.map((t) => ui.el('button', {
      class: 'tab' + (tab === t.key ? ' active' : ''),
      text: t.label,
      onclick: () => { tab = t.key; clientId = null; redraw(); },
    }))));
    if (tab === 'clients' && clientId) renderClientDetail();
    else if (tab === 'clients') renderClients();
    else if (tab === 'appointments') renderAppointments();
    else if (tab === 'records') renderRecords();
    else renderIncomes();
  }

  // ---------- 客户 ----------
  function renderClients() {
    container.append(ui.el('div', { class: 'toolbar' }, [
      ui.el('span', { class: 'text-muted', text: `共 ${c().clients.length} 位客户` }),
      ui.el('button', { class: 'btn btn-primary', text: '+ 添加客户', onclick: () => editClient(null) }),
    ]));
    if (c().clients.length === 0) {
      container.append(ui.emptyState('还没有客户，点「+ 添加客户」开始'));
      return;
    }
    container.append(ui.el('div', { class: 'card' }, c().clients.map((cl) => ui.el('div', { class: 'row' }, [
      ui.el('div', { class: 'row-text' }, [
        ui.el('div', { text: cl.name + (cl.contact ? `（${cl.contact}）` : '') }),
        ui.el('div', { class: 'text-muted', text: [cl.source, cl.note].filter(Boolean).join(' · ') }),
      ]),
      ui.el('button', { class: 'btn btn-ghost btn-sm', text: '查看', onclick: () => { clientId = cl.id; redraw(); } }),
      ui.el('div', { class: 'row-actions' }, [
        ui.iconBtn('✏️', '编辑', () => editClient(cl)),
        ui.iconBtn('🗑️', '删除', async () => {
          if (await ui.confirmBox(`删除客户「${cl.name}」？其关联记录仍会保留但显示为已删除。`)) {
            dc.removeById(c().clients, cl.id);
            store.save(); redraw();
          }
        }),
      ]),
    ]))));
  }

  function renderClientDetail(cl) {
    container.append(ui.el('div', { class: 'toolbar' }, [
      ui.el('button', { class: 'btn btn-ghost btn-sm', text: '← 返回客户列表', onclick: () => { clientId = null; redraw(); } }),
      ui.el('div', { class: 'kv' }, [
        ui.iconBtn('✏️', '编辑', () => editClient(cl)),
        ui.iconBtn('🗑️', '删除', async () => {
          if (await ui.confirmBox(`删除客户「${cl.name}」？`)) {
            dc.removeById(c().clients, cl.id);
            store.save(); clientId = null; redraw();
          }
        }),
      ]),
    ]));
    const info = ui.el('div', { class: 'card mb' });
    info.append(ui.el('h3', { class: 'section-title', text: cl.name }));
    info.append(ui.el('p', { class: 'text-muted', text: `联系方式：${cl.contact || '未填'}` }));
    if (cl.source) info.append(ui.el('p', { class: 'text-muted', text: '来源：' + cl.source }));
    if (cl.note) info.append(ui.el('p', { text: cl.note }));
    container.append(info);

    const records = c().records.filter((r) => r.clientId === cl.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    container.append(ui.el('h3', { class: 'section-title', text: '咨询记录' }));
    if (records.length === 0) container.append(ui.emptyState('这位客户还没有咨询记录'));
    else container.append(ui.el('div', { class: 'card mb' }, records.map((r) => ui.el('div', { class: 'row' }, [
      ui.el('span', { class: 'badge badge-neutral', text: r.date }),
      ui.el('span', { class: 'row-text', text: r.topic + (r.duration ? `（${r.duration} 分钟）` : '') }),
      r.note ? ui.el('span', { class: 'text-muted', text: r.note }) : null,
    ]))));

    const incomes = c().incomes.filter((i) => i.clientId === cl.id);
    container.append(ui.el('h3', { class: 'section-title', text: '收入' }));
    if (incomes.length === 0) container.append(ui.emptyState('这位客户还没有收入记录'));
    else container.append(ui.el('div', { class: 'card' }, incomes.map((i) => ui.el('div', { class: 'row' }, [
      ui.el('span', { class: 'row-text', text: `${i.date} · ¥${i.amount}` }),
      ui.badge(i.status === 'paid' ? '已收' : '未收', i.status === 'paid' ? 'badge-success' : 'badge-danger'),
    ]))));
  }

  function editClient(cl) {
    ui.formModal({
      title: cl ? '编辑客户' : '添加客户',
      fields: [
        { key: 'name', label: '称呼', required: true, placeholder: '如：王先生 / 李女士' },
        { key: 'contact', label: '联系方式', placeholder: '微信/电话（可选）' },
        { key: 'source', label: '来源', placeholder: '如：朋友介绍（可选）' },
        { key: 'note', label: '备注', type: 'textarea', rows: 2 },
      ],
      values: cl ? { name: cl.name, contact: cl.contact || '', source: cl.source || '', note: cl.note || '' } : {},
      onSubmit: (v) => {
        const data = { name: v.name.trim(), contact: (v.contact || '').trim(), source: (v.source || '').trim(), note: (v.note || '').trim() };
        if (cl) Object.assign(cl, data);
        else c().clients.push({ id: dc.uid(), ...data });
        store.save(); redraw();
      },
    });
  }

  // ---------- 预约 ----------
  function renderAppointments() {
    container.append(ui.el('div', { class: 'toolbar' }, [
      ui.el('span', { class: 'text-muted', text: `共 ${c().appointments.length} 个预约` }),
      ui.el('button', { class: 'btn btn-primary', text: '+ 添加预约', onclick: () => editAppointment(null) }),
    ]));
    if (c().appointments.length === 0) {
      container.append(ui.emptyState('还没有预约'));
      return;
    }
    const today = dc.todayStr();
    const sorted = [...c().appointments].sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    container.append(ui.el('div', { class: 'card' }, sorted.map((a) => ui.el('div', { class: 'row' }, [
      ui.el('div', { class: 'row-text' }, [
        ui.el('div', { text: `${a.date}${a.time ? ' ' + a.time : ''} · ${clientName(a.clientId)}` }),
        ui.el('div', { class: 'text-muted', text: a.topic || '' }),
      ]),
      a.date === today ? ui.badge('今天', 'badge-warn') : a.date < today ? ui.badge('已过', 'badge-neutral') : ui.badge('未来', 'badge-success'),
      ui.el('div', { class: 'row-actions' }, [
        ui.iconBtn('✏️', '编辑', () => editAppointment(a)),
        ui.iconBtn('🗑️', '删除', async () => {
          if (await ui.confirmBox('删除这个预约？')) {
            dc.removeById(c().appointments, a.id);
            store.save(); redraw();
          }
        }),
      ]),
    ]))));
  }

  function editAppointment(a) {
    ui.formModal({
      title: a ? '编辑预约' : '添加预约',
      fields: [
        { key: 'date', label: '日期', type: 'date', required: true, default: dc.todayStr() },
        { key: 'time', label: '时间', type: 'time' },
        { key: 'clientId', label: '客户', type: 'select', options: clientOptions() },
        { key: 'topic', label: '主题', placeholder: '聊什么（可选）' },
      ],
      values: a ? { date: a.date, time: a.time || '', clientId: a.clientId || '', topic: a.topic || '' } : { date: dc.todayStr(), clientId: '' },
      onSubmit: (v) => {
        const data = { date: v.date, time: v.time || '', clientId: v.clientId || null, topic: (v.topic || '').trim() };
        if (a) Object.assign(a, data);
        else c().appointments.push({ id: dc.uid(), ...data });
        store.save(); redraw();
      },
    });
  }

  // ---------- 咨询记录 ----------
  function renderRecords() {
    container.append(ui.el('div', { class: 'toolbar' }, [
      ui.el('span', { class: 'text-muted', text: `共 ${c().records.length} 条记录` }),
      ui.el('button', { class: 'btn btn-primary', text: '+ 添加记录', onclick: () => editRecord(null) }),
    ]));
    if (c().records.length === 0) {
      container.append(ui.emptyState('还没有咨询记录'));
      return;
    }
    const sorted = [...c().records].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    container.append(ui.el('div', { class: 'card' }, sorted.map((r) => ui.el('div', { class: 'row' }, [
      ui.el('div', { class: 'row-text' }, [
        ui.el('div', { text: `${r.date} · ${clientName(r.clientId)} · ${r.topic}` }),
        r.note ? ui.el('div', { class: 'text-muted', text: r.note }) : null,
      ]),
      r.duration ? ui.el('span', { class: 'text-muted', text: r.duration + ' 分钟' }) : null,
      ui.el('div', { class: 'row-actions' }, [
        ui.iconBtn('✏️', '编辑', () => editRecord(r)),
        ui.iconBtn('🗑️', '删除', async () => {
          if (await ui.confirmBox('删除这条记录？')) {
            dc.removeById(c().records, r.id);
            store.save(); redraw();
          }
        }),
      ]),
    ]))));
  }

  function editRecord(r) {
    ui.formModal({
      title: r ? '编辑咨询记录' : '添加咨询记录',
      fields: [
        { key: 'date', label: '日期', type: 'date', required: true, default: dc.todayStr() },
        { key: 'clientId', label: '客户', type: 'select', options: clientOptions() },
        { key: 'topic', label: '主题', required: true },
        { key: 'duration', label: '时长（分钟）', type: 'number', min: 0 },
        { key: 'note', label: '要点', type: 'textarea', rows: 2 },
      ],
      values: r ? { date: r.date, clientId: r.clientId || '', topic: r.topic, duration: r.duration || '', note: r.note || '' } : { date: dc.todayStr(), clientId: '', duration: '' },
      onSubmit: (v) => {
        const data = {
          date: v.date, clientId: v.clientId || null, topic: (v.topic || '').trim(),
          duration: v.duration === null || v.duration === '' ? null : Number(v.duration),
          note: (v.note || '').trim(),
        };
        if (r) Object.assign(r, data);
        else c().records.push({ id: dc.uid(), ...data });
        store.save(); redraw();
      },
    });
  }

  // ---------- 收入 ----------
  function renderIncomes() {
    const total = c().incomes.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const unpaid = c().incomes.filter((i) => i.status === 'unpaid').reduce((s, i) => s + (Number(i.amount) || 0), 0);
    container.append(ui.el('div', { class: 'toolbar' }, [
      ui.el('span', { class: 'text-muted', text: `共 ${c().incomes.length} 笔 · 合计 ¥${total} · 未收 ¥${unpaid}` }),
      ui.el('button', { class: 'btn btn-primary', text: '+ 添加收入', onclick: () => editIncome(null) }),
    ]));
    if (c().incomes.length === 0) {
      container.append(ui.emptyState('还没有收入记录'));
      return;
    }
    const sorted = [...c().incomes].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    container.append(ui.el('div', { class: 'card' }, sorted.map((i) => ui.el('div', { class: 'row' }, [
      ui.el('div', { class: 'row-text' }, [
        ui.el('div', { text: `${i.date} · ${clientName(i.clientId)} · ¥${i.amount}` }),
        i.note ? ui.el('div', { class: 'text-muted', text: i.note }) : null,
      ]),
      ui.el('button', {
        class: 'btn btn-sm ' + (i.status === 'paid' ? 'btn-ghost' : 'btn-primary'),
        text: i.status === 'paid' ? '✓ 已收' : '未收，点击标记已收',
        onclick: () => { i.status = i.status === 'paid' ? 'unpaid' : 'paid'; store.save(); redraw(); },
      }),
      ui.el('div', { class: 'row-actions' }, [
        ui.iconBtn('✏️', '编辑', () => editIncome(i)),
        ui.iconBtn('🗑️', '删除', async () => {
          if (await ui.confirmBox('删除这笔收入？')) {
            dc.removeById(c().incomes, i.id);
            store.save(); redraw();
          }
        }),
      ]),
    ]))));
  }

  function editIncome(i) {
    ui.formModal({
      title: i ? '编辑收入' : '添加收入',
      fields: [
        { key: 'date', label: '日期', type: 'date', required: true, default: dc.todayStr() },
        { key: 'clientId', label: '客户', type: 'select', options: clientOptions() },
        { key: 'amount', label: '金额（元）', type: 'number', min: 0, required: true },
        {
          key: 'status', label: '状态', type: 'select',
          options: [{ value: 'unpaid', label: '未收' }, { value: 'paid', label: '已收' }],
        },
        { key: 'note', label: '备注', type: 'textarea', rows: 2 },
      ],
      values: i ? { date: i.date, clientId: i.clientId || '', amount: i.amount, status: i.status, note: i.note || '' } : { date: dc.todayStr(), clientId: '', amount: '', status: 'unpaid' },
      onSubmit: (v) => {
        const data = {
          date: v.date, clientId: v.clientId || null, amount: Number(v.amount) || 0,
          status: v.status, note: (v.note || '').trim(),
        };
        if (i) Object.assign(i, data);
        else c().incomes.push({ id: dc.uid(), ...data });
        store.save(); redraw();
      },
    });
  }

  redraw();
}