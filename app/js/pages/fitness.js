// 健身计划：今日训练 / 训练模板 / 训练历史 / 身体数据 + 周目标
import * as dc from '../data-core.js';
import * as store from '../store.js';
import * as ui from '../ui.js';

const TABS = [
  { key: 'today', label: '今日训练' },
  { key: 'templates', label: '训练模板' },
  { key: 'history', label: '训练历史' },
  { key: 'body', label: '身体数据' },
];

export function render(container) {
  const state = store.getState();
  let tab = 'today';
  let selectedTemplateId = null;

  function f() { return state.fitness; }
  function templateName(id) {
    const t = dc.byId(f().templates, id);
    return t ? t.name : '（已删除模板）';
  }

  function redraw() {
    container.innerHTML = '';
    container.append(ui.el('div', { class: 'tabs' }, TABS.map((t) => ui.el('button', {
      class: 'tab' + (tab === t.key ? ' active' : ''),
      text: t.label,
      onclick: () => { tab = t.key; selectedTemplateId = null; redraw(); },
    }))));
    if (tab === 'today') renderToday();
    else if (tab === 'templates') renderTemplates();
    else if (tab === 'history') renderHistory();
    else renderBody();
  }

  // ---------- 今日训练 ----------
  function renderToday() {
    const today = dc.todayStr();
    const week = dc.fitnessSummary(state, today);
    const goalCard = ui.el('div', { class: 'card mb' });
    goalCard.append(ui.el('div', { class: 'toolbar' }, [
      ui.el('b', { text: `本周目标：${week.weekCount}/${week.weeklyGoal} 次` }),
      ui.el('button', { class: 'btn btn-ghost btn-sm', text: '修改目标', onclick: editGoal }),
    ]));
    goalCard.append(ui.progressBar(week.weeklyGoal ? Math.round((week.weekCount / week.weeklyGoal) * 100) : 0));
    if (week.goalMet) goalCard.append(ui.el('p', { class: 'text-muted', text: '🎉 本周目标已达成' }));
    container.append(goalCard);

    const todayWorkouts = dc.workoutsOn(state, today);
    if (todayWorkouts.length > 0) {
      container.append(ui.el('h3', { class: 'section-title', text: '今日已打卡' }));
      container.append(ui.el('div', { class: 'card mb' }, todayWorkouts.map((w) => ui.el('div', { class: 'row' }, [
        ui.el('span', { class: 'row-text', text: templateName(w.templateId) }),
        ui.el('span', { class: 'text-muted', text: w.exercises.map((e) => `${e.name} ${e.weight || 0}kg×${e.reps || 0}×${e.sets || 0}组`).join('；') }),
        ui.iconBtn('🗑️', '删除打卡', async () => {
          if (await ui.confirmBox('删除今天的这次打卡？')) {
            dc.removeById(f().workouts, w.id);
            store.save(); redraw();
          }
        }),
      ]))));
    }

    container.append(ui.el('h3', { class: 'section-title', text: '开始今日训练' }));
    if (f().templates.length === 0) {
      container.append(ui.emptyState('还没有训练模板，先到「训练模板」建一个'));
      return;
    }
    if (!selectedTemplateId) {
      container.append(ui.el('div', { class: 'grid grid-3' }, f().templates.map((t) => ui.el('button', {
        class: 'btn card',
        text: t.name,
        style: 'text-align:left;font-size:14px',
        onclick: () => { selectedTemplateId = t.id; redraw(); },
      }))));
      return;
    }

    const tpl = dc.byId(f().templates, selectedTemplateId);
    if (!tpl) { selectedTemplateId = null; redraw(); return; }
    container.append(ui.el('div', { class: 'toolbar' }, [
      ui.el('b', { text: '训练：' + tpl.name }),
      ui.el('button', { class: 'btn btn-ghost btn-sm', text: '← 换一个模板', onclick: () => { selectedTemplateId = null; redraw(); } }),
    ]));
    const form = ui.el('div', { class: 'card mb' });
    const rows = tpl.exercises.map((e) => {
      const weight = ui.el('input', { class: 'input', type: 'number', min: 0, placeholder: '重量kg', style: 'max-width:90px' });
      const sets = ui.el('input', { class: 'input', type: 'number', min: 1, value: e.sets, style: 'max-width:70px' });
      const reps = ui.el('input', { class: 'input', type: 'number', min: 1, value: e.reps, style: 'max-width:70px' });
      const done = ui.el('input', { class: 'checkbox-lg', type: 'checkbox', checked: true });
      form.append(ui.el('div', { class: 'row' }, [
        ui.el('span', { class: 'row-text', text: e.name }),
        weight, ui.el('span', { class: 'text-muted', text: 'kg ×' }), sets, ui.el('span', { class: 'text-muted', text: '次 ×' }), reps, ui.el('span', { class: 'text-muted', text: '组' }),
        done,
      ]));
      return { weight, sets, reps, done, name: e.name };
    });
    container.append(form);
    container.append(ui.el('button', {
      class: 'btn btn-primary',
      text: '✓ 完成打卡',
      onclick: () => {
        const exercises = rows.map((r) => ({
          name: r.name,
          weight: Number(r.weight.value) || 0,
          sets: Number(r.sets.value) || 1,
          reps: Number(r.reps.value) || 1,
          done: r.done.checked,
        }));
        if (!exercises.some((e) => e.done)) {
          ui.toast('至少勾选一个完成的动作', 'warn');
          return;
        }
        dc.addWorkout(state, {
          id: dc.uid(), date: today, templateId: tpl.id,
          exercises, createdAt: new Date().toISOString(),
        });
        store.save();
        selectedTemplateId = null;
        ui.toast('已记录今日训练', 'ok');
        redraw();
      },
    }));
  }

  function editGoal() {
    ui.formModal({
      title: '每周训练目标',
      fields: [{ key: 'goal', label: '每周训练次数', type: 'number', min: 0, required: true }],
      values: { goal: f().weeklyGoal },
      onSubmit: (v) => {
        f().weeklyGoal = Number(v.goal) || 0;
        store.save(); redraw();
      },
    });
  }

  // ---------- 训练模板 ----------
  function renderTemplates() {
    container.append(ui.el('div', { class: 'toolbar' }, [
      ui.el('span', { class: 'text-muted', text: `共 ${f().templates.length} 个模板` }),
      ui.el('button', { class: 'btn btn-primary', text: '+ 新建模板', onclick: () => editTemplate(null) }),
    ]));
    if (f().templates.length === 0) {
      container.append(ui.emptyState('还没有训练模板，点「+ 新建模板」创建'));
      return;
    }
    container.append(ui.el('div', { class: 'grid grid-2' }, f().templates.map((t) => {
      const card = ui.el('div', { class: 'card' });
      card.append(ui.el('div', { class: 'toolbar' }, [
        ui.el('b', { text: t.name }),
        ui.el('div', { class: 'kv' }, [
          ui.iconBtn('✏️', '编辑', () => editTemplate(t)),
          ui.iconBtn('🗑️', '删除', async () => {
            if (await ui.confirmBox(`删除模板「${t.name}」？`)) {
              dc.removeById(f().templates, t.id);
              store.save(); redraw();
            }
          }),
        ]),
      ]));
      card.append(ui.el('div', { class: 'text-muted', text: t.exercises.map((e) => `${e.name} ${e.sets}组×${e.reps}次`).join('；') }));
      return card;
    })));
  }

  function editTemplate(t) {
    const overlay = ui.el('div', { class: 'modal-backdrop' });
    const body = ui.el('div', { class: 'modal' });
    body.append(ui.el('h3', { class: 'modal-title', text: t ? '编辑模板' : '新建模板' }));
    const nameInput = ui.el('input', { class: 'input', value: t ? t.name : '', placeholder: '模板名，如：胸 / 背 / 腿 / 休息日' });
    const list = ui.el('div');
    const exercises = (t && t.exercises.length ? t.exercises : [{ id: dc.uid(), name: '', sets: 4, reps: 10 }]).map((e) => ({ ...e }));
    const draw = () => {
      list.innerHTML = '';
      exercises.forEach((e, idx) => {
        const name = ui.el('input', { class: 'input', value: e.name, placeholder: '动作名' });
        const sets = ui.el('input', { class: 'input', type: 'number', min: 1, value: e.sets, style: 'max-width:70px' });
        const reps = ui.el('input', { class: 'input', type: 'number', min: 1, value: e.reps, style: 'max-width:70px' });
        name.oninput = () => { e.name = name.value; };
        sets.oninput = () => { e.sets = Number(sets.value) || 1; };
        reps.oninput = () => { e.reps = Number(reps.value) || 1; };
        list.append(ui.el('div', { class: 'row' }, [
          name,
          ui.el('span', { class: 'text-muted', text: '组' }), sets,
          ui.el('span', { class: 'text-muted', text: '次' }), reps,
          ui.iconBtn('🗑️', '删除动作', () => { exercises.splice(idx, 1); draw(); }),
        ]));
      });
      if (exercises.length === 0) list.append(ui.emptyState('还没有动作'));
    };
    draw();
    const addEx = ui.el('button', {
      class: 'btn btn-ghost btn-sm', text: '+ 添加动作',
      onclick: () => { exercises.push({ id: dc.uid(), name: '', sets: 4, reps: 10 }); draw(); },
    });
    const actions = ui.el('div', { class: 'modal-actions' }, [
      ui.el('button', { class: 'btn btn-ghost', text: '取消', onclick: () => overlay.remove() }),
      ui.el('button', {
        class: 'btn btn-primary', text: '保存',
        onclick: () => {
          const name = nameInput.value.trim();
          const clean = exercises.filter((e) => e.name.trim() && (Number(e.sets) || 0) > 0 && (Number(e.reps) || 0) > 0);
          if (!name) { ui.toast('请填写模板名', 'warn'); return; }
          if (clean.length === 0) { ui.toast('至少添加一个完整动作', 'warn'); return; }
          if (t) {
            t.name = name;
            t.exercises = clean.map((e) => ({ id: e.id, name: e.name.trim(), sets: Number(e.sets), reps: Number(e.reps) }));
          } else {
            f().templates.push({
              id: dc.uid(), name,
              exercises: clean.map((e) => ({ id: e.id, name: e.name.trim(), sets: Number(e.sets), reps: Number(e.reps) })),
            });
          }
          overlay.remove();
          store.save(); redraw();
        },
      }),
    ]);
    body.append(nameInput, list, addEx, actions);
    overlay.append(body);
    document.body.append(overlay);
  }

  // ---------- 训练历史 ----------
  function renderHistory() {
    if (f().workouts.length === 0) {
      container.append(ui.emptyState('还没有训练记录'));
      return;
    }
    const sorted = [...f().workouts].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    container.append(ui.el('div', { class: 'card' }, sorted.map((w) => ui.el('div', { class: 'row' }, [
      ui.el('div', { class: 'row-text' }, [
        ui.el('div', { text: `${w.date} · ${templateName(w.templateId)}` }),
        ui.el('div', { class: 'text-muted', text: w.exercises.map((e) => `${e.name} ${e.weight || 0}kg×${e.reps || 0}×${e.sets || 0}组`).join('；') }),
      ]),
      ui.iconBtn('🗑️', '删除', async () => {
        if (await ui.confirmBox('删除这条训练记录？')) {
          dc.removeById(f().workouts, w.id);
          store.save(); redraw();
        }
      }),
    ]))));
  }

  // ---------- 身体数据 ----------
  function renderBody() {
    const latest = dc.bodyLatest(state);
    const series = dc.bodySorted(state);
    container.append(ui.el('div', { class: 'toolbar' }, [
      ui.el('span', {
        class: 'text-muted',
        text: latest ? `最新体重 ${latest.weight}kg（${latest.date}）${series[1] ? ' · 较上次 ' + (latest.weight - series[1].weight >= 0 ? '+' : '') + (latest.weight - series[1].weight).toFixed(1) + 'kg' : ''}` : '还没有体重记录',
      }),
      ui.el('button', { class: 'btn btn-primary', text: '+ 记录体重', onclick: () => editWeight(null) }),
    ]));
    if (series.length === 0) {
      container.append(ui.emptyState('记录体重后，这里会显示历史变化'));
      return;
    }
    container.append(ui.el('div', { class: 'card' }, series.map((m) => ui.el('div', { class: 'row' }, [
      ui.el('span', { class: 'row-text', text: m.date }),
      ui.el('b', { text: m.weight + ' kg' }),
      ui.el('div', { class: 'row-actions' }, [
        ui.iconBtn('✏️', '编辑', () => editWeight(m)),
        ui.iconBtn('🗑️', '删除', async () => {
          if (await ui.confirmBox('删除这条体重记录？')) {
            dc.removeById(f().bodyMetrics, m.id);
            store.save(); redraw();
          }
        }),
      ]),
    ]))));
  }

  function editWeight(m) {
    ui.formModal({
      title: m ? '编辑体重' : '记录体重',
      fields: [
        { key: 'date', label: '日期', type: 'date', required: true, default: dc.todayStr() },
        { key: 'weight', label: '体重（kg）', type: 'number', step: '0.1', min: 0, required: true },
      ],
      values: m ? { date: m.date, weight: m.weight } : { date: dc.todayStr() },
      onSubmit: (v) => {
        const data = { date: v.date, weight: Number(v.weight) };
        if (m) Object.assign(m, data);
        else f().bodyMetrics.push({ id: dc.uid(), ...data });
        store.save(); redraw();
      },
    });
  }

  redraw();
}