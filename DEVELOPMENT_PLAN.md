# 开发计划（第一版）— 工作生活专属 APP

- 依据：PRD.md（V1.0，2026-08-30 已确认）
- 环境检查结果：Node.js 已安装（D:\D盘文件\Apps\node.exe）、Python 3.14 已安装、Edge 浏览器可用
- 本计划的目标：按阶段可直接执行，每阶段都有产出文件和验收标准

---

## 0. 技术方案（已确定）

| 项目 | 选择 | 理由 |
| --- | --- | --- |
| 本地服务 | Node.js `server.js`，只用内置模块（http/fs/path），零依赖 | 电脑已装 Node，无需安装任何东西 |
| 前端 | 原生 HTML/CSS/JS，无框架、无构建步骤 | 简单、可控、加载快 |
| 页面路由 | hash 路由（#/home、#/today ...） | 刷新后停留在当前页面，刷新/关闭不丢状态 |
| 启动器 | `启动.bat`（最小化窗口运行服务 + 自动打开 Edge）+ `停止.bat` | 双击即用，无需手动输入命令 |
| 端口 | 127.0.0.1:3344，只绑定本机 | 不上网、外部无法访问 |
| 数据文件 | `app/data/data.json` + `app/data/data.backup.json` | 真实文件、肉眼可见、可手动备份 |
| 字符编码 | 全项目 UTF-8 | 中文显示正常 |

---

## 1. 项目目录结构（最终形态）

```
新建APP/
├── PRD.md                     # 产品需求文档（已有）
├── DEVELOPMENT_PLAN.md        # 本开发计划
├── README.md                  # 使用说明（写给使用者）
├── 启动.bat                   # 双击启动
├── 停止.bat                   # 双击停止服务
└── app/
    ├── server.js              # 本地服务：静态文件 + 数据读写 API
    ├── index.html             # 单页入口
    ├── css/
    │   └── style.css          # 全部样式（浅色/深色主题变量）
    ├── js/
    │   ├── app.js             # 启动、hash 路由、页面注册
    │   ├── store.js           # 数据加载/保存/备份/导入导出
    │   ├── ui.js              # 通用组件：弹窗、确认框、toast、日期条、空状态
    │   └── pages/
    │       ├── home.js        # 首页总览
    │       ├── today.js       # 今日计划
    │       ├── selfmedia.js   # 自媒体
    │       ├── dev.js         # 开发工作
    │       ├── consult.js     # 咨询工作
    │       ├── fitness.js     # 健身计划
    │       ├── diet.js        # 饮食计划
    │       ├── gaming.js      # 游戏娱乐
    │       └── settings.js    # 数据与设置
    └── data/
        ├── data.json          # 主数据文件（首次启动自动创建）
        └── data.backup.json   # 最近一次备份
```

---

## 2. 数据模型（data.json 完整结构）

```json
{
  "version": 1,
  "settings": {
    "theme": "light",
    "weekStart": 1,
    "homeModules": ["today", "selfmedia", "dev", "consult", "fitness", "diet", "gaming"]
  },
  "memos": [
    { "id": "uuid", "text": "备忘内容", "done": false, "createdAt": "2026-08-30T10:00:00" }
  ],
  "plan": {
    "2026-08-30": [
      { "id": "uuid", "text": "事项内容", "slot": "morning", "important": false,
        "note": "备注", "done": false, "createdAt": "..." }
    ]
  },
  "selfmedia": {
    "platforms": [
      { "id": "uuid", "name": "公众号", "account": "账号", "note": "备注" }
    ],
    "contents": [
      { "id": "uuid", "title": "标题/内容", "platformId": "uuid",
        "status": "drafting", "publishDate": "2026-08-31", "note": "" }
    ],
    "ideas": [
      { "id": "uuid", "text": "灵感内容", "source": "来源", "createdAt": "..." }
    ],
    "publishStats": [
      { "id": "uuid", "contentId": "uuid", "publishDate": "2026-08-30",
        "views": 0, "likes": 0, "comments": 0 }
    ]
  },
  "dev": {
    "projects": [
      { "id": "uuid", "name": "项目名", "stack": "技术栈", "status": "active",
        "note": "备注",
        "tasks": [
          { "id": "uuid", "text": "任务", "status": "todo", "priority": "normal" }
        ],
        "logs": [
          { "id": "uuid", "date": "2026-08-30", "text": "今天做了什么" }
        ] }
    ]
  },
  "consult": {
    "clients": [
      { "id": "uuid", "name": "称呼", "contact": "联系方式", "source": "来源", "note": "备注" }
    ],
    "appointments": [
      { "id": "uuid", "date": "2026-08-31", "time": "14:00", "clientId": "uuid", "topic": "主题" }
    ],
    "records": [
      { "id": "uuid", "date": "2026-08-30", "clientId": "uuid", "topic": "主题",
        "duration": 60, "note": "要点" }
    ],
    "incomes": [
      { "id": "uuid", "date": "2026-08-30", "clientId": "uuid", "amount": 500,
        "status": "unpaid", "note": "" }
    ]
  },
  "fitness": {
    "weeklyGoal": 3,
    "templates": [
      { "id": "uuid", "name": "胸", "exercises": [
        { "id": "uuid", "name": "卧推", "sets": 4, "reps": 10 } ] }
    ],
    "workouts": [
      { "id": "uuid", "date": "2026-08-30", "templateId": "uuid",
        "exercises": [
          { "name": "卧推", "weight": 60, "reps": 10, "sets": 4, "done": true } ] }
    ],
    "bodyMetrics": [
      { "id": "uuid", "date": "2026-08-30", "weight": 65.5 }
    ]
  },
  "diet": {
    "days": {
      "2026-08-30": { "breakfast": "", "lunch": "", "dinner": "", "snack": "", "water": 0 }
    },
    "templates": [
      { "id": "uuid", "name": "减脂日", "breakfast": "", "lunch": "", "dinner": "" }
    ]
  },
  "gaming": {
    "library": [
      { "id": "uuid", "name": "游戏名", "status": "playing", "note": "" }
    ],
    "sessions": [
      { "id": "uuid", "date": "2026-08-30", "game": "游戏名", "minutes": 60, "note": "" }
    ],
    "wishlist": [
      { "id": "uuid", "name": "想买的游戏", "price": 199, "priority": "high", "bought": false }
    ]
  }
}
```

约定：
- 所有日期用本地日期字符串 `YYYY-MM-DD`，时间用 `HH:mm`，避免时区问题。
- 所有 id 用 `crypto.randomUUID()` 生成。
- 状态枚举统一用英文小写存储，界面显示中文。

---

## 3. 后端 API 设计（server.js）

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | / | 返回 index.html |
| GET | /css/*、/js/* | 静态文件 |
| GET | /api/data | 读取数据；若 data.json 缺失/损坏，自动用 data.backup.json 恢复并返回 |
| POST | /api/data | 保存数据：先写 data.json.tmp，再替换 data.json；替换前把旧数据复制为 data.backup.json；返回 {ok:true} |
| GET | /api/export | 以文件下载方式返回当前数据（用于一键导出） |
| POST | /api/import | 校验 JSON 结构后覆盖数据（先自动备份当前数据）；返回 {ok:true} |
| POST | /api/shutdown | 停止服务（供 停止.bat 调用） |

安全与稳定性：
- 服务只绑定 127.0.0.1。
- 所有写文件操作必须是「临时文件 + 原子替换」，避免写一半损坏。
- 每次成功保存后都保留最近一份 backup。

---

## 4. 前端架构

- `app.js`：页面注册表（路由 → 渲染函数），hash 变化时切换页面，公共头部/侧边栏渲染。
- `store.js`：唯一的 `state` 对象；`load()` 启动时读取；`save()` 防抖 300ms 自动保存；提供增删改的通用方法；顶部「已保存」状态提示。
- `ui.js`：通用弹窗表单、删除确认、toast 提示、日期条（← 今天 →）、空状态引导、标签渲染。
- 每个 `pages/*.js` 实现一个模块：渲染 + 事件绑定，只通过 store 读写数据。
- 主题：css 变量切换，主题值存 settings。

---

## 5. 分阶段开发（每阶段：任务、产出、验收）

### Phase 0：骨架与启动器
任务：
1. 创建目录结构（app/css、app/js/pages、app/data）。
2. 编写 `app/server.js`：静态文件 + 4 个数据 API + 原子写入 + 自动备份恢复。
3. 编写 `启动.bat`：检查 node → 最小化窗口启动 server.js → 等 1 秒 → 打开 http://127.0.0.1:3344。
4. 编写 `停止.bat`：调用 /api/shutdown 停止服务。
5. 编写最简 `index.html` 验证服务可用。

产出：server.js、启动.bat、停止.bat、空 index.html、app/data/ 目录
验收：
- 双击 启动.bat 后浏览器自动打开页面。
- app/data/data.json 首次访问后自动生成。
- 停止.bat 能正常停止服务。

### Phase 1：数据层（store.js）
任务：
1. `store.js`：load / save（防抖）/ 备份提示 / 导入导出。
2. 数据初始化：首次启动生成默认结构（settings、空模块）。
3. 保存失败时页面内提示「保存失败，请检查服务是否运行」。

产出：js/store.js
验收：
- 修改数据后，data.json 文件内容实时更新。
- 手动删掉 data.json 后刷新，能从 data.backup.json 自动恢复。
- 页面显示「已保存」状态。

### Phase 2：整体框架
任务：
1. `index.html` 完整骨架：侧边栏（9 项导航）+ 顶部栏（日期/主题切换/已保存状态）+ 主内容区。
2. `app.js` hash 路由，9 个页面切换。
3. `css/style.css`：浅色/深色两套主题变量、统一按钮/卡片/弹窗/表单样式。
4. `ui.js`：弹窗、确认框、toast、日期条、空状态组件。
5. 9 个占位页（每个显示模块名 + 空状态引导语）。

产出：index.html、css/style.css、js/app.js、js/ui.js、js/pages/*.js（占位）
验收：
- 侧边栏 9 项可切换，URL hash 变化，刷新后停留当前页。
- 主题可在浅/深间切换，刷新后保持。
- 弹窗/确认/toast 组件在任意页面可正常调用。

### Phase 3：今日计划
任务：
1. 实现 `pages/today.js`：日期条、按上/下午/晚上分组、事项增删改、勾选完成、完成率。
2. 「把未完成复制到明天」按钮。
3. 添加/编辑弹窗：内容、时间段、重要程度、备注。

产出：js/pages/today.js
验收：
- 增删改勾选全部生效且自动保存。
- 翻日期查看历史计划，今天高亮。
- 未完成事项可一键复制到明天。

### Phase 4：首页总览
任务：
1. 实现 `pages/home.js`：问候语 + 日期。
2. 今日计划卡片：进度条 + 今日事项 + 「去安排」跳转。
3. 快速备忘卡片：添加/勾选/删除。
4. 模块摘要网格：7 个模块（自媒体/开发/咨询/健身/饮食/游戏）各显示关键信息，点击跳转；按 settings.homeModules 决定显示哪些。

产出：js/pages/home.js
验收：
- 首页能显示今日计划进度和备忘。
- 每个摘要卡片显示对应模块关键信息，点击跳到正确页面。
- 设置里取消勾选的模块不在首页显示。

### Phase 5：自媒体
任务：
1. 实现 `pages/selfmedia.js`，页内 4 个 Tab：内容创作 / 发布排期 / 灵感库 / 数据记录。
2. 平台管理入口（右上角）：平台增删改弹窗。
3. 内容创作：按状态分列显示，状态流转按钮（构思中→撰写中→待发布→已发布）。
4. 发布排期：按日期排序列表。
5. 灵感库：增删。
6. 数据记录：每篇发布记录阅读/点赞/评论。

产出：js/pages/selfmedia.js
验收：
- 可新增平台并创建内容，状态可逐步流转。
- 排期列表按日期显示今天/未来要发的内容。
- 可记录发布数据。

### Phase 6：开发工作
任务：
1. 实现 `pages/dev.js` 两级结构：项目列表 → 项目详情。
2. 项目增删改（名称/技术栈/状态/备注）。
3. 项目下任务：增删改、状态切换、优先级。
4. 项目下开发日志：按日期追加。

产出：js/pages/dev.js
验收：
- 可新建项目，点进详情。
- 任务状态切换后首页/列表进度更新。
- 日志按日期写入并保存。

### Phase 7：咨询工作
任务：
1. 实现 `pages/consult.js`，页内 4 个 Tab：客户 / 预约 / 咨询记录 / 收入。
2. 客户增删改 + 客户详情（含该客户的全部咨询记录）。
3. 预约增删改，今天/未来/过去区分显示。
4. 咨询记录增删改。
5. 收入流水：增删改，未收/已收一键切换。

产出：js/pages/consult.js
验收：
- 四个 Tab 数据各自增删改正常。
- 收入状态点一下即切换并保存。
- 首页能显示「今日是否有预约、是否有未收款」。

### Phase 8：健身计划
任务：
1. 实现 `pages/fitness.js`，页内 4 个 Tab：今日训练 / 训练模板 / 训练历史 / 身体数据。
2. 训练模板增删改（含动作列表）。
3. 今日训练：选模板 → 逐动作填重量/次数/组数 → 完成打卡。
4. 训练历史：按日期回看。
5. 身体数据：体重记录，显示最新值和变化。
6. 周目标设置。

产出：js/pages/fitness.js
验收：
- 可建模板、完成一次今日打卡并出现在历史里。
- 体重记录显示最新值和变化。
- 首页能显示本周训练次数和是否达标。

### Phase 9：饮食计划
任务：
1. 实现 `pages/diet.js`，页内 3 个 Tab：今日饮食 / 饮食模板 / 记录回顾。
2. 每日早/午/晚/加餐 + 喝水记录。
3. 饮食模板增删改，可一键把模板套用到某天。
4. 按日期回顾历史。

产出：js/pages/diet.js
验收：
- 三餐和喝水可记录并保存。
- 模板可套用到当天。
- 首页能显示今天三餐是否已记录。

### Phase 10：游戏娱乐
任务：
1. 实现 `pages/gaming.js`，页内 3 个 Tab：游戏库 / 时间记录 / 心愿单。
2. 游戏库增删改 + 状态切换（想玩/在玩/通关/弃坑）。
3. 时间记录增删改，按日期汇总当天总时长。
4. 心愿单增删改 + 已买标记。

产出：js/pages/gaming.js
验收：
- 游戏状态可切换并保存。
- 当天多条时间记录能汇总总时长。
- 首页能显示今天玩了多久。

### Phase 11：数据与设置
任务：
1. 实现 `pages/settings.js`：
   - 数据区：显示 data.json 完整路径、一键导出、一键导入（选择文件并确认覆盖）。
   - 设置区：主题、每周起始日、首页摘要模块勾选。
   - 关于区：版本号、使用说明。

产出：js/pages/settings.js
验收：
- 导出下载的 JSON 与当前数据一致。
- 导入备份后数据被恢复，导入前自动备份当前数据。
- 设置修改后刷新保持。

### Phase 12：全量验收与打磨
任务：
1. 对照 PRD 第 10 节 16 条验收标准逐条实际操作检查。
2. 打磨：所有空状态、删除确认、toast 提示、边界情况（空数据、超长文本、日期切换边界）。
3. 编写 `README.md`：怎么启动、怎么停止、数据在哪、怎么备份。
4. 最终清点交付物。

产出：README.md、修复项
验收：PRD 第 10 节 16 条全部通过。

---

## 6. 验收清单（对应 PRD 第 10 节）

1. 双击启动器 → 浏览器自动打开，无需命令、无需联网。
2. 侧边栏 9 个模块均可切换。
3. 任意模块添加数据 → 刷新/关闭/重启后仍在。
4. app/data/data.json 存在；「数据与设置」页显示路径。
5. 可导出；删除数据后导入可恢复；data.json 损坏可自动从 backup 恢复。
6. 首页显示今日计划摘要、快速备忘、模块摘要，点击可跳转。
7. 今日计划增删改勾选、日期切换、未完成复制到明天。
8. 自媒体平台/内容状态流/发布数据/灵感 均可操作。
9. 开发项目/任务/日志 均可操作。
10. 咨询客户/预约/记录/收入（未收已收切换）均可操作。
11. 健身模板/今日打卡/历史/体重/周目标 均可操作。
12. 饮食三餐/喝水/模板/回顾 均可操作。
13. 游戏库/时间汇总/心愿单 均可操作。
14. 主题、每周起始日、首页摘要勾选设置刷新后保持。
15. 断网可用。
16. 无登录/注册入口。

---

## 7. 风险与对策

| 风险 | 对策 |
| --- | --- |
| 端口 3344 被占用 | server.js 检测端口占用并提示；启动器仍打开浏览器，若页面打不开提示换端口 |
| 数据文件写坏 | 原子写入（tmp+替换）+ 每次保存保留 backup + 启动时自动恢复 |
| 误删数据 | 所有删除前弹确认；数据与设置页提供导入恢复 |
| 中文乱码 | 所有文件 UTF-8；bat 文件开头加 `chcp 65001` |
| 服务被误关 | 页面内「保存失败」提示；README 说明如何重启 |
| 浏览器不兼容 | 目标浏览器为 Edge/Chrome，使用标准 API，避免新特性 |

---

## 8. 交付物清单

1. PRD.md（已有）
2. DEVELOPMENT_PLAN.md（本文件）
3. README.md（使用说明）
4. app/ 全套（server.js + 前端 + 数据目录）
5. 启动.bat、停止.bat