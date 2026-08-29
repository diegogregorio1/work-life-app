// 问题2 验收：自媒体发布数据统计图表
import test from 'node:test';
import assert from 'node:assert/strict';
import * as dc from '../app/js/data-core.js';
import { statsChartSVG, chartLegendHTML, escapeXml, truncate } from '../app/js/chart.js';

test('buildStatsChartData 映射并按日期排序', () => {
  const s = dc.ensureData(null);
  s.selfmedia.contents.push({ id: 'c1', title: '文章A' }, { id: 'c2', title: '视频B' });
  s.selfmedia.publishStats.push(
    { id: 's2', contentId: 'c2', publishDate: '2026-08-30', views: '200', likes: 30, comments: 5 },
    { id: 's1', contentId: 'c1', publishDate: '2026-08-29', views: 100, likes: 20, comments: 2 },
    { id: 's3', contentId: 'gone', publishDate: '2026-08-28', views: 10, likes: 1, comments: 0 }
  );
  const data = dc.buildStatsChartData(s);
  assert.equal(data.length, 3);
  assert.deepEqual(data.map((d) => d.date), ['2026-08-28', '2026-08-29', '2026-08-30']);
  assert.equal(data[1].title, '文章A');
  assert.equal(data[2].views, 200, '字符串数字应转成数字');
  assert.equal(data[0].title, '（已删除内容）');
});

test('statsChartSVG 生成分组柱状图', () => {
  const data = [
    { id: '1', title: '文章A', date: '2026-08-29', views: 100, likes: 20, comments: 2 },
    { id: '2', title: '视频B', date: '2026-08-30', views: 300, likes: 50, comments: 8 },
  ];
  const svg = statsChartSVG(data);
  assert.match(svg, /<svg /);
  assert.equal((svg.match(/<rect /g) || []).length, 6, '每篇内容 3 根柱子');
  assert.ok(svg.includes('viewBox="0 0 720 260"'));
  assert.equal(statsChartSVG([]), '');
  assert.equal(statsChartSVG(null), '');
});

test('图表内容安全转义与截断', () => {
  const data = [{ id: '1', title: '含<特殊>&字符', date: '', views: 10, likes: 1, comments: 0 }];
  const svg = statsChartSVG(data);
  assert.ok(!svg.includes('<特殊>'), '不应出现未转义标签');
  assert.ok(svg.includes('&lt;特殊&gt;'), '应转义 < >');
  assert.equal(escapeXml('<a&b>'), '&lt;a&amp;b&gt;');
  assert.equal(truncate('abcdefghijk', 8), 'abcdefg…');
  assert.ok(chartLegendHTML().includes('阅读'));
  assert.ok(chartLegendHTML().includes('点赞'));
  assert.ok(chartLegendHTML().includes('评论'));
});

test('自媒体模块可加载且包含图表入口', async () => {
  const mod = await import('../app/js/pages/selfmedia.js');
  assert.equal(typeof mod.render, 'function');
  const src = await import('node:fs').then((fs) => fs.readFileSync(new URL('../app/js/pages/selfmedia.js', import.meta.url), 'utf8'));
  assert.ok(src.includes('statsChartSVG'), '数据记录页应调用图表');
  assert.ok(src.includes('buildStatsChartData'), '应使用数据准备函数');
});