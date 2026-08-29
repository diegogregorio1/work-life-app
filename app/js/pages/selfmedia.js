// 自媒体：平台、内容创作状态流、发布排期、灵感库、数据记录
import * as dc from '../data-core.js';
import * as store from '../store.js';
import * as ui from '../ui.js';
import { statsChartSVG, chartLegendHTML } from '../chart.js';

const TABS = [
  { key: 'contents', label: '内容创作' },
  { key: 'schedule', label: '发布排期' },
  { key: 'ideas', label: '灵感库' },
  { key: 'stats', label: '数据记录' },
];

const STATUS_FILTERS = [{ key: 'all', label: '全部' }, ...dc.CONTENT_STATUSES];

export function render(container) {
  const state = store.getState();
  let tab = 'contents';
  let filterStatus = 'all';

  function sm() { return state.selfmedia; }

  function platformName(pid) {
    const p = dc.byId(sm().platforms, pid);
    return p ? p.name : '未选平台';
  }

  function redraw() {
    container.innerHTML = '';
    container.append(ui.el('div', { class: 'tabs' }, TABS.map((t) => ui.el('button', {
      class: 'tab' + (tab === t.key ? ' active' : ''),
      text: t.label,
      onclick: () => { tab = t.key; redraw(); },
    }))));
    container.append(ui.el('div', { class: 'toolbar' }, [
      ui.el('span', { class: 'text-muted', text: `平台 ${sm().platforms.length} 个 · 内容 ${sm().contents.length} 篇 · 灵感 ${sm().ideas.length} 条` }),
      ui.el('button', { class: 'btn btn-ghost btn-sm', text: '⚙️ 平台管理', onclick: platformManager }),
    ]));
    if (tab === 'contents') renderContents();
    else if (tab === 'schedule') renderSchedule();
    else if (tab === 'ideas') renderIdeas();
    else renderStats();
  }

  // ---------- 平台管理 ----------
  function platformManager() {
    const overlay = ui.el('div', { class: 'modal-backdrop' });
    const body = ui.el('div', { class: 'modal' });
    body.append(ui.el('h3', { class: 'modal-title', text: '平台管理' }));
    const list = ui.el('div');
    const draw = () => {
      list.innerHTML = '';
      if (sm().platforms.length === 0) list.append(ui.emptyState('还没有平台，点下方「添加平台」'));
      else {
        sm().platforms.forEach((p) => list.append(ui.el('div', { class: 'row' }, [
          ui.el('span', { class: 'row-text', text: p.name + (p.account ? `（${p.account}）` : '') }),
          ui.el('span', { class: 'text-muted', text: p.note || '' }),
          ui.iconBtn('✏️', '编辑', () => editPlatform(p)),
          ui.iconBtn('🗑️', '删除', async () => {
            if (await ui.confirmBox(`删除平台「${p.name}」？相关内容的平台信息会保留为空。`)) {
              dc.removeById(sm().platforms, p.id);
              store.save(); draw(); redraw();
            }
          }),
        ])));
      }
    };
    const addBtn = ui.el('button', { class: 'btn btn-primary mt', text: '+ 添加平台', onclick: () => editPlatform(null) });
    draw();
    body.append(list, addBtn);
    overlay.append(body);
    document.body.append(overlay);
  }

  function editPlatform(p) {
    ui.formModal({
      title: p ? '编辑平台' : '添加平台',
      fields: [
        { key: 'name', label: '平台名称', required: true, placeholder: '如：公众号 / B站 / 小红书' },
        { key: 'account', label: '账号', placeholder: '账号名（可选）' },
        { key: 'note', label: '备注', type: 'textarea', rows: 2 },
      ],
      values: p ? { name: p.name, account: p.account || '', note: p.note || '' } : {},
      onSubmit: (v) => {
        if (p) Object.assign(p, { name: v.name.trim(), account: v.account.trim(), note: v.note.trim() });
        else sm().platforms.push({ id: dc.uid(), name: v.name.trim(), account: v.account.trim(), note: v.note.trim() });
        store.save();
        redraw();
      },
    });
  }

  // ---------- 内容创作 ----------
  function renderContents() {
    const toolbar = ui.el('div', { class: 'toolbar' }, [
      ui.el('button', { class: 'btn btn-primary', text: '+ 新建内容', onclick: () => editContent(null) }),
    ]);
    // 状态筛选
    const chips = ui.el('div', { class: 'kv mb' }, STATUS_FILTERS.map((f) => ui.el('button', {
      class: 'btn btn-sm' + (filterStatus === f.key ? ' btn-primary' : ' btn-ghost'),
      text: f.label,
      onclick: () => { filterStatus = f.key; redraw(); },
    })));
    container.append(toolbar, chips);
    let list = sm().contents;
    if (filterStatus !== 'all') list = list.filter((c) => c.status === filterStatus);
    if (list.length === 0) {
      container.append(ui.emptyState('这里还没有内容'));
      return;
    }
    const sorted = [...list].sort((a, b) => (a.publishDate || '9999').localeCompare(b.publishDate || '9999'));
    container.append(ui.el('div', { class: 'card' }, sorted.map((c) => ui.el('div', { class: 'row' }, [
      ui.el('div', { class: 'row-text' }, [
        ui.el('div', { text: c.title }),
        ui.el('div', { class: 'text-muted', text: `${platformName(c.platformId)}${c.publishDate ? ' · ' + c.publishDate : ''}` }),
      ]),
      ui.badge(dc.contentStatusLabel(c.status), statusBadgeCls(c.status)),
      c.status !== 'published'
        ? ui.el('button', { class: 'btn btn-sm btn-ghost', text: '推进 →', onclick: () => advance(c) })
        : null,
      ui.el('div', { class: 'row-actions' }, [
        ui.iconBtn('✏️', '编辑', () => editContent(c)),
        ui.iconBtn('🗑️', '删除', async () => {
          if (await ui.confirmBox(`删除内容「${c.title}」？`)) {
            dc.removeById(sm().contents, c.id);
            sm().publishStats = sm().publishStats.filter((s) => s.contentId !== c.id);
            store.save(); redraw();
          }
        }),
      ]),
    ]))));
  }

  function advance(c) {
    const next = dc.nextContentStatus(c.status);
    if (!next) return;
    c.status = next;
    store.save();
    ui.toast(`已推进到「${dc.contentStatusLabel(next)}」`, 'ok');
    redraw();
  }

  function editContent(c) {
    ui.formModal({
      title: c ? '编辑内容' : '新建内容',
      fields: [
        { key: 'title', label: '标题/内容', required: true, type: 'textarea', rows: 2 },
        {
          key: 'platformId', label: '所属平台', type: 'select',
          options: [{ value: '', label: '（未选平台）' }, ...sm().platforms.map((p) => ({ value: p.id, label: p.name }))],
        },
        { key: 'status', label: '状态', type: 'select', options: dc.CONTENT_STATUSES },
        { key: 'publishDate', label: '排期/发布日期', type: 'date' },
        { key: 'note', label: '备注', type: 'textarea', rows: 2 },
      ],
      values: c
        ? { title: c.title, platformId: c.platformId || '', status: c.status, publishDate: c.publishDate || '', note: c.note || '' }
        : { status: 'drafting' },
      onSubmit: (v) => {
        const data = {
          title: v.title.trim(),
          platformId: v.platformId || null,
          status: v.status,
          publishDate: v.publishDate || null,
          note: (v.note || '').trim(),
        };
        if (c) Object.assign(c, data);
        else sm().contents.push({ id: dc.uid(), ...data, createdAt: new Date().toISOString() });
        store.save();
        redraw();
      },
    });
  }

  // ---------- 发布排期 ----------
  function renderSchedule() {
    const withDate = sm().contents.filter((c) => c.publishDate).sort((a, b) => a.publishDate.localeCompare(b.publishDate));
    if (withDate.length === 0) {
      container.append(ui.emptyState('还没有排期，给内容设置发布日期后就会显示在这里'));
      return;
    }
    const today = dc.todayStr();
    for (const c of withDate) {
      const tag = c.publishDate === today ? ui.badge('今天', 'badge-warn')
        : c.publishDate < today ? ui.badge('已过', 'badge-neutral')
        : ui.badge('未来', 'badge-success');
      container.append(ui.el('div', { class: 'card mb' }, ui.el('div', { class: 'row' }, [
        ui.el('div', { class: 'row-text' }, [
          ui.el('div', { text: c.title }),
          ui.el('div', { class: 'text-muted', text: platformName(c.platformId) }),
        ]),
        tag,
        ui.badge(dc.contentStatusLabel(c.status), statusBadgeCls(c.status)),
        ui.el('span', { class: 'text-muted', text: c.publishDate }),
        ui.iconBtn('✏️', '编辑排期', () => editContent(c)),
      ])));
    }
  }

  // ---------- 灵感库 ----------
  function renderIdeas() {
    const input = ui.el('input', { class: 'input', placeholder: '灵感内容…' });
    input.style.flex = '1';
    const src = ui.el('input', { class: 'input', placeholder: '来源（可选）', style: 'max-width:140px' });
    const addBtn = ui.el('button', { class: 'btn btn-primary', text: '记下' });
    const addIdea = () => {
      const t = input.value.trim();
      if (!t) { ui.toast('先写点灵感', 'warn'); return; }
      sm().ideas.unshift({ id: dc.uid(), text: t, source: src.value.trim(), createdAt: new Date().toISOString() });
      input.value = ''; src.value = '';
      store.save(); redraw();
    };
    addBtn.addEventListener('click', addIdea);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') addIdea(); });
    container.append(ui.el('div', { class: 'card mb' }, ui.el('div', { class: 'kv' }, [input, src, addBtn])));
    if (sm().ideas.length === 0) {
      container.append(ui.emptyState('灵感库是空的'));
      return;
    }
    container.append(ui.el('div', { class: 'card' }, sm().ideas.map((i) => ui.el('div', { class: 'row' }, [
      ui.el('span', { class: 'row-text', text: i.text }),
      i.source ? ui.el('span', { class: 'text-muted', text: '来源：' + i.source }) : null,
      ui.iconBtn('🗑️', '删除', async () => {
        if (await ui.confirmBox('删除这条灵感？')) {
          dc.removeById(sm().ideas, i.id);
          store.save(); redraw();
        }
      }),
    ]))));
  }

  // ---------- 数据记录 ----------
  function renderStats() {
    const toolbar = ui.el('div', { class: 'toolbar' }, [
      ui.el('span', { class: 'text-muted', text: `已记录 ${sm().publishStats.length} 篇数据` }),
      ui.el('button', { class: 'btn btn-primary', text: '+ 添加记录', onclick: editStat }),
    ]);
    container.append(toolbar);

    const chartData = dc.buildStatsChartData(state);
    if (chartData.length > 0) {
      const wrap = ui.el('div', { class: 'chart-wrap card mb' });
      wrap.append(ui.el('h3', { class: 'section-title', text: '发布数据趋势' }));
      wrap.append(ui.el('div', { class: 'chart-legend', html: chartLegendHTML() }));
      wrap.append(ui.el('div', { html: statsChartSVG(chartData) }));
      container.append(wrap);
    }

    if (sm().publishStats.length === 0) {
      container.append(ui.emptyState('发布后在这里记录阅读/点赞/评论数据'));
      return;
    }
    const sorted = [...sm().publishStats].sort((a, b) => (b.publishDate || '').localeCompare(a.publishDate || ''));
    container.append(ui.el('div', { class: 'card' }, sorted.map((s) => ui.el('div', { class: 'row' }, [
      ui.el('div', { class: 'row-text' }, [
        ui.el('div', { text: statTitle(s) }),
        ui.el('div', { class: 'text-muted', text: s.publishDate || '' }),
      ]),
      ui.el('span', { class: 'text-muted', text: `阅读 ${s.views} · 点赞 ${s.likes} · 评论 ${s.comments}` }),
      ui.el('div', { class: 'row-actions' }, [
        ui.iconBtn('✏️', '编辑', () => editStat(s)),
        ui.iconBtn('🗑️', '删除', async () => {
          if (await ui.confirmBox('删除这条数据记录？')) {
            dc.removeById(sm().publishStats, s.id);
            store.save(); redraw();
          }
        }),
      ]),
    ]))));
  }

  function statTitle(s) {
    const c = dc.byId(sm().contents, s.contentId);
    return c ? c.title : '（已删除的内容）';
  }

  function editStat(s) {
    ui.formModal({
      title: s ? '编辑数据记录' : '添加数据记录',
      fields: [
        {
          key: 'contentId', label: '关联内容', type: 'select', required: true,
          options: sm().contents.map((c) => ({ value: c.id, label: c.title })),
        },
        { key: 'publishDate', label: '发布日期', type: 'date' },
        { key: 'views', label: '阅读', type: 'number', min: 0, default: 0 },
        { key: 'likes', label: '点赞', type: 'number', min: 0, default: 0 },
        { key: 'comments', label: '评论', type: 'number', min: 0, default: 0 },
      ],
      values: s ? { contentId: s.contentId, publishDate: s.publishDate || '', views: s.views, likes: s.likes, comments: s.comments } : { views: 0, likes: 0, comments: 0 },
      onSubmit: (v) => {
        const data = {
          contentId: v.contentId,
          publishDate: v.publishDate || null,
          views: Number(v.views) || 0,
          likes: Number(v.likes) || 0,
          comments: Number(v.comments) || 0,
        };
        if (s) Object.assign(s, data);
        else sm().publishStats.push({ id: dc.uid(), ...data });
        store.save(); redraw();
      },
    });
  }

  function statusBadgeCls(status) {
    return { drafting: 'badge-neutral', writing: 'badge-warn', scheduled: 'badge-neutral', published: 'badge-success' }[status] || 'badge-neutral';
  }

  redraw();
}