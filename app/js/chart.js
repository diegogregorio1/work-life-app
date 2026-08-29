// 纯 SVG 图表生成（无依赖、无 DOM，可在 Node 中测试）
export function escapeXml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

export function truncate(s, max) {
  const t = String(s ?? '');
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

const SERIES = [
  { key: 'views', label: '阅读', color: '#5b8cff' },
  { key: 'likes', label: '点赞', color: '#2bbd7e' },
  { key: 'comments', label: '评论', color: '#ff9f43' },
];

// 生成分组柱状图 SVG：每篇内容一组，组内三根柱子（阅读/点赞/评论）
export function statsChartSVG(data) {
  if (!data || data.length === 0) return '';
  const width = 720;
  const height = 260;
  const pad = { top: 26, right: 16, bottom: 46, left: 46 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const maxV = Math.max(1, ...data.map((d) => Math.max(Number(d.views) || 0, Number(d.likes) || 0, Number(d.comments) || 0)));
  const groupW = innerW / data.length;
  const barW = Math.min(22, groupW / 4.2);
  const gap = 3;

  let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="发布后数据统计图表">`;

  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const y = pad.top + innerH - (innerH * i) / ticks;
    const val = Math.round((maxV * i) / ticks);
    svg += `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="rgba(120,130,160,0.25)" stroke-width="1"/>`;
    svg += `<text x="${pad.left - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="#6b7280">${val}</text>`;
  }

  data.forEach((d, i) => {
    const gx = pad.left + i * groupW;
    const startX = gx + (groupW - barW * SERIES.length - gap * (SERIES.length - 1)) / 2;
    SERIES.forEach((s, si) => {
      const v = Number(d[s.key]) || 0;
      const h = (v / maxV) * innerH;
      const x = startX + si * (barW + gap);
      const y = pad.top + innerH - h;
      svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${s.color}">`;
      svg += `<title>${escapeXml(d.title)}：${s.label} ${v}</title></rect>`;
    });
    const label = escapeXml(truncate(d.title, 8));
    svg += `<text x="${(gx + groupW / 2).toFixed(1)}" y="${height - pad.bottom + 16}" text-anchor="middle" font-size="11" fill="#6b7280">${label}</text>`;
  });

  svg += '</svg>';
  return svg;
}

export function chartLegendHTML() {
  return SERIES.map((s) => `<span class="chart-legend-item"><i style="background:${s.color}"></i>${s.label}</span>`).join('');
}