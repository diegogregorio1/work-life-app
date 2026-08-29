// 通用 UI 组件：元素构建、弹窗、确认、toast、日期条、空状态等
import { addDays, parseDateStr, todayStr, monthDays } from './data-core.js';

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else node.setAttribute(k, v);
  }
  const list = Array.isArray(children) ? children : [children];
  for (const c of list) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function toast(msg, type = 'info') {
  let box = document.getElementById('toast-box');
  if (!box) {
    box = el('div', { id: 'toast-box', class: 'toast-box' });
    document.body.append(box);
  }
  const t = el('div', { class: 'toast' + (type !== 'info' ? ' toast-' + type : ''), text: msg });
  box.append(t);
  setTimeout(() => t.remove(), 2600);
}

export function confirmBox(message, { danger = true, confirmText = '删除', cancelText = '取消' } = {}) {
  return new Promise((resolve) => {
    const overlay = el('div', { class: 'modal-backdrop' });
    const body = el('div', { class: 'modal confirm-modal' }, [
      el('p', { class: 'confirm-text', text: message }),
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn btn-ghost', text: cancelText, onclick: () => { overlay.remove(); resolve(false); } }),
        el('button', { class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'), text: confirmText, onclick: () => { overlay.remove(); resolve(true); } }),
      ]),
    ]);
    overlay.append(body);
    document.body.append(overlay);
  });
}

export function formModal({ title, fields, values = {}, onSubmit }) {
  const overlay = el('div', { class: 'modal-backdrop' });
  const body = el('div', { class: 'modal form-modal' });
  body.append(el('h3', { class: 'modal-title', text: title }));
  const form = el('form', { class: 'modal-form' });
  const inputs = {};
  for (const f of fields) {
    const label = el('label', { class: 'field-label', text: f.label });
    const val = values[f.key] ?? f.default ?? '';
    let input;
    if (f.type === 'textarea') {
      input = el('textarea', { class: 'input', rows: f.rows || 2, placeholder: f.placeholder || '', text: val });
    } else if (f.type === 'select') {
      input = el('select', { class: 'input' });
      for (const opt of f.options || []) input.append(el('option', { value: opt.value, text: opt.label }));
      input.value = val;
    } else if (f.type === 'number') {
      input = el('input', { class: 'input', type: 'number', value: val, step: f.step || '1', min: f.min, placeholder: f.placeholder || '' });
    } else if (f.type === 'date') {
      input = el('input', { class: 'input', type: 'date', value: val });
    } else if (f.type === 'time') {
      input = el('input', { class: 'input', type: 'time', value: val });
    } else {
      input = el('input', { class: 'input', type: 'text', value: val, placeholder: f.placeholder || '' });
    }
    inputs[f.key] = input;
    form.append(label, input);
    if (f.hint) form.append(el('p', { class: 'field-hint', text: f.hint }));
  }
  const actions = el('div', { class: 'modal-actions' }, [
    el('button', { class: 'btn btn-ghost', type: 'button', text: '取消', onclick: () => overlay.remove() }),
    el('button', { class: 'btn btn-primary', type: 'submit', text: '保存' }),
  ]);
  form.append(actions);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const result = {};
    for (const f of fields) {
      const input = inputs[f.key];
      let v = input.value;
      if (f.type === 'number') v = v === '' ? null : Number(v);
      if (f.required && String(v ?? '').trim() === '') {
        toast('请填写「' + f.label + '」', 'error');
        input.focus();
        return;
      }
      result[f.key] = v;
    }
    overlay.remove();
    onSubmit(result);
  });
  body.append(form);
  overlay.append(body);
  document.body.append(overlay);
  const first = Object.values(inputs)[0];
  if (first) setTimeout(() => first.focus(), 50);
}

export function dateStrip({ date, onChange }) {
  const fmt = (d) => {
    const dt = parseDateStr(d);
    const wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dt.getDay()];
    return `${dt.getMonth() + 1}月${dt.getDate()}日 ${wd}`;
  };
  const isToday = date === todayStr();
  const label = el('span', { class: 'date-strip-label', text: fmt(date) + (isToday ? '（今天）' : '') });
  return el('div', { class: 'date-strip' }, [
    el('button', { class: 'btn btn-ghost btn-sm', text: '‹ 前一天', onclick: () => onChange(addDays(date, -1)) }),
    label,
    el('button', { class: 'btn btn-ghost btn-sm', text: '今天', onclick: () => onChange(todayStr()) }),
    el('button', { class: 'btn btn-ghost btn-sm', text: '后一天 ›', onclick: () => onChange(addDays(date, 1)) }),
  ]);
}

export function emptyState(text) {
  return el('div', { class: 'empty-state', text });
}

export function badge(text, cls = 'badge-neutral') {
  return el('span', { class: 'badge ' + cls, text });
}

export function monthCalendar({ year, month, weekStart = 1, cellRender, onSelect, selected }) {
  const grid = el('div', { class: 'calendar' });
  for (let i = 0; i < 7; i++) {
    grid.append(el('div', { class: 'calendar-wd', text: '日一二三四五六'[(weekStart + i) % 7] }));
  }
  const total = monthDays(year, month).length;
  const lead = (new Date(year, month - 1, 1).getDay() - weekStart + 7) % 7;
  for (let i = 0; i < lead; i++) grid.append(el('div', { class: 'calendar-cell empty' }));
  for (let d = 1; d <= total; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const cell = el('div', { class: 'calendar-cell' + (selected === dateStr ? ' selected' : '') });
    cell.append(el('div', { class: 'calendar-daynum', text: String(d) }));
    const content = cellRender ? cellRender(dateStr) : null;
    if (content) cell.append(content);
    cell.addEventListener('click', () => onSelect && onSelect(dateStr));
    grid.append(cell);
  }
  return grid;
}
export function progressBar(percent) {
  const p = Math.max(0, Math.min(100, percent));
  return el('div', { class: 'progress' }, [el('i', { style: 'width:' + p + '%' })]);
}

export function iconBtn(symbol, title, onclick) {
  return el('button', { class: 'icon-btn', type: 'button', title, text: symbol, onclick });
}