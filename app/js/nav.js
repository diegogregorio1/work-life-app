// 导航配置与 hash 解析（纯逻辑，可测试）
export const NAV_ITEMS = [
  { id: 'home', title: '首页总览', icon: '🏠' },
  { id: 'today', title: '今日计划', icon: '📅' },
  { id: 'selfmedia', title: '自媒体', icon: '📣' },
  { id: 'dev', title: '开发工作', icon: '💻' },
  { id: 'consult', title: '咨询工作', icon: '🤝' },
  { id: 'fitness', title: '健身计划', icon: '💪' },
  { id: 'diet', title: '饮食计划', icon: '🥗' },
  { id: 'gaming', title: '游戏娱乐', icon: '🎮' },
  { id: 'settings', title: '数据与设置', icon: '⚙️' },
];

export function parseHash(hash) {
  const raw = String(hash || '').replace(/^#\/?/, '');
  const parts = raw.split('/');
  return { page: parts[0] || 'home', param: decodeURIComponent(parts[1] || '') };
}

export function navTitle(pageId) {
  const item = NAV_ITEMS.find((x) => x.id === pageId);
  return item ? item.title : '未知页面';
}