// 开发工作：项目列表 → 项目详情（任务 + 开发日志）
import * as dc from '../data-core.js';
import * as store from '../store.js';
import * as ui from '../ui.js';

export function render(container, ctx) {
  const state = store.getState();

  function redraw() {
    container.innerHTML = '';
    const pid = ctx.param;
    const project = pid ? dc.byId(state.dev.projects, pid) : null;
    if (pid && !project) {
      container.append(ui.el('p', { class: 'text-muted', text: '项目不存在或已删除。' }));
      container.append(ui.el('a', { class: 'btn btn-ghost', href: '#/dev', text: '← 返回项目列表' }));
      return;
    }
    if (project) renderDetail(project);
    else renderList();
  }

  // ---------- 项目列表 ----------
  function renderList() {
    const toolbar = ui.el('div', { class: 'toolbar' }, [
      ui.el('span', { class: 'text-muted', text: `共 ${state.dev.projects.length} 个项目` }),
      ui.el('button', { class: 'btn btn-primary', text: '+ 新建项目', onclick: () => editProject(null) }),
    ]);
    container.append(toolbar);
    if (state.dev.projects.length === 0) {
      container.append(ui.emptyState('还没有项目，点「+ 新建项目」开始'));
      return;
    }
    container.append(ui.el('div', { class: 'grid grid-2' }, state.dev.projects.map((p) => {
      const stats = dc.projectTaskStats(p);
      const card = ui.el('div', { class: 'card' });
      card.append(ui.el('a', { href: '#/dev/' + p.id, style: 'text-decoration:none;color:inherit' }, [
        ui.el('div', { class: 'toolbar' }, [
          ui.el('b', { text: p.name }),
          ui.badge(dc.statusLabel(dc.PROJECT_STATUSES, p.status), projectBadgeCls(p.status)),
        ]),
        p.stack ? ui.el('div', { class: 'text-muted', text: p.stack }) : null,
        ui.el('div', { class: 'kv mt' }, [
          ui.progressBar(stats.total ? Math.round((stats.done / stats.total) * 100) : 0),
          ui.el('span', { class: 'text-muted', text: `任务 ${stats.done}/${stats.total}` }),
        ]),
      ]));
      card.append(ui.el('div', { class: 'kv mt' }, [
        ui.iconBtn('✏️', '编辑', () => editProject(p)),
        ui.iconBtn('🗑️', '删除', async () => {
          if (await ui.confirmBox(`删除项目「${p.name}」？项目下任务和日志会一并删除。`)) {
            dc.removeById(state.dev.projects, p.id);
            store.save();
            redraw();
          }
        }),
      ]));
      return card;
    })));
  }

  function editProject(p) {
    ui.formModal({
      title: p ? '编辑项目' : '新建项目',
      fields: [
        { key: 'name', label: '项目名称', required: true, placeholder: '如：个人网站' },
        { key: 'stack', label: '技术栈', placeholder: '如：Node.js + 原生前端' },
        { key: 'status', label: '状态', type: 'select', options: dc.PROJECT_STATUSES },
        { key: 'note', label: '备注', type: 'textarea', rows: 2 },
      ],
      values: p ? { name: p.name, stack: p.stack || '', status: p.status, note: p.note || '' } : { status: 'active' },
      onSubmit: (v) => {
        const data = { name: v.name.trim(), stack: (v.stack || '').trim(), status: v.status, note: (v.note || '').trim() };
        if (p) Object.assign(p, data);
        else state.dev.projects.push({ id: dc.uid(), tasks: [], logs: [], ...data });
        store.save();
        redraw();
      },
    });
  }

  // ---------- 项目详情 ----------
  function renderDetail(p) {
    container.append(ui.el('div', { class: 'toolbar' }, [
      ui.el('a', { class: 'btn btn-ghost btn-sm', href: '#/dev', text: '← 返回列表' }),
      ui.el('div', { class: 'kv' }, [
        ui.iconBtn('✏️', '编辑项目', () => editProject(p)),
        ui.iconBtn('🗑️', '删除项目', async () => {
          if (await ui.confirmBox(`删除项目「${p.name}」？`)) {
            dc.removeById(state.dev.projects, p.id);
            store.save();
            location.hash = '#/dev';
            redraw();
          }
        }),
      ]),
    ]));

    const info = ui.el('div', { class: 'card mb' });
    info.append(ui.el('div', { class: 'toolbar' }, [
      ui.el('h3', { class: 'section-title', text: p.name }),
      ui.badge(dc.statusLabel(dc.PROJECT_STATUSES, p.status), projectBadgeCls(p.status)),
    ]));
    if (p.stack) info.append(ui.el('p', { class: 'text-muted', text: '技术栈：' + p.stack }));
    if (p.note) info.append(ui.el('p', { text: p.note }));
    container.append(info);

    // 任务
    const tasks = Array.isArray(p.tasks) ? p.tasks : [];
    container.append(ui.el('div', { class: 'toolbar' }, [
      ui.el('h3', { class: 'section-title', text: '任务' }),
      ui.el('button', { class: 'btn btn-primary btn-sm', text: '+ 添加任务', onclick: () => editTask(null) }),
    ]));
    if (tasks.length === 0) container.append(ui.emptyState('还没有任务'));
    else {
      container.append(ui.el('div', { class: 'card mb' }, tasks.map((t) => ui.el('div', { class: 'row' }, [
        ui.el('input', {
          class: 'checkbox-lg', type: 'checkbox', checked: t.status === 'done',
          onclick: () => { t.status = t.status === 'done' ? 'todo' : 'done'; store.save(); redraw(); },
        }),
        ui.el('span', { class: 'row-text' + (t.status === 'done' ? ' done' : ''), text: t.text }),
        t.priority === 'high' ? ui.badge('重要', 'badge-danger') : null,
        ui.badge(dc.statusLabel(dc.TASK_STATUSES, t.status), taskBadgeCls(t.status)),
        ui.el('div', { class: 'row-actions' }, [
          ui.iconBtn('✏️', '编辑', () => editTask(t)),
          ui.iconBtn('🗑️', '删除', async () => {
            if (await ui.confirmBox('删除这个任务？')) {
              dc.removeById(p.tasks, t.id);
              store.save(); redraw();
            }
          }),
        ]),
      ]))));
    }

    // 日志
    container.append(ui.el('div', { class: 'toolbar' }, [
      ui.el('h3', { class: 'section-title', text: '开发日志' }),
      ui.el('button', { class: 'btn btn-primary btn-sm', text: '+ 写日志', onclick: addLog }),
    ]));
    const logs = [...(p.logs || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if (logs.length === 0) container.append(ui.emptyState('还没有日志'));
    else {
      container.append(ui.el('div', { class: 'card' }, logs.map((l) => ui.el('div', { class: 'row' }, [
        ui.el('span', { class: 'badge badge-neutral', text: l.date }),
        ui.el('span', { class: 'row-text', text: l.text }),
        ui.iconBtn('🗑️', '删除', async () => {
          if (await ui.confirmBox('删除这条日志？')) {
            dc.removeById(p.logs, l.id);
            store.save(); redraw();
          }
        }),
      ]))));
    }
  }

  function editTask(t) {
    ui.formModal({
      title: t ? '编辑任务' : '添加任务',
      fields: [
        { key: 'text', label: '任务内容', required: true },
        { key: 'status', label: '状态', type: 'select', options: dc.TASK_STATUSES },
        {
          key: 'priority', label: '优先级', type: 'select',
          options: [{ value: 'normal', label: '普通' }, { value: 'high', label: '重要' }],
        },
      ],
      values: t ? { text: t.text, status: t.status, priority: t.priority || 'normal' } : { status: 'todo', priority: 'normal' },
      onSubmit: (v) => {
        const data = { text: v.text.trim(), status: v.status, priority: v.priority };
        if (t) Object.assign(t, data);
        else {
          if (!p.tasks) p.tasks = [];
          p.tasks.push({ id: dc.uid(), ...data });
        }
        store.save(); redraw();
      },
    });
  }

  function addLog() {
    ui.formModal({
      title: '写开发日志',
      fields: [
        { key: 'date', label: '日期', type: 'date', required: true, default: dc.todayStr() },
        { key: 'text', label: '今天做了什么', type: 'textarea', rows: 3, required: true },
      ],
      values: { date: dc.todayStr() },
      onSubmit: (v) => {
        if (!p.logs) p.logs = [];
        p.logs.push({ id: dc.uid(), date: v.date, text: v.text.trim(), createdAt: new Date().toISOString() });
        store.save(); redraw();
      },
    });
  }

  function projectBadgeCls(status) {
    return { active: 'badge-success', paused: 'badge-warn', done: 'badge-neutral' }[status] || 'badge-neutral';
  }
  function taskBadgeCls(status) {
    return { todo: 'badge-neutral', doing: 'badge-warn', done: 'badge-success' }[status] || 'badge-neutral';
  }

  redraw();
}