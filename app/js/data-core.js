// 纯数据逻辑层：浏览器与 Node 测试共用，不依赖 DOM / fetch
// 所有函数都是纯函数式操作 state（直接修改传入对象），保证单份数据源

export function uid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

// ---------- 日期工具 ----------

export function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayStr() {
  return toDateStr(new Date());
}

export function parseDateStr(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(dateStr, n) {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function weekStartDate(dateStr, weekStart = 1) {
  const d = parseDateStr(dateStr);
  const diff = (d.getDay() - weekStart + 7) % 7;
  d.setDate(d.getDate() - diff);
  return toDateStr(d);
}

export function todayTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ---------- 默认结构与校验 ----------

export const DEFAULT_HOME_MODULES = ['selfmedia', 'dev', 'consult', 'fitness', 'diet', 'gaming'];

export function defaultData() {
  return {
    version: 1,
    settings: {
      theme: 'light',
      weekStart: 1,
      homeModules: [...DEFAULT_HOME_MODULES],
    },
    memos: [],
    plan: {},
    selfmedia: { platforms: [], contents: [], ideas: [], publishStats: [] },
    dev: { projects: [] },
    consult: { clients: [], appointments: [], records: [], incomes: [] },
    fitness: { weeklyGoal: 3, templates: [], workouts: [], bodyMetrics: [] },
    diet: { days: {}, templates: [] },
    gaming: { library: [], sessions: [], wishlist: [] },
  };
}

// ---------- 旧数据枚举迁移（中文值 -> 英文键，幂等） ----------

const SLOT_MAP = { 上午: 'morning', 下午: 'afternoon', 晚上: 'evening' };
const CONTENT_STATUS_MAP = { 构思中: 'drafting', 撰写中: 'writing', 待发布: 'scheduled', 已发布: 'published' };
const PROJECT_STATUS_MAP = { 进行中: 'active', 暂停: 'paused', 已完成: 'done' };
const TASK_STATUS_MAP = { 待办: 'todo', 进行中: 'doing', 已完成: 'done' };
const PRIORITY_MAP = { 普通: 'normal', 重要: 'high' };
const INCOME_STATUS_MAP = { 未收: 'unpaid', 已收: 'paid' };
const GAME_STATUS_MAP = { 想玩: 'want', 在玩: 'playing', 通关: 'done', 弃坑: 'dropped' };
const WISH_PRIORITY_MAP = { 普通: 'normal', 高: 'high' };

function normEnum(v, map) {
  return typeof v === 'string' && map[v] ? map[v] : v;
}

export function normalizeEnums(data) {
  if (!data || typeof data !== 'object') return data;
  const plan = data.plan || {};
  for (const date of Object.keys(plan)) {
    for (const it of plan[date] || []) if (it) it.slot = normEnum(it.slot, SLOT_MAP);
  }
  const sm = data.selfmedia || {};
  for (const c of sm.contents || []) if (c) c.status = normEnum(c.status, CONTENT_STATUS_MAP);
  const dev = data.dev || {};
  for (const p of dev.projects || []) {
    if (!p) continue;
    p.status = normEnum(p.status, PROJECT_STATUS_MAP);
    for (const t of p.tasks || []) if (t) {
      t.status = normEnum(t.status, TASK_STATUS_MAP);
      t.priority = normEnum(t.priority, PRIORITY_MAP);
    }
  }
  const cons = data.consult || {};
  for (const i of cons.incomes || []) if (i) i.status = normEnum(i.status, INCOME_STATUS_MAP);
  const g = data.gaming || {};
  for (const l of g.library || []) if (l) l.status = normEnum(l.status, GAME_STATUS_MAP);
  for (const w of g.wishlist || []) if (w) w.priority = normEnum(w.priority, WISH_PRIORITY_MAP);
  return data;
}
export function ensureData(data) {
  const def = defaultData();
  if (!data || typeof data !== 'object') return def;
  const out = { ...def, ...data };
  out.settings = { ...def.settings, ...(data.settings || {}) };
  // 归一化首页模块：空/非法时回退到默认列表，保证首页摘要永不空白
  {
    const hm = Array.isArray(out.settings.homeModules)
      ? out.settings.homeModules.filter((x) => DEFAULT_HOME_MODULES.includes(x))
      : [];
    out.settings.homeModules = hm.length > 0 ? hm : [...DEFAULT_HOME_MODULES];
  }
  out.selfmedia = { ...def.selfmedia, ...(data.selfmedia || {}) };
  out.dev = { ...def.dev, ...(data.dev || {}) };
  out.consult = { ...def.consult, ...(data.consult || {}) };
  out.fitness = { ...def.fitness, ...(data.fitness || {}) };
  out.diet = { ...def.diet, ...(data.diet || {}) };
  out.gaming = { ...def.gaming, ...(data.gaming || {}) };
  out.memos = Array.isArray(out.memos) ? out.memos : [];
  out.plan = out.plan && typeof out.plan === 'object' && !Array.isArray(out.plan) ? out.plan : {};
  out.selfmedia.platforms = Array.isArray(out.selfmedia.platforms) ? out.selfmedia.platforms : [];
  out.selfmedia.contents = Array.isArray(out.selfmedia.contents) ? out.selfmedia.contents : [];
  out.selfmedia.ideas = Array.isArray(out.selfmedia.ideas) ? out.selfmedia.ideas : [];
  out.selfmedia.publishStats = Array.isArray(out.selfmedia.publishStats) ? out.selfmedia.publishStats : [];
  out.dev.projects = Array.isArray(out.dev.projects) ? out.dev.projects : [];
  out.consult.clients = Array.isArray(out.consult.clients) ? out.consult.clients : [];
  out.consult.appointments = Array.isArray(out.consult.appointments) ? out.consult.appointments : [];
  out.consult.records = Array.isArray(out.consult.records) ? out.consult.records : [];
  out.consult.incomes = Array.isArray(out.consult.incomes) ? out.consult.incomes : [];
  out.fitness.templates = Array.isArray(out.fitness.templates) ? out.fitness.templates : [];
  out.fitness.workouts = Array.isArray(out.fitness.workouts) ? out.fitness.workouts : [];
  out.fitness.bodyMetrics = Array.isArray(out.fitness.bodyMetrics) ? out.fitness.bodyMetrics : [];
  out.diet.days = out.diet.days && typeof out.diet.days === 'object' ? out.diet.days : {};
  out.diet.templates = Array.isArray(out.diet.templates) ? out.diet.templates : [];
  out.gaming.library = Array.isArray(out.gaming.library) ? out.gaming.library : [];
  out.gaming.sessions = Array.isArray(out.gaming.sessions) ? out.gaming.sessions : [];
  out.gaming.wishlist = Array.isArray(out.gaming.wishlist) ? out.gaming.wishlist : [];
  normalizeEnums(out);
  return out;
}

// ---------- 通用列表操作 ----------

export function upsert(list, item) {
  const it = { ...item, id: item.id || uid() };
  const idx = list.findIndex((x) => x.id === it.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...it };
  else list.push(it);
  return it;
}

export function removeById(list, id) {
  const idx = list.findIndex((x) => x.id === id);
  if (idx >= 0) list.splice(idx, 1);
  return idx >= 0;
}

export function byId(list, id) {
  return list.find((x) => x.id === id) || null;
}

// ---------- 备忘 ----------

export function addMemo(state, text) {
  const t = String(text || '').trim();
  if (!t) return null;
  const m = { id: uid(), text: t, done: false, createdAt: new Date().toISOString() };
  state.memos.unshift(m);
  return m;
}

export function toggleMemo(state, id) {
  const m = byId(state.memos, id);
  if (m) m.done = !m.done;
  return m;
}

export function removeMemo(state, id) {
  return removeById(state.memos, id);
}

// ---------- 今日计划 ----------

export function planItems(state, date) {
  return state.plan[date] || [];
}

export function ensurePlanDate(state, date) {
  if (!state.plan[date]) state.plan[date] = [];
  return state.plan[date];
}

export function addPlanItem(state, date, item = {}) {
  const list = ensurePlanDate(state, date);
  const it = {
    id: uid(),
    text: '',
    slot: 'morning',
    important: false,
    note: '',
    done: false,
    createdAt: new Date().toISOString(),
    ...item,
  };
  list.push(it);
  return it;
}

export function updatePlanItem(state, date, id, patch = {}) {
  const it = byId(ensurePlanDate(state, date), id);
  if (it) Object.assign(it, patch);
  return it;
}

export function togglePlanItem(state, date, id) {
  const it = byId(ensurePlanDate(state, date), id);
  if (it) it.done = !it.done;
  return it;
}

export function removePlanItem(state, date, id) {
  return removeById(ensurePlanDate(state, date), id);
}

export function groupBySlot(items) {
  const out = { morning: [], afternoon: [], evening: [] };
  for (const it of items || []) {
    if (!out[it.slot]) out[it.slot] = [];
    out[it.slot].push(it);
  }
  return out;
}
export function completionRate(items) {
  if (!items || items.length === 0) return 0;
  return Math.round((items.filter((x) => x.done).length / items.length) * 100);
}

export function copyUnfinishedToNext(state, date) {
  const src = planItems(state, date).filter((x) => !x.done);
  if (src.length === 0) return 0;
  const next = addDays(date, 1);
  const list = ensurePlanDate(state, next);
  for (const it of src) {
    list.push({ ...it, id: uid(), done: false, copiedFrom: date, createdAt: new Date().toISOString() });
  }
  return src.length;
}

export const SLOTS = [
  { key: 'morning', label: '上午' },
  { key: 'afternoon', label: '下午' },
  { key: 'evening', label: '晚上' },
];

export function slotLabel(key) {
  const s = SLOTS.find((x) => x.key === key);
  return s ? s.label : key;
}

// ---------- 自媒体 ----------

export const CONTENT_STATUSES = [
  { key: 'drafting', label: '构思中' },
  { key: 'writing', label: '撰写中' },
  { key: 'scheduled', label: '待发布' },
  { key: 'published', label: '已发布' },
];

export const CONTENT_STATUS_KEYS = CONTENT_STATUSES.map((s) => s.key);

export function nextContentStatus(key) {
  const i = CONTENT_STATUS_KEYS.indexOf(key);
  if (i < 0 || i >= CONTENT_STATUS_KEYS.length - 1) return null;
  return CONTENT_STATUS_KEYS[i + 1];
}

export function contentStatusLabel(key) {
  const s = CONTENT_STATUSES.find((x) => x.key === key);
  return s ? s.label : key;
}

export function buildStatsChartData(state) {
  return state.selfmedia.publishStats
    .map((s) => {
      const c = state.selfmedia.contents.find((x) => x.id === s.contentId);
      return {
        id: s.id,
        title: c ? c.title : '（已删除内容）',
        date: s.publishDate || '',
        views: Number(s.views) || 0,
        likes: Number(s.likes) || 0,
        comments: Number(s.comments) || 0,
      };
    })
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

// ---------- 开发工作 ----------

export const PROJECT_STATUSES = [
  { key: 'active', label: '进行中' },
  { key: 'paused', label: '暂停' },
  { key: 'done', label: '已完成' },
];

export const TASK_STATUSES = [
  { key: 'todo', label: '待办' },
  { key: 'doing', label: '进行中' },
  { key: 'done', label: '已完成' },
];

export function statusLabel(statuses, key) {
  const s = statuses.find((x) => x.key === key);
  return s ? s.label : key;
}

export function addProjectTask(state, projectId, task = {}) {
  const p = state.dev.projects.find((x) => x.id === projectId);
  if (!p) return null;
  if (!Array.isArray(p.tasks)) p.tasks = [];
  const t = { id: uid(), text: '', status: 'todo', priority: 'normal', ...task };
  p.tasks.push(t);
  return t;
}
export function projectTaskStats(project) {
  const tasks = Array.isArray(project.tasks) ? project.tasks : [];
  const done = tasks.filter((t) => t.status === 'done').length;
  return { total: tasks.length, done, pending: tasks.length - done };
}

// ---------- 健身 ----------

export function dietDay(state, date) {
  if (!state.diet.days[date]) {
    state.diet.days[date] = { breakfast: '', lunch: '', dinner: '', snack: '', water: 0 };
  }
  return state.diet.days[date];
}

export function applyDietTemplate(state, date, templateId) {
  const t = state.diet.templates.find((x) => x.id === templateId);
  if (!t) return false;
  const day = dietDay(state, date);
  if (t.breakfast !== undefined) day.breakfast = t.breakfast;
  if (t.lunch !== undefined) day.lunch = t.lunch;
  if (t.dinner !== undefined) day.dinner = t.dinner;
  if (t.snack !== undefined) day.snack = t.snack;
  return true;
}

export function recordedDietDays(state) {
  return Object.keys(state.diet.days)
    .filter((d) => {
      const day = state.diet.days[d];
      return [day.breakfast, day.lunch, day.dinner, day.snack].some((x) => String(x || '').trim() !== '') || (Number(day.water) || 0) > 0;
    })
    .sort((a, b) => b.localeCompare(a));
}
export function workoutsInWeek(state, date) {
  const start = weekStartDate(date, state.settings.weekStart);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    for (const w of state.fitness.workouts) if (w.date === d) out.push(w);
  }
  return out;
}

export function workoutsOn(state, date) {
  return state.fitness.workouts.filter((w) => w.date === date);
}

export function addWorkout(state, workout) {
  const idx = state.fitness.workouts.findIndex(
    (w) => w.date === workout.date && w.templateId === workout.templateId
  );
  if (idx >= 0) state.fitness.workouts[idx] = workout;
  else state.fitness.workouts.push(workout);
  return workout;
}

export function bodyLatest(state) {
  const m = state.fitness.bodyMetrics;
  if (!m.length) return null;
  return [...m].sort((a, b) => b.date.localeCompare(a.date))[0];
}

export function bodySorted(state) {
  return [...state.fitness.bodyMetrics].sort((a, b) => b.date.localeCompare(a.date));
}

// ---------- 游戏娱乐 ----------

export const GAME_STATUSES = [
  { key: 'want', label: '想玩' },
  { key: 'playing', label: '在玩' },
  { key: 'done', label: '通关' },
  { key: 'dropped', label: '弃坑' },
];

export function sessionsOn(state, date) {
  return state.gaming.sessions.filter((s) => s.date === date);
}

export function sessionMinutesOn(state, date) {
  return sessionsOn(state, date).reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);
}

export function monthDays(year, month) {
  const days = [];
  const last = new Date(year, month, 0).getDate();
  for (let d = 1; d <= last; d++) {
    days.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return days;
}

export function templateNameById(state, id) {
  const t = state.fitness.templates.find((x) => x.id === id);
  return t ? t.name : '（已删除模板）';
}

export function fitnessMonthMap(state, year, month) {
  const map = {};
  for (const date of monthDays(year, month)) {
    const ws = state.fitness.workouts.filter((w) => w.date === date);
    if (ws.length) {
      map[date] = ws.map((w) => ({
        id: w.id,
        templateName: templateNameById(state, w.templateId),
        exercises: (w.exercises || []).map((e) => ({
          name: e.name,
          sets: e.sets,
          reps: e.reps,
          weight: e.weight,
          done: e.done,
        })),
      }));
    }
  }
  return map;
}

export function dietMonthMap(state, year, month) {
  const map = {};
  const meals = ['breakfast', 'lunch', 'dinner', 'snack'];
  for (const date of monthDays(year, month)) {
    const day = state.diet.days[date];
    if (!day) continue;
    const recorded = meals.filter((k) => String(day[k] || '').trim() !== '').length;
    const water = Number(day.water) || 0;
    if (recorded > 0 || water > 0) map[date] = { mealsRecorded: recorded, water };
  }
  return map;
}

// ---------- 首页摘要 ----------

export function todayPlanSummary(state, date) {
  const items = planItems(state, date);
  const done = items.filter((x) => x.done).length;
  return { total: items.length, done, pending: items.length - done, rate: completionRate(items) };
}

export function selfmediaSummary(state, date) {
  const { contents, ideas, platforms } = state.selfmedia;
  const toPublishToday = contents.filter((c) => c.publishDate === date && c.status !== 'published').length;
  const publishedTotal = contents.filter((c) => c.status === 'published').length;
  const inProgress = contents.filter((c) => c.status !== 'published').length;
  return { toPublishToday, publishedTotal, inProgress, total: contents.length, ideas: ideas.length, platforms: platforms.length };
}

export function devSummary(state) {
  const projects = state.dev.projects;
  const active = projects.filter((p) => p.status === 'active').length;
  const openTasks = projects.reduce(
    (sum, p) => sum + (Array.isArray(p.tasks) ? p.tasks.filter((t) => t.status !== 'done').length : 0),
    0
  );
  return { projects: projects.length, active, openTasks };
}

export function consultSummary(state, date) {
  const appointmentsToday = state.consult.appointments.filter((a) => a.date === date).length;
  const unpaid = state.consult.incomes.filter((i) => i.status === 'unpaid').length;
  return { appointmentsToday, unpaid, clients: state.consult.clients.length };
}

export function fitnessSummary(state, date) {
  const goal = Number(state.fitness.weeklyGoal) || 0;
  const weekCount = workoutsInWeek(state, date).length;
  const todayWorkout = state.fitness.workouts.some((w) => w.date === date);
  return { weekCount, weeklyGoal: goal, todayWorkout, goalMet: goal > 0 && weekCount >= goal, total: state.fitness.workouts.length };
}

export function dietSummary(state, date) {
  const day = state.diet.days[date];
  const meals = ['breakfast', 'lunch', 'dinner', 'snack'];
  const recorded = day ? meals.filter((k) => String(day[k] || '').trim() !== '').length : 0;
  return { mealsRecorded: recorded, water: day ? Number(day.water) || 0 : 0, allMeals: recorded === 4, recordedDays: recordedDietDays(state).length };
}

export function gamingSummary(state, date) {
  const minutesToday = state.gaming.sessions
    .filter((s) => s.date === date)
    .reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);
  const playing = state.gaming.library.filter((g) => g.status === 'playing').length;
  const wishlist = state.gaming.wishlist.filter((w) => !w.bought).length;
  return { minutesToday, playing, wishlist, totalSessions: state.gaming.sessions.length };
}