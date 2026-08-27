# eNook 品牌设计规范

> 本文件是 eNook 品牌与交互设计的唯一权威来源。任何 UI/交互变更必须同步更新此文件。

## 品牌标识

- **名称**：eNook
- **定位**：个人理财 + 健康管理 PWA
- **风格**：简洁、克制、C 端品质感

## 色板

| 变量 | 值 | 用途 |
|---|---|---|
| --accent | #6366f1 | 主色（Indigo），仅用于 active 态、主按钮、FAB、图表线 |
| --bg | #f5f6f8 | 页面背景 |
| --card | #ffffff | 卡片/浮层/Tabbar 表面 |
| --text | #1a1d26 | 主文字、金额数字 |
| --muted | #8a90a0 | 标签/次要文字/inactive tab |
| --line | #eceef2 | 边框/分割线 |
| --up | #e6413d | 涨/红（中国惯例），同 --danger |
| --down | #12b76a | 跌/绿 |
| --danger | #e6413d | 危险操作/删除 |

浅色辅助：#e5e7fd（active 背景/tint）、#e6f7ef（成功绿）、#fdecec（错误红）、#fff4e5（警告橙）

**色彩规则**：

- 金额数字用 `--text`（黑色），不用红绿
- 涨跌差异只在 diff 小字里用 `--up/--down`
- 左滑按钮用低饱和度：编辑 #94a3b8、删除 #c4928f

## 字体

- 系统默认字体栈（-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif）
- 正文 14px，标签 12px，标题 17px，输入框 16px（防 iOS 自动缩放）
- 数字金额 16px，bold

## Z-Index 层级（从低到高）

| 层 | z-index | 元素 |
|---|---|---|
| Pull-to-refresh | 5 | .ptr-indicator |
| FAB | 8 | .fab-trade / .fab-health |
| Sync bar | 9 | .sync-bar |
| Tabbar | 10 | #tabbar |
| Dropdown overlay | 150 | #dd-overlay |
| Topbar | 200 | #topbar（创建层叠上下文，内部子元素 z-index 只在内部生效） |
| Title dropdown | 200 | .title-wrap（在 topbar 内部，继承 topbar 的 200） |
| Modal overlay | 250 | .overlay |
| Toast | 300 | 动态 div |

**踩坑记录**：

- `#topbar` 有 z-index 会创建层叠上下文，内部子元素的 z-index 只在 topbar 内部生效
- `dd-overlay` 必须低于 topbar 的 z-index，否则遮罩盖住下拉选项
- Modal overlay 必须高于 topbar，否则浮层遮罩盖不住顶栏
- Tabbar z-index 必须 ≥ 10，否则被卡片列表遮挡

## 布局结构

```
body (max-width: 520px; margin: 0 auto)
  <header #topbar>          ← sticky, grid: 44px 1fr 44px
  <div #dd-overlay>         ← 标题下拉遮罩（display:none → .open 时 block）
  <div #sync-bar>
  <div #ptr-indicator>
  <main>                    ← padding: 0 12px; padding-bottom: calc(72px + safe-area)
    <section #view-assets>
    <section #view-trend>
    <section #view-trade>
    <section #view-health>
    <section #view-notes>
    <section #view-settings>
  </main>
  <nav #tabbar>             ← fixed bottom, 按 currentView 重渲染
  <div #modal-root>         ← 空容器，modal 动态注入
  <button #fab-trade>       ← fixed, 独立浮动
  <button #fab-health>      ← fixed, 独立浮动
  <button #fab-notes>       ← fixed, 独立浮动
```

## 组件规范

### Modal / Sheet

通过 `window._openModal(html)` / `window._closeModal()` 全局调用。

- **结构**：`.overlay`（fixed inset:0, rgba(0,0,0,.45), z-index:250）> `.sheet`（底部弹出, border-radius: 18px 18px 0 0, max-height: 80vh, overflow-y: auto, **overflow-x: hidden**）
- **scroll lock**：引用计数器，保存 scrollY → body position:fixed → 恢复。CSS 加 `touch-action: none`
- **关闭**：点击 overlay 背景 / 取消按钮 / Android 返回键（pushState + popstate）
- **sheet overflow-x 必须 hidden**，否则 date input 撑出横向滚动

### FAB

- **定位**：`position: fixed; bottom: calc(78px + safe-area); right: calc(50vw - 260px + 16px)`
- **响应式**：`@media (max-width: 540px) { right: 16px }`
- **尺寸**：52×52 圆形，accent 背景，白色 ＋
- **显隐**：每个模块有 `updateXxxFab()` 函数，在 switchView() 和 tab 切换时调用
- **滚动**：trade FAB 滚动时半透明 + 右移，150ms 后恢复
- **入口唯一**：一个页面只有一个 FAB，根据当前 tab 弹出不同浮层

### Tab 样式分类

| 类型 | 容器 | active 样式 | 场景 |
|---|---|---|---|
| 底部 Tabbar | #tabbar | accent + bold | 资产/趋势、体脂/运动 |
| 内容段控制 | .trade-tabs 圆角边框容器 | accent 填充背景 #e5e7fd | 记账本/账单/分析 |
| 浮层内 TAB | .modal-tabs 底边线 | accent + 下划线 2px | 手动输入/拍照识别 |

### 左滑卡片

- **结构**：`.trade-card-wrap`（relative, overflow:hidden）> `.trade-card-row`（relative）> `.trade-card`（z-index:2）+ `.trade-card-actions`（absolute, right:0, z-index:1）
- **动画**：touchmove 时直接 transform（无 transition），touchend 吸附到 -120px 或 0，阈值 30px
- **按钮**：低饱和度，宽 60px 每个
- **关闭**：document click 事件监听，点击 .trade-card-wrap 外部时关闭所有已滑开的卡片
- **禁用 flex-row 方案**：flex 并排在移动端 overflow 裁剪失效，按钮会常驻显示

### 标题下拉

- `.title-wrap` z-index: 200（高于 overlay 的 150），确保下拉框在遮罩之上
- `#dd-overlay` 作为透明遮罩捕获外部点击 → 关闭下拉
- **必须有 `.open { display: block }` CSS 规则**，否则遮罩永远不显示

### 表单

- `.form-row`：纵向排列，label + input
- `.form-two-col`：`grid-template-columns: 1fr 1fr; gap: 8px`，两个 form-row 并排
- **防溢出**：`.form-two-col > * { min-width: 0 }` + `.sheet { overflow-x: hidden }`
- input font-size: 16px（防止 iOS 自动缩放）
- 所有 `input/select` 全局 `display: block; width: 100%`
- `input[type="date"]` 额外加 `-webkit-appearance: none` 防止 WebKit 固有宽度限制
- 单独的 `.form-row`（如日期）必须和下方 `.form-two-col` 视觉上左右对齐
- 复选框 `.form-check input` 和筛选栏内用 `display: inline-block` 覆盖

### 日历网格

- `.cal-grid`：`repeat(7, 1fr); gap: 2px`
- 今日：#e5e7fd 背景；有运动：#e6f7ef 背景；两者叠加：#d4edda
- 运动日底部小圆点（accent 色，absolute 定位）
- 姨妈日历：经期日 #fecdd3、预测经期 #fff1f2、易孕期 #ecfccb、排卵日右上角绿色圆点(#84cc16)
- 今日 + 经期叠加：经期背景色 + 2px accent 边框

## 设计品质红线

以专业交互设计师、UI 设计师、产品经理的角度思考和设计 C 端界面。以下问题**不允许出现**：

- 控件对齐不一致（同类输入框宽度/边距必须统一）
- 浮层高度跳动（TAB 切换时 min-height 统一）
- 原生控件样式异常（date input 必须撑满、无右侧空白）
- 状态不一致（切视图再回来 tabbar 高亮必须正确）
- 事件丢失（内容刷新后按钮事件必须重绑）
- 空白屏无引导（空列表必须有引导文案）
- 点击区域过小（所有可点击元素 ≥ 44px）

## 检查清单

新增或修改 UI 前必须逐项检查：

- [ ] z-index 是否在层级表内？和已有层冲突吗？
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

## 版本同步（部署必做）

每次发版必须同步三个版本号：

1. `sw.js` → `VERSION = 'assetbook-YYYYMMDDHHmm'`
2. `ui.js` → `BUILD_ID = 'YYYYMMDDHHmm'`
3. `index.html` → 所有 `?v=` cache buster

然后 `git push main` + `gh api repos/jiangyichun21-hub/asset-book/pages/builds -X POST`
