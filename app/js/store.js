// 浏览器端数据层：加载 / 自动保存 / 导出 / 导入
import { defaultData, ensureData } from './data-core.js';

let state = ensureData(null);
let saveTimer = null;
let statusEl = null;

export function setStatusEl(el) {
  statusEl = el;
}

export function getState() {
  return state;
}

function setStatus(text, cls = '') {
  if (statusEl) {
    statusEl.textContent = text;
    statusEl.className = 'save-status' + (cls ? ' ' + cls : '');
  }
}

export async function load() {
  try {
    const res = await fetch('/api/data');
    const j = await res.json();
    if (j.ok && j.data) {
      state = ensureData(j.data);
      if (j.recovered) setStatus('已从备份恢复', 'warn');
      else setStatus('已加载', 'ok');
    } else {
      state = defaultData();
      setStatus('新数据', 'ok');
      save();
    }
  } catch (e) {
    state = defaultData();
    setStatus('无法连接本地服务', 'error');
  }
  return state;
}

export function save() {
  clearTimeout(saveTimer);
  setStatus('保存中…');
  saveTimer = setTimeout(() => doSave(), 300);
}

// 手动保存：立即写入，返回是否成功
export async function saveNow() {
  clearTimeout(saveTimer);
  setStatus('保存中…');
  return doSave();
}

async function doSave() {
  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
    const j = await res.json();
    if (j.ok) {
      setStatus('已保存', 'ok');
      return true;
    }
    setStatus('保存失败：' + (j.error || '未知错误'), 'error');
    return false;
  } catch (e) {
    setStatus('保存失败，请确认服务在运行', 'error');
    return false;
  }
}

export async function exportData() {
  const res = await fetch('/api/export');
  if (!res.ok) throw new Error('导出失败');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'data.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importData(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  const res = await fetch('/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: text,
  });
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || '导入失败');
  state = ensureData(data);
  return true;
}