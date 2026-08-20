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
notes.js        — 小记模块（笔记增删改查 + 搜索 + 标签 + 富文本）
sw.js           — Service Worker 缓存策略
```

## 设计规范

**完整品牌设计规范见 [DESIGN.md](./DESIGN.md)**，包含色板、Z-Index 层级、布局结构、组件规范、检查清单。任何 UI/交互变更必须同步更新 DESIGN.md。

以下为核心要点速查：

### 色板速查

| --accent | --bg | --card | --text | --muted | --line | --up | --down |
|---|---|---|---|---|---|---|---|
| #6366f1 | #f5f6f8 | #fff | #1a1d26 | #8a90a0 | #eceef2 | #e6413d | #12b76a |

金额数字用 `--text`（黑色），涨跌差异只在 diff 小字用 `--up/--down`。

### Z-Index 速查

FAB(8) < Tabbar(10) < dd-overlay(150) < Topbar(200) < Modal(250) < Toast(300)

`#topbar` 创建层叠上下文，内部子元素 z-index 只在 topbar 内部生效。

### 设计品质红线

以专业交互设计师、UI 设计师、产品经理的角度思考和设计 C 端界面。不允许出现控件对齐不一致、浮层高度跳动、原生控件样式异常、状态不一致、事件丢失、空白屏无引导、点击区域过小（≥ 44px）。

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

### 小记（view-notes）

- 顶部搜索栏：输入关键词实时过滤标题+正文
- 标签筛选：横向滚动 chips，「全部」+ 各标签，点击筛选
- 笔记卡片列表：标题 + 正文预览（2行截断）+ 标签色点 + 更新时间
- 左滑卡片：编辑（#94a3b8）+ 删除（#c4928f），阈值 30px，吸附 -120px
- 按 updatedAt 降序排列
- FAB 弹出新建/编辑浮层：标题输入 + 标签选择（已有标签 chips + 新建标签）+ 富文本编辑器
- 富文本：contenteditable + document.execCommand，支持加粗/列表/编号/标题
- 数据存储：`localStorage` 键 `assetbook.notes`（数组）/ `assetbook.noteTags`（字符串数组）
- Tabbar：只显示「小记」单 tab

### 设置（view-settings）

- 密码锁：设置/修改 4 位 PIN
- AI 服务：API Key 输入（可显隐切换）+ 保存
- 数据：手动备份到 Gist、手动导出 JSON、导入 JSON
- Gist 配置：Token + Gist ID
- 关于：版本号
