// 问题1 验收：iOS 毛玻璃风格 UI
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');

test('毛玻璃效果：backdrop-filter + 半透明玻璃背景 + 深色主题变量', () => {
  assert.match(css, /backdrop-filter:\s*blur\([^)]*\)\s*saturate\(/i, '应有 backdrop-filter 模糊+饱和');
  assert.match(css, /-webkit-backdrop-filter:\s*blur\(/i, '应有 webkit 前缀兼容');
  assert.ok(css.includes('.glass'), '应有 .glass 通用玻璃类');
  assert.match(css, /--glass-bg:\s*rgba\(255,\s*255,\s*255,\s*0\.\d+\)/, '浅色玻璃背景为半透明白');
  assert.match(css, /\[data-theme="dark"\]\s*\{/, '应有深色主题');
  assert.match(css, /--glass-bg:\s*rgba\(24,\s*26,\s*34,\s*0\.\d+\)/, '深色玻璃背景为半透明深色');
});

test('背景光晕层与渐变', () => {
  assert.ok(html.includes('bg-aurora'), 'index.html 应包含背景光晕层');
  assert.match(css, /\.bg-aurora\s*\{/, 'CSS 应定义 .bg-aurora');
  assert.match(css, /radial-gradient/, '背景应使用径向渐变光晕');
  assert.match(css, /linear-gradient\(135deg/, '背景应使用线性渐变底色');
});

test('核心组件仍使用玻璃质感', () => {
  for (const sel of ['#sidebar', '#topbar', '.card', '.modal', '.toast']) {
    assert.ok(css.includes(sel), `CSS 应包含 ${sel}`);
  }
  assert.match(css, /--grad-primary:\s*linear-gradient\(135deg/, '渐变变量应定义');
  assert.match(css, /\.btn-primary\s*\{\s*background:\s*var\(--grad-primary\)/, '主按钮应使用渐变变量');
  assert.match(css, /\.summary-card:hover/, '首页摘要卡片应有悬停效果');
});