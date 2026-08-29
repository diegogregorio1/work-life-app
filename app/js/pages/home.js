// 首页总览：问候、今日计划摘要、快速备忘、模块摘要
import * as dc from '../data-core.js';
import * as store from '../store.js';
import * as ui from '../ui.js';

export function summaryOf(id, s) {
  switch (id) {
    case 'selfmedia':
      if (s.toPublishToday > 0) return { num: s.toPublishToday, text: '篇今天待发' };
      if (s.publishedTotal > 0) return { num: s.total, text: `共 ${s.total} 篇 · 已发布 ${s.publishedTotal}` };
      if (s.total > 0) return { num: s.total, text: '篇进行中' };
      return { num: 0, text: '还没有内容' };
    case 'dev':
      if (s.active > 0) return { num: s.active, text: '个项目进行中' };
      if (s.projects > 0) return { num: s.projects, text: '个项目' };
      return { num: 0, text: '暂无项目' };
    case 'consult':
      if (s.appointmentsToday > 0) return { num: s.appointmentsToday, text: `今天 ${s.appointmentsToday} 个预约` };
      if (s.unpaid > 0) return { num: s.unpaid, text: `有 ${s.unpaid} 笔未收款` };
      if (s.clients > 0) return { num: s.clients, text: '位客户' };
      return { num: 0, text: '暂无客户' };
    case 'fitness':
      if (s.todayWorkout || s.weekCount > 0) {
        return { num: s.weekCount, text: `本周已练 ${s.weekCount}/${s.weeklyGoal}` + (s.todayWorkout ? ' · 今天已练' : '') };
      }
      if (s.total > 0) return { num: s.total, text: '次训练记录' };
      return { num: 0, text: `本周已练 0/${s.weeklyGoal}` };
    case 'diet':
      if (s.mealsRecorded > 0) return { num: s.mealsRecorded, text: '餐已记录（共 4 餐）' };
      if (s.recordedDays > 0) return { num: s.recordedDays, text: '天有饮食记录' };
      return { num: 0, text: '今天还没记录饮食' };
    case 'gaming':
      if (s.minutesToday > 0) return { num: s.minutesToday, text: '分钟（今天）' };
      if (s.playing > 0) return { num: s.playing, text: '款在玩' };
      if (s.totalSessions > 0) return { num: s.totalSessions, text: '条游戏时间记录' };
      return { num: 0, text: '今天还没玩' };
    default:
      return { num: 0, text: '' };
  }
}

export function buildHomeSummaries(state, date) {
  const allowed = (state.settings.homeModules || []).filter(Boolean);
  const list = allowed.length > 0 ? allowed : dc.DEFAULT_HOME_MODULES;
  const defs = [
    { id: 'selfmedia', title: '自媒体', href: '#/selfmedia', s: dc.selfmediaSummary(state, date) },
    { id: 'dev', title: '开发工作', href: '#/dev', s: dc.devSummary(state) },
    { id: 'consult', title: '咨询工作', href: '#/consult', s: dc.consultSummary(state, date) },
    { id: 'fitness', title: '健身计划', href: '#/fitness', s: dc.fitnessSummary(state, date) },
    { id: 'diet', title: '饮食计划', href: '#/diet', s: dc.dietSummary(state, date) },
    { id: 'gaming', title: '游戏娱乐', href: '#/gaming', s: dc.gamingSummary(state, date) },
  ];
  return defs.filter((d) => list.includes(d.id)).map((d) => ({ id: d.id, title: d.title, href: d.href, ...summaryOf(d.id, d.s) }));
}

export function render(container) {
  const state = store.getState();
  const date = dc.todayStr();

  function redraw() {
    container.innerHTML = '';
    const hour = new Date().getHours();
    const greet =
      hour < 5 ? '夜深了' : hour < 9 ? '早上好' : hour < 12 ? '上午好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
    container.append(ui.el('p', { class: 'text-muted', text: `${greet}，今天是 ${date}` }));

    // 今日计划卡片
    const plan = dc.todayPlanSummary(state, date);
    const planCard = ui.el('div', { class: 'card mb' });
    planCard.append(ui.el('div', { class: 'toolbar' }, [
      ui.el('h3', { class: 'section-title', text: '今日计划' }),
      ui.el('button', { class: 'btn btn-ghost btn-sm', text: '去安排 →', onclick: () => { location.hash = '#/today'; } }),
    ]));
    if (plan.total > 0) {
      planCard.append(ui.progressBar(plan.rate));
      planCard.append(ui.el('p', { class: 'text-muted', text: `${plan.done}/${plan.total} 已完成（${plan.rate}%）` }));
    }
    const items = dc.planItems(state, date).slice(0, 5);
    if (items.length === 0) planCard.append(ui.emptyState('今天还没有安排'));
    else {
      planCard.append(ui.el('div', {}, items.map((it) => ui.el('div', { class: 'row' }, [
        ui.el('span', { class: 'row-text' + (it.done ? ' done' : ''), text: it.text }),
        it.important ? ui.badge('重要', 'badge-danger') : null,
      ]))));
    }
    container.append(planCard);

    // 快速备忘卡片
    const memoCard = ui.el('div', { class: 'card mb' });
    memoCard.append(ui.el('h3', { class: 'section-title', text: '快速备忘' }));
    const input = ui.el('input', { class: 'input', placeholder: '随手记一条…' });
    input.style.flex = '1';
    const addBtn = ui.el('button', { class: 'btn btn-primary', text: '记下' });
    memoCard.append(ui.el('div', { class: 'kv mb' }, [input, addBtn]));
    const listWrap = ui.el('div');
    const drawMemos = () => {
      listWrap.innerHTML = '';
      const memos = state.memos.slice(0, 8);
      if (memos.length === 0) listWrap.append(ui.emptyState('还没有备忘'));
      else {
        memos.forEach((m) => listWrap.append(ui.el('div', { class: 'row' }, [
          ui.el('input', {
            class: 'checkbox-lg', type: 'checkbox', checked: m.done,
            onclick: () => { dc.toggleMemo(state, m.id); store.save(); drawMemos(); },
          }),
          ui.el('span', { class: 'row-text' + (m.done ? ' done' : ''), text: m.text }),
          ui.iconBtn('🗑️', '删除', async () => {
            if (await ui.confirmBox('删除这条备忘？')) { dc.removeMemo(state, m.id); store.save(); drawMemos(); }
          }),
        ])));
      }
    };
    const addMemo = () => {
      const m = dc.addMemo(state, input.value);
      if (!m) { ui.toast('先写点什么吧', 'warn'); return; }
      input.value = '';
      store.save();
      drawMemos();
    };
    addBtn.addEventListener('click', addMemo);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') addMemo(); });
    memoCard.append(listWrap);
    drawMemos();
    container.append(memoCard);

    // 模块摘要
    const summaries = buildHomeSummaries(state, date);
    if (summaries.length > 0) {
      container.append(ui.el('h3', { class: 'section-title', text: '模块摘要' }));
      container.append(ui.el('div', { class: 'summary-grid' }, summaries.map((s) => ui.el('a', { class: 'card summary-card', href: s.href }, [
        ui.el('div', { class: 'label', text: s.title }),
        ui.el('div', { class: 'num', text: s.num }),
        ui.el('div', { class: 'text-muted', text: s.text }),
      ]))));
    }
  }

  redraw();
}