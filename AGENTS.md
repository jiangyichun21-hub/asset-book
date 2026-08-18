# eNook PWA 项目规范

> 个人项目，与工作无关。

## 项目概况

eNook 是一个无构建（no-build）的静态 PWA 个人理财 + 健康管理应用。
仓库：`jiangyichun21-hub/asset-book`，部署在 GitHub Pages。

## 部署流程

1. 代码改完直接 `git push origin main`
2. 触发 Pages 构建：`gh api repos/jiangyichun21-hub/asset-book/pages/builds -X POST`
3. 版本号三处必须同步：
   - `sw.js` → `VERSION = 'assetbook-YYYYMMDDHHmm'`
   - `ui.js` → `BUILD_ID = 'YYYYMMDDHHmm'`
   - `index.html` → 所有 `?v=` cache buster

## 文件结构

```
index.html      — 页面骨架、视图容器、脚本加载
styles.css      — 全部样式（无预处理器）
core.js         — 数据模型、状态管理、导入导出逻辑
gist.js         — Gist 云同步
ui.js           — 主 UI 渲染、路由、设置、备份恢复
trades.js       — 买卖记账模块
health.js       — 健康运动模块（体脂记录 + 运动日历）
sw.js           — Service Worker 缓存策略
```

## 色板

| 变量 | 值 | 用途 |
|---|---|---|
| --accent | #6366f1 | 主色（Indigo），仅 active 态、主按钮、FAB、图表线 |
| --bg | #f5f6f8 | 页面背景 |
| --card | #ffffff | 卡片/浮层/Tabbar 表面 |
| --text | #1a1d26 | 主文字、金额数字 |
| --muted | #8a90a0 | 标签/次要文字/inactive tab |
| --line | #eceef2 | 边框/分割线 |
| --up | #e6413d | 涨/红（中国惯例），同 --danger |
| --down | #12b76a | 跌/绿 |
| --danger | #e6413d | 危险操作/删除 |

辅助浅色：#e5e7fd（active 背景）、#e6f7ef（成功绿）、#fdecec（错误红）、#fff4e5（警告橙）

**规则**：金额数字用 `--text`（黑色），不用红绿。涨跌差异只在 diff 小字里用 `--up/--down`。左滑按钮用低饱和度：编辑 #94a3b8、删除 #c4928f。

## Z-Index 层级

| 层 | z-index | 元素 |
|---|---|---|
| Pull-to-refresh | 5 | .ptr-indicator |
| FAB | 8 | .fab-trade / .fab-health |
| Sync bar | 9 | .sync-bar |
| Tabbar | 10 | #tabbar |
| Dropdown overlay | 150 | #dd-overlay |
| Topbar | 200 | #topbar（创建层叠上下文） |
| Modal overlay | 250 | .overlay |
| Toast | 300 | 动态 div |

**注意**：`#topbar` 有 z-index 会创建层叠上下文，子元素 z-index 只在 topbar 内部生效。`dd-overlay(150)` 必须低于 `topbar(200)`，否则遮罩盖住下拉选项。`modal overlay(250)` 必须高于 topbar，否则浮层遮罩盖不住顶栏。改任一层级须检查全链。

## 布局结构

```
body (max-width: 520px; margin: 0 auto)
  <header #topbar>          ← sticky, grid: 44px 1fr 44px
  <div #dd-overlay>         ← 标题下拉遮罩
  <div #sync-bar>
  <div #ptr-indicator>
  <main>                    ← padding: 0 12px; bottom: calc(72px + safe-area)
    <section #view-assets / view-trend / view-trade / view-health / view-settings>
  </main>
  <nav #tabbar>             ← fixed bottom, 按 currentView 动态重渲染
  <div #modal-root>         ← 空容器，modal 动态注入
  <button #fab-trade>       ← fixed, 独立浮动
  <button #fab-health>      ← fixed, 独立浮动
```

## Modal / Sheet 系统

通过 `window._openModal(html)` / `window._closeModal()` 全局调用。

- 结构：`.overlay`（fixed inset:0, rgba(0,0,0,.45), z-index:250）> `.sheet`（底部弹出, border-radius: 18px 18px 0 0, max-height: 80vh, overflow-y: auto, **overflow-x: hidden**）
- scroll lock：引用计数器，保存 scrollY → body position:fixed → 恢复
- 关闭：点击 overlay 背景 / 取消按钮 / Android 返回键（pushState + popstate）
- **sheet overflow-x 必须 hidden**，否则 date input 撑出横向滚动

## FAB 规范

- 定位：`position: fixed; bottom: calc(78px + safe-area); right: calc(50vw - 260px + 16px)`
- 响应式：`@media (max-width: 540px) { right: 16px }`
- 尺寸：52x52 圆形，accent 背景，白色 ＋
- 每个模块有 `updateXxxFab()` 函数，在 `switchView()` 和 tab 切换时都要调用
- 一个页面只有一个 FAB，根据当前 tab 弹出不同浮层

## 添加记录入口原则

- 统一用右下角 FAB，不要在页面内放多个添加入口按钮
- 同类操作（手动输入 + 拍照识别）合并为一个浮层，顶部 TAB 切换
- FAB 根据当前 tab/视图决定弹什么内容

## Tab 样式分类

| 类型 | 容器 | active 样式 |
|---|---|---|
| 底部 Tabbar | #tabbar | accent + bold |
| 内容段控制 | .trade-tabs 圆角边框 | accent 填充背景 #e5e7fd |
| 浮层内 TAB | .modal-tabs 底边线 | accent + 下划线 2px |

## 左滑卡片

- 结构：`.trade-card-wrap`（relative, overflow:hidden）> `.trade-card-row`（relative）> `.trade-card`（z-index:2）+ `.trade-card-actions`（absolute, right:0, z-index:1）
- 动画：touchmove 时直接 transform（无 transition），touchend 吸附 -120px 或 0，阈值 30px
- **禁用 flex-row 方案**：flex 并排在移动端 overflow 裁剪失效，按钮会常驻显示
- 点击 .trade-card-wrap 外部时关闭所有已滑开的卡片

## 表单布局

- `.form-row`：纵向 label + input
- `.form-two-col`：`grid-template-columns: 1fr 1fr; gap: 8px`
- 防溢出：`.form-two-col > * { min-width: 0 }` + `.sheet { overflow-x: hidden }`
- input font-size: 16px（防止 iOS 自动缩放）

## 标题下拉

- `.title-wrap` 在 topbar 内部，topbar z-index: 200
- `#dd-overlay` z-index: 150 捕获外部点击
- overlay 必须有 `.open { display: block }` CSS 规则

## 交互检查清单

新增或修改 UI 前过一遍：

- [ ] z-index 在层级表内吗？和已有层冲突吗？
- [ ] 有 overlay/遮罩吗？有 `.open { display: block }` 吗？
- [ ] FAB 显隐逻辑在 switchView 和 tab 切换时都调了吗？
- [ ] 浮层内表单 overflow-x: hidden 加了吗？
- [ ] 添加记录入口是否唯一？有没有多余的内联按钮？
- [ ] 金额/数字颜色用的 --text 而非红绿？
- [ ] input/select 是否 display:block + width:100% 撑满容器？
- [ ] 日期选择器等原生控件在 iOS 上是否撑满、无右侧空白？
- [ ] 浮层 TAB 切换时高度是否稳定（min-height 统一）？
- [ ] 视图切换再回来时，tabbar 高亮和内容状态是否一致？
- [ ] 日历/列表导航按钮事件在内容刷新后是否重新绑定？
- [ ] 间距一致性：同类元素 margin/padding 是否统一？
- [ ] 空状态有没有引导文案（"点右下角 ＋ 添加"）？
- [ ] 点击区域是否足够大（≥ 44px）？
- [ ] 版本号三处都同步了吗？

## AI 服务

- API Key 统一存 `state.settings.aiKey`（设置页「AI 服务」卡片）
- 其他模块通过 `window._getAiKey()` 读取，未填则 fallback 到内置默认值
- 当前用途：体脂报告拍照识别（qwen-vl-max via dashscope.aliyuncs.com）

## 数据存储

- 主数据：`localStorage` 键 `assetbook.v1`（Core 管理）
- 健康数据：`localStorage` 键 `assetbook.health.body` / `assetbook.health.exercise`（Health 模块独立管理）
- 备份格式 v2：包含 accounts、snapshots、settings、trades、health、healthExer 字段
- 云同步：Gist（通过 gist.js）

## 模块功能详述

### 资产管理（view-assets）

- 账户列表，支持分组（银行/基金/其他）
- 点账户卡片可编辑余额、查看详情、归档
- 盘点模式：按顺序逐个更新余额
- 顶部总资产/负债/净资产汇总
- Tabbar：资产 | ＋ | 趋势

### 趋势（view-trend）

- SVG 折线图，支持 7天/30天/90天/全部 切换
- 可下钻到单个账户

### 买卖记账（view-trade）

- 三个子 tab：交易流水 / 营销账单 / 数据分析
- 交易流水：商品名、买家、订单号、买入价、卖出价、差价、利润、平台、发货/回款状态
- 筛选栏可折叠：商品名/买家/订单号搜索、发货状态、回款状态、平台、日期范围
- 营销账单：营销费用和大壮还款分开统计
- 数据分析：Chart.js 折线图，支持 7/14/30/全部天 + 6 种指标切换
- 左滑卡片：编辑 + 删除
- FAB 弹出新增交易表单
- Tabbar：记账 | ＋ | 分析（子 tab 控制）

### 健康运动（view-health）

- 两个子 tab：体脂记录 / 运动日历
- **体脂记录**：
  - 卡片列表，显示日期 + 核心指标（体重/体脂率/肌肉量/BMI/基础代谢/内脏脂肪）
  - 左滑编辑/删除
  - FAB 弹出带 TAB 的浮层：手动输入 | 拍照识别
  - 拍照识别调用 qwen-vl-max OCR，上传体脂秤照片自动填表
  - 可选指标折叠在 `<details>` 里（水分/蛋白质/无机盐/骨量/体年龄/皮下脂肪）
- **运动日历**：
  - 月历网格，运动日用 accent 色圆点标记
  - 点击日期弹出运动记录表单（运动类型 + 时长 + 备注）
  - 左右箭头切换月份
  - 标题可点击弹年月选择器
  - 日历内容刷新后事件必须重新绑定（`bindCalEvents()` + `refreshExercise()`）
- Tabbar：体脂记录 | 运动日历
- 数据存储：`assetbook.health.body`（数组）/ `assetbook.health.exercise`（数组）

### 设置（view-settings）

- 密码锁：设置/修改 4 位 PIN
- AI 服务：API Key 输入（可显隐切换）+ 保存
- 数据：手动备份到 Gist、手动导出 JSON、导入 JSON
- Gist 配置：Token + Gist ID
- 关于：版本号

## 设计规范

### 设计品质要求

以专业交互设计师、UI 设计师、产品经理的角度思考和设计 C 端界面。不允许出现：

- 控件对齐不一致（同类输入框宽度/边距必须统一）
- 浮层高度跳动（TAB 切换时 min-height 统一）
- 原生控件样式异常（date input 必须撑满、无右侧空白）
- 状态不一致（切视图再回来 tabbar 高亮必须正确）
- 事件丢失（内容刷新后按钮事件必须重绑）

### 表单对齐规范

- 所有 `input` / `select` 全局 `display: block; width: 100%`
- `input[type="date"]` 额外加 `-webkit-appearance: none` 防止 WebKit 固有宽度限制
- `.form-two-col` 内用 grid 两列等宽，`min-width: 0` 防溢出
- 单独的 `.form-row`（如日期）必须和下方 `.form-two-col` 视觉上左右对齐
- 复选框 `.form-check input` 和筛选栏 `.trade-filter-row` 内用 `display: inline-block` 覆盖

### 空状态设计

- 每个空列表必须有引导文案，如"点右下角 ＋ 添加记录"
- 不要留白屏

### 点击区域

- 所有可点击元素最小 44px 高
- 日历日期格子、tab 按钮、导航箭头都要保证足够大的触控区
