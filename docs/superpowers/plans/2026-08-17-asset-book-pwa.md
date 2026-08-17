# 资产本（asset-book）PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个零成本的个人资产盘点 PWA：记录各账户余额快照、自动计算总资产、SVG 趋势图、GitHub Gist 自动加密备份，部署到 GitHub Pages。

**Architecture:** 无构建静态多文件（index.html + styles.css + core.js + ui.js + gist.js + sw.js + manifest.json + icons/）。core.js 与 gist.js 为纯逻辑模块（UMD 风格导出），可在 Node 中用 `node --test` 做单元测试；ui.js 负责 DOM 渲染与 localStorage 持久化；Service Worker 提供离线缓存与静默更新。

**Tech Stack:** 原生 JS（无框架无依赖）、localStorage、WebCrypto（PBKDF2 + AES-GCM）、GitHub Gist API、GitHub Pages、node:test（Node v24）。

**项目路径:** `/Users/jiangyichun/.qoderwork/projects/asset-book`（独立新仓库，无需 worktree）
**线上地址:** `https://jiangyichun21-hub.github.io/asset-book/`

**前置条件（执行 Task 12 前确认）:**
- `gh auth status` 当前显示 keyring token 失效。部署前需要用户执行 `gh auth login -h github.com --web` 重新登录。Task 1-11 均为本地操作，不受影响。

**数据形状（全局约定，所有任务保持一致）:**

```js
// state（localStorage key: 'assetbook.v1'，整体 JSON 序列化）
{
  schema: 1,
  groups:    [{ id, name, order }],
  accounts:  [{ id, name, groupId, icon, color, order, archived, createdAt }],
  snapshots: [{ id, accountId, balance, at }],   // at 为毫秒时间戳
  settings:  { hideAmounts, gistToken, gistId, passphrase,
               lastBackupAt, lastBackupStatus, lastExportAt },
  createdAt
}
```

派生规则：账户当前余额 = 最新快照余额；总资产 = 未归档账户当前余额之和；趋势 = 每日各账户最后一条快照结转求和。

---

### Task 1: 项目脚手架与文档入库

**Files:**
- Create: `README.md`, `.gitignore`
- Create: `docs/superpowers/specs/2026-08-17-asset-book-design.md`（从 outputs 复制产品方案）

- [ ] **Step 1: 创建目录与 git 仓库**

```bash
mkdir -p /Users/jiangyichun/.qoderwork/projects/asset-book/docs/superpowers/specs /Users/jiangyichun/.qoderwork/projects/asset-book/docs/superpowers/plans
cd /Users/jiangyichun/.qoderwork/projects/asset-book && git init -b main
```

- [ ] **Step 2: 写入 README.md 与 .gitignore**

`README.md`:

```markdown
# 资产本 asset-book

个人资产盘点 PWA。记录各账户余额快照，自动计算总资产，查看资产趋势。

- 线上地址：https://jiangyichun21-hub.github.io/asset-book/
- 数据存储：手机本地 localStorage，不经过任何服务器
- 备份：GitHub 私有 Gist 自动备份（可选口令加密）+ JSON 手动导出
- 测试：`node --test tests/`
- 本地预览：`python3 -m http.server 8899` 后打开 http://localhost:8899
```

`.gitignore`:

```
.DS_Store
node_modules/
```

- [ ] **Step 3: 复制产品方案与本计划入仓**

```bash
cp "/Users/jiangyichun/.qoderwork/workspace/mswnghc5ioakggbn/outputs/2026-08-17-资产记账PWA产品方案.md" docs/superpowers/specs/2026-08-17-asset-book-design.md
```

（本计划文件已在 `docs/superpowers/plans/2026-08-17-asset-book-pwa.md`）

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: 项目脚手架与设计文档"
```

---

### Task 2: core.js — 状态模型与派生计算（TDD）

**Files:**
- Create: `core.js`
- Test: `tests/core.test.js`

- [ ] **Step 1: 写失败测试**

`tests/core.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Core = require('../core.js');

test('初始状态包含 5 个默认分组', () => {
  const s = Core.createInitialState();
  assert.deepStrictEqual(s.groups.map(g => g.name), ['现金', '银行卡', '支付平台', '公积金', '投资']);
  assert.strictEqual(s.schema, 1);
});

test('添加账户并记录快照后，当前余额取最新一条', () => {
  const s = Core.createInitialState();
  const a = Core.addAccount(s, { name: '招商银行', groupId: s.groups[1].id });
  Core.addSnapshot(s, a.id, 100, 1000);
  Core.addSnapshot(s, a.id, 250.5, 2000);
  assert.strictEqual(Core.currentBalance(s, a.id), 250.5);
  assert.strictEqual(Core.totalAssets(s), 250.5);
  assert.strictEqual(Core.lastUpdatedAt(s, a.id), 2000);
});

test('归档账户不计入总资产，恢复后重新计入', () => {
  const s = Core.createInitialState();
  const a = Core.addAccount(s, { name: 'A', groupId: s.groups[0].id });
  const b = Core.addAccount(s, { name: 'B', groupId: s.groups[0].id });
  Core.addSnapshot(s, a.id, 100, 1000);
  Core.addSnapshot(s, b.id, 50, 1000);
  Core.setArchived(s, b.id, true);
  assert.strictEqual(Core.totalAssets(s), 100);
  Core.setArchived(s, b.id, false);
  assert.strictEqual(Core.totalAssets(s), 150);
});

test('非法余额与非法账户报错', () => {
  const s = Core.createInitialState();
  const a = Core.addAccount(s, { name: 'A', groupId: s.groups[0].id });
  assert.throws(() => Core.addSnapshot(s, a.id, 'abc'), /余额/);
  assert.throws(() => Core.addSnapshot(s, a.id, -1), /余额/);
  assert.throws(() => Core.addSnapshot(s, 'nope', 10), /账户/);
  assert.throws(() => Core.addAccount(s, { name: '', groupId: s.groups[0].id }), /账户名/);
  assert.throws(() => Core.addAccount(s, { name: 'X', groupId: 'nope' }), /分组/);
});

test('删除快照后余额回退', () => {
  const s = Core.createInitialState();
  const a = Core.addAccount(s, { name: 'A', groupId: s.groups[0].id });
  Core.addSnapshot(s, a.id, 100, 1000);
  const s2 = Core.addSnapshot(s, a.id, 999, 2000);
  Core.deleteSnapshot(s, s2.id);
  assert.strictEqual(Core.currentBalance(s, a.id), 100);
});

test('分组小计与分组约束', () => {
  const s = Core.createInitialState();
  const g = s.groups[0];
  const a = Core.addAccount(s, { name: 'A', groupId: g.id });
  Core.addSnapshot(s, a.id, 88.88, 1000);
  assert.strictEqual(Core.groupSubtotal(s, g.id), 88.88);
  assert.throws(() => Core.deleteGroup(s, g.id), /账户/);       // 分组下有账户不能删
  const g2 = Core.addGroup(s, '新分组');
  Core.deleteGroup(s, g2.id);                                    // 空分组可删
  assert.ok(!s.groups.some(x => x.id === g2.id));
  assert.throws(() => Core.addGroup(s, '现金'), /已存在/);       // 重名拒绝
});
```

- [ ] **Step 2: 运行确认失败**

```bash
cd /Users/jiangyichun/.qoderwork/projects/asset-book && node --test tests/
```

Expected: FAIL（Cannot find module '../core.js'）

- [ ] **Step 3: 实现 core.js**

`core.js`:

```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Core = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const SCHEMA = 1;
  const DAY = 86400000;
  const DEFAULT_GROUPS = ['现金', '银行卡', '支付平台', '公积金', '投资'];

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function round2(n) { return Math.round(n * 100) / 100; }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function createInitialState(now) {
    now = now || Date.now();
    return {
      schema: SCHEMA,
      groups: DEFAULT_GROUPS.map((name, i) => ({ id: uid() + i, name, order: i })),
      accounts: [],
      snapshots: [],
      settings: { hideAmounts: false, gistToken: '', gistId: '', passphrase: '',
                  lastBackupAt: 0, lastBackupStatus: '', lastExportAt: 0 },
      createdAt: now
    };
  }

  // ---------- 分组 ----------
  function addGroup(state, name) {
    name = String(name || '').trim();
    if (!name) throw new Error('分组名不能为空');
    if (state.groups.some(g => g.name === name)) throw new Error('分组已存在');
    const g = { id: uid(), name, order: state.groups.length };
    state.groups.push(g);
    return g;
  }
  function renameGroup(state, id, name) {
    name = String(name || '').trim();
    if (!name) throw new Error('分组名不能为空');
    const g = state.groups.find(x => x.id === id);
    if (!g) throw new Error('分组不存在');
    g.name = name;
    return g;
  }
  function deleteGroup(state, id) {
    if (state.accounts.some(a => a.groupId === id)) throw new Error('分组下还有账户，不能删除');
    state.groups = state.groups.filter(g => g.id !== id);
  }

  // ---------- 账户 ----------
  function addAccount(state, opts) {
    const name = String((opts && opts.name) || '').trim();
    if (!name) throw new Error('账户名不能为空');
    if (!state.groups.some(g => g.id === opts.groupId)) throw new Error('分组不存在');
    const a = { id: uid(), name, groupId: opts.groupId, icon: opts.icon || '💰',
                color: opts.color || '#4f6ef7', order: state.accounts.length,
                archived: false, createdAt: Date.now() };
    state.accounts.push(a);
    return a;
  }
  function updateAccount(state, id, patch) {
    const a = state.accounts.find(x => x.id === id);
    if (!a) throw new Error('账户不存在');
    if (patch.name !== undefined) {
      const name = String(patch.name).trim();
      if (!name) throw new Error('账户名不能为空');
      a.name = name;
    }
    if (patch.groupId !== undefined) {
      if (!state.groups.some(g => g.id === patch.groupId)) throw new Error('分组不存在');
      a.groupId = patch.groupId;
    }
    if (patch.icon !== undefined) a.icon = patch.icon;
    if (patch.color !== undefined) a.color = patch.color;
    return a;
  }
  function setArchived(state, id, archived) {
    const a = state.accounts.find(x => x.id === id);
    if (!a) throw new Error('账户不存在');
    a.archived = !!archived;
    return a;
  }
  function activeAccounts(state) {
    return state.accounts.filter(a => !a.archived).sort((x, y) => x.order - y.order);
  }

  // ---------- 快照 ----------
  function addSnapshot(state, accountId, balance, at) {
    balance = Number(balance);
    if (!isFinite(balance) || balance < 0) throw new Error('余额必须是不小于 0 的数字');
    if (!state.accounts.some(a => a.id === accountId)) throw new Error('账户不存在');
    const s = { id: uid(), accountId, balance: round2(balance), at: at || Date.now() };
    state.snapshots.push(s);
    return s;
  }
  function deleteSnapshot(state, id) { state.snapshots = state.snapshots.filter(s => s.id !== id); }
  function snapshotsOf(state, accountId) {
    return state.snapshots.filter(s => s.accountId === accountId).sort((x, y) => x.at - y.at);
  }
  function latestSnapshot(state, accountId) {
    const list = snapshotsOf(state, accountId);
    return list.length ? list[list.length - 1] : null;
  }
  function currentBalance(state, accountId) { const s = latestSnapshot(state, accountId); return s ? s.balance : 0; }
  function lastUpdatedAt(state, accountId) { const s = latestSnapshot(state, accountId); return s ? s.at : 0; }
  function totalAssets(state) {
    return round2(activeAccounts(state).reduce((sum, a) => sum + currentBalance(state, a.id), 0));
  }
  function groupSubtotal(state, groupId) {
    return round2(activeAccounts(state).filter(a => a.groupId === groupId)
      .reduce((sum, a) => sum + currentBalance(state, a.id), 0));
  }

  return {
    SCHEMA, DEFAULT_GROUPS, uid, round2, pad,
    createInitialState,
    addGroup, renameGroup, deleteGroup,
    addAccount, updateAccount, setArchived, activeAccounts,
    addSnapshot, deleteSnapshot, snapshotsOf, latestSnapshot,
    currentBalance, lastUpdatedAt, totalAssets, groupSubtotal
  };
});
```

（注意：Task 3、4 会往这个 UMD 工厂里追加函数并扩展 return 导出，文件结构保持不变。）

- [ ] **Step 4: 运行确认通过**

```bash
node --test tests/
```

Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add core.js tests/core.test.js && git commit -m "feat: 核心状态模型与派生计算（分组/账户/快照/总资产）"
```

---

### Task 3: core.js — 趋势计算与 SVG 路径（TDD）

**Files:**
- Modify: `core.js`（在 return 之前追加函数，并把新函数加入 return 导出）
- Modify: `tests/core.test.js`（追加测试）

- [ ] **Step 1: 追加失败测试**

在 `tests/core.test.js` 末尾追加：

```js
test('dailySeries 按日取最后值并向后结转', () => {
  const s = Core.createInitialState();
  const a = Core.addAccount(s, { name: 'A', groupId: s.groups[0].id });
  const b = Core.addAccount(s, { name: 'B', groupId: s.groups[0].id });
  const d1 = new Date(2026, 0, 1, 12).getTime();
  const d2 = new Date(2026, 0, 2, 12).getTime();
  const d3 = new Date(2026, 0, 3, 12).getTime();
  Core.addSnapshot(s, a.id, 100, d1);
  Core.addSnapshot(s, a.id, 120, d1 + 3600000);  // 同日多条取最后
  Core.addSnapshot(s, b.id, 50, d2);
  Core.addSnapshot(s, a.id, 200, d3);
  const series = Core.dailySeries(s, { now: d3 });
  assert.deepStrictEqual(series.map(p => p.total), [120, 170, 250]);
  assert.strictEqual(series[0].day, '2026-01-01');
  const one = Core.dailySeries(s, { accountId: a.id, now: d3 });
  assert.deepStrictEqual(one.map(p => p.total), [120, 120, 200]);
  const recent = Core.dailySeries(s, { days: 2, now: d3 });
  assert.deepStrictEqual(recent.map(p => p.total), [170, 250]);
  assert.deepStrictEqual(Core.dailySeries(Core.createInitialState(), {}), []);
});

test('rangeStats 计算涨跌', () => {
  assert.deepStrictEqual(Core.rangeStats([{ total: 100 }, { total: 150 }]),
    { start: 100, end: 150, diff: 50, pct: 50 });
  assert.strictEqual(Core.rangeStats([{ total: 0 }, { total: 10 }]).pct, null);
  assert.strictEqual(Core.rangeStats([]), null);
});

test('svgPath 生成折线路径', () => {
  const d = Core.svgPath([{ total: 0 }, { total: 10 }], 100, 50, 0);
  assert.strictEqual(d, 'M0.0 50.0 L100.0 0.0');
  assert.strictEqual(Core.svgPath([], 100, 50), '');
  assert.ok(Core.svgPath([{ total: 5 }], 100, 50, 0).startsWith('M50'));  // 单点居中
});
```

- [ ] **Step 2: 运行确认失败**

```bash
node --test tests/
```

Expected: 新增 3 个测试 FAIL（dailySeries is not a function）

- [ ] **Step 3: 实现（core.js 的 return 前追加，并将三个函数名加入 return 对象）**

```js
  // ---------- 趋势 ----------
  function startOfDay(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function dayKey(ts) { const d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function dailySeries(state, opts) {
    opts = opts || {};
    const now = opts.now || Date.now();
    const days = opts.days || 0;
    const accts = opts.accountId
      ? state.accounts.filter(a => a.id === opts.accountId)
      : activeAccounts(state);
    const ids = {};
    accts.forEach(a => { ids[a.id] = true; });
    const snaps = state.snapshots.filter(s => ids[s.accountId]).sort((a, b) => a.at - b.at);
    if (!snaps.length) return [];
    const end = startOfDay(now);
    let start = startOfDay(snaps[0].at);
    if (days > 0 && end - (days - 1) * DAY > start) start = end - (days - 1) * DAY;
    const series = [];
    for (let t = start; t <= end; t += DAY) {
      let total = 0;
      for (const a of accts) {
        let bal = 0;
        for (const s of snaps) {
          if (s.accountId !== a.id) continue;
          if (s.at < t + DAY) bal = s.balance; else break;
        }
        total += bal;
      }
      series.push({ day: dayKey(t), t, total: round2(total) });
    }
    return series;
  }

  function rangeStats(series) {
    if (!series || !series.length) return null;
    const start = series[0].total, end = series[series.length - 1].total;
    const diff = round2(end - start);
    const pct = start !== 0 ? round2(diff / start * 100) : null;
    return { start, end, diff, pct };
  }

  function svgPath(series, w, h, padding) {
    if (!series || !series.length) return '';
    const p = padding === undefined ? 4 : padding;
    const vals = series.map(x => x.total);
    const min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    const span = (max - min) || 1;
    const n = series.length;
    return series.map((pt, i) => {
      const x = n === 1 ? w / 2 : p + (w - 2 * p) * i / (n - 1);
      const y = p + (h - 2 * p) * (1 - (pt.total - min) / span);
      return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }).join(' ');
  }
```

return 对象追加：`dailySeries, rangeStats, svgPath, startOfDay, dayKey`。

- [ ] **Step 4: 运行确认全部通过**

```bash
node --test tests/
```

Expected: 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add core.js tests/core.test.js && git commit -m "feat: 每日结转趋势序列、区间涨跌与 SVG 折线路径"
```

---

### Task 4: core.js — 导出/导入与加密（TDD）

**Files:**
- Modify: `core.js`（return 前追加，导出新函数）
- Modify: `tests/core.test.js`（追加测试）

- [ ] **Step 1: 追加失败测试**

```js
test('导出导入 roundtrip', () => {
  const s = Core.createInitialState();
  const a = Core.addAccount(s, { name: 'A', groupId: s.groups[0].id });
  Core.addSnapshot(s, a.id, 100, 1000);
  const restored = Core.importData(Core.exportData(s));
  assert.deepStrictEqual(restored, s);
  assert.throws(() => Core.importData('{"foo":1}'), /有效/);
  assert.throws(() => Core.importData('{"app":"asset-book","data":{}}'), /损坏/);
});

test('加密解密 roundtrip，错误口令报错', async () => {
  const ct = await Core.encryptText('机密数据', '口令123');
  assert.notStrictEqual(ct, '机密数据');
  assert.strictEqual(JSON.parse(ct).enc, 'v1');
  assert.strictEqual(await Core.decryptText(ct, '口令123'), '机密数据');
  await assert.rejects(Core.decryptText(ct, '错误口令'));
});
```

- [ ] **Step 2: 运行确认失败**

```bash
node --test tests/
```

Expected: 新增 2 个测试 FAIL

- [ ] **Step 3: 实现（core.js 的 return 前追加，导出 exportData/importData/encryptText/decryptText）**

```js
  // ---------- 导出/导入 ----------
  function exportData(state) {
    return JSON.stringify({ app: 'asset-book', version: SCHEMA, exportedAt: Date.now(), data: state }, null, 2);
  }
  function importData(json) {
    const obj = typeof json === 'string' ? JSON.parse(json) : json;
    if (!obj || obj.app !== 'asset-book' || !obj.data) throw new Error('不是有效的资产本备份数据');
    const d = obj.data;
    if (!Array.isArray(d.groups) || !Array.isArray(d.accounts) || !Array.isArray(d.snapshots) || !d.settings)
      throw new Error('备份数据结构损坏');
    return d;
  }

  // ---------- 加密（WebCrypto：PBKDF2 + AES-GCM）----------
  const te = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  const td = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;
  function bufToB64(buf) {
    const b = new Uint8Array(buf); let s = '';
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }
  function b64ToBuf(str) {
    const bin = atob(str); const b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b;
  }
  async function deriveKey(passphrase, salt) {
    const km = await crypto.subtle.importKey('raw', te.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
      km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encryptText(plain, passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(passphrase, salt);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(plain));
    return JSON.stringify({ enc: 'v1', salt: bufToB64(salt), iv: bufToB64(iv), ct: bufToB64(ct) });
  }
  async function decryptText(payload, passphrase) {
    const o = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (o.enc !== 'v1') throw new Error('未知加密格式');
    const key = await deriveKey(passphrase, b64ToBuf(o.salt));
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBuf(o.iv) }, key, b64ToBuf(o.ct));
    return td.decode(pt);
  }
```

- [ ] **Step 4: 运行确认全部通过**

```bash
node --test tests/
```

Expected: 11 tests PASS

- [ ] **Step 5: Commit**

```bash
git add core.js tests/core.test.js && git commit -m "feat: 备份导出导入与 AES-GCM 口令加密"
```

---

### Task 5: gist.js — Gist 备份客户端（TDD）

**Files:**
- Create: `gist.js`
- Test: `tests/gist.test.js`

- [ ] **Step 1: 写失败测试**

`tests/gist.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Gist = require('../gist.js');

function seqFetch(responses) {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts: opts || {} });
    const r = responses.shift();
    return { ok: r.status < 400, status: r.status,
             json: async () => r.json || {}, text: async () => r.text || '' };
  };
  return { calls, fetchImpl };
}

test('pushBackup 无 gistId 时创建私有 Gist', async () => {
  const { calls, fetchImpl } = seqFetch([{ status: 201, json: { id: 'g123' } }]);
  const id = await Gist.pushBackup({ token: 't', gistId: '', content: '{}', fetchImpl });
  assert.strictEqual(id, 'g123');
  assert.strictEqual(calls[0].opts.method, 'POST');
  assert.ok(calls[0].url.endsWith('/gists'));
  const body = JSON.parse(calls[0].opts.body);
  assert.strictEqual(body.public, false);
  assert.ok(body.files['asset-book-backup.json']);
});

test('pushBackup 有 gistId 时 PATCH 更新', async () => {
  const { calls, fetchImpl } = seqFetch([{ status: 200, json: { id: 'g123' } }]);
  const id = await Gist.pushBackup({ token: 't', gistId: 'g123', content: '{}', fetchImpl });
  assert.strictEqual(id, 'g123');
  assert.strictEqual(calls[0].opts.method, 'PATCH');
  assert.ok(calls[0].url.endsWith('/gists/g123'));
});

test('pushBackup 更新遇 404 时自动重建', async () => {
  const { calls, fetchImpl } = seqFetch([{ status: 404 }, { status: 201, json: { id: 'new1' } }]);
  const id = await Gist.pushBackup({ token: 't', gistId: 'gone', content: '{}', fetchImpl });
  assert.strictEqual(id, 'new1');
  assert.strictEqual(calls.length, 2);
});

test('pushBackup 其他错误直接抛出', async () => {
  const { fetchImpl } = seqFetch([{ status: 401 }]);
  await assert.rejects(Gist.pushBackup({ token: 'bad', gistId: 'g1', content: '{}', fetchImpl }), /401/);
});

test('fetchBackup 读取备份内容', async () => {
  const { fetchImpl } = seqFetch([{ status: 200, json: { files: { 'asset-book-backup.json': { content: 'DATA' } } } }]);
  assert.strictEqual(await Gist.fetchBackup('t', 'g123', fetchImpl), 'DATA');
});
```

- [ ] **Step 2: 运行确认失败**

```bash
node --test tests/gist.test.js
```

Expected: FAIL（Cannot find module '../gist.js'）

- [ ] **Step 3: 实现 gist.js**

`gist.js`:

```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Gist = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const FILE = 'asset-book-backup.json';
  const API = 'https://api.github.com';

  function headers(token) {
    return { 'Authorization': 'Bearer ' + token,
             'Accept': 'application/vnd.github+json',
             'Content-Type': 'application/json' };
  }
  async function createBackup(token, content, fetchImpl) {
    const f = fetchImpl || fetch;
    const res = await f(API + '/gists', { method: 'POST', headers: headers(token),
      body: JSON.stringify({ description: 'asset-book 资产本自动备份', public: false,
                             files: { [FILE]: { content } } }) });
    if (!res.ok) throw new Error('创建 Gist 失败: HTTP ' + res.status);
    return (await res.json()).id;
  }
  async function updateBackup(token, gistId, content, fetchImpl) {
    const f = fetchImpl || fetch;
    const res = await f(API + '/gists/' + gistId, { method: 'PATCH', headers: headers(token),
      body: JSON.stringify({ files: { [FILE]: { content } } }) });
    if (res.status === 404) { const e = new Error('Gist 不存在'); e.notFound = true; throw e; }
    if (!res.ok) throw new Error('更新 Gist 失败: HTTP ' + res.status);
    return gistId;
  }
  async function fetchBackup(token, gistId, fetchImpl) {
    const f = fetchImpl || fetch;
    const res = await f(API + '/gists/' + gistId, { headers: headers(token) });
    if (!res.ok) throw new Error('读取 Gist 失败: HTTP ' + res.status);
    const j = await res.json();
    const file = j.files && j.files[FILE];
    if (!file) throw new Error('Gist 中没有备份文件');
    if (file.truncated) {
      const r2 = await f(file.raw_url, { headers: { 'Authorization': 'Bearer ' + token } });
      return r2.text();
    }
    return file.content;
  }
  async function pushBackup(opts) {
    if (!opts.gistId) return createBackup(opts.token, opts.content, opts.fetchImpl);
    try { return await updateBackup(opts.token, opts.gistId, opts.content, opts.fetchImpl); }
    catch (e) { if (e.notFound) return createBackup(opts.token, opts.content, opts.fetchImpl); throw e; }
  }
  return { FILE, createBackup, updateBackup, fetchBackup, pushBackup };
});
```

- [ ] **Step 4: 运行确认全部通过**

```bash
node --test tests/
```

Expected: 16 tests PASS

- [ ] **Step 5: Commit**

```bash
git add gist.js tests/gist.test.js && git commit -m "feat: Gist 备份客户端（创建/更新/读取/404 自动重建）"
```

---

### Task 6: 页面骨架 — index.html + styles.css + ui.js 基础渲染

UI 层不写单测，通过本地浏览器手动验收（Task 13 有完整验收清单）。

**Files:**
- Create: `index.html`, `styles.css`, `ui.js`

- [ ] **Step 1: 写 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<title>资产本</title>
<meta name="theme-color" content="#f5f6f8">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="资产本">
<link rel="manifest" href="./manifest.json">
<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png">
<link rel="stylesheet" href="./styles.css">
</head>
<body>
<header id="topbar">
  <button id="btn-settings" class="icon-btn" title="设置">⚙️</button>
  <h1 id="title">资产</h1>
  <div class="topbar-right">
    <span id="backup-badge" class="badge"></span>
    <button id="btn-eye" class="icon-btn" title="隐藏金额">👁</button>
  </div>
</header>
<main>
  <section id="view-assets" class="view"></section>
  <section id="view-trend" class="view hidden"></section>
  <section id="view-settings" class="view hidden"></section>
</main>
<nav id="tabbar">
  <button data-tab="assets" class="tab active">资产</button>
  <button id="btn-add" class="fab" title="添加账户">＋</button>
  <button data-tab="trend" class="tab">趋势</button>
</nav>
<div id="modal-root"></div>
<script src="./core.js"></script>
<script src="./gist.js"></script>
<script src="./ui.js"></script>
<script>if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');</script>
</body>
</html>
```

- [ ] **Step 2: 写 styles.css**

```css
:root {
  --bg: #f5f6f8; --card: #ffffff; --text: #1a1d26; --muted: #8a90a0;
  --accent: #4f6ef7; --up: #e6413d; --down: #12b76a; --line: #eceef2;
  --danger: #e6413d;
}
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
html, body { background: var(--bg); color: var(--text);
  font: 16px/1.5 -apple-system, "PingFang SC", "Helvetica Neue", sans-serif; }
body { max-width: 520px; margin: 0 auto; padding-bottom: calc(72px + env(safe-area-inset-bottom)); }
.hidden { display: none !important; }
.muted { color: var(--muted); }
.small { font-size: 12px; }
.center { text-align: center; }
.grow { flex: 1; min-width: 0; }
.up { color: var(--up); }
.down { color: var(--down); }

#topbar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center;
  padding: calc(8px + env(safe-area-inset-top)) 12px 8px; background: var(--bg); }
#topbar h1 { flex: 1; text-align: center; font-size: 17px; }
.topbar-right { display: flex; align-items: center; gap: 6px; }
.icon-btn { border: 0; background: none; font-size: 20px; padding: 6px; cursor: pointer; }
.badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; }
.badge.ok { background: #e6f7ef; color: var(--down); }
.badge.warn { background: #fff4e5; color: #f79009; }
.badge.bad { background: #fdecec; color: var(--up); }

main { padding: 0 12px; }
.card { background: var(--card); border-radius: 14px; padding: 14px; margin-bottom: 12px; }
.total-card { text-align: center; padding: 22px 14px; }
.total-num { font-size: 34px; font-weight: 700; font-variant-numeric: tabular-nums; margin: 4px 0; }
.hint { background: #fff4e5; color: #b54708; font-size: 13px; }

.row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--line); }
.row:last-child { border-bottom: 0; }
.acct { cursor: pointer; }
.acct.stale { opacity: 0.5; }
.dot { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center;
  justify-content: center; font-size: 18px; flex-shrink: 0; }
.num { font-variant-numeric: tabular-nums; font-weight: 600; }
.num.big { font-size: 24px; }

details.group summary { display: flex; justify-content: space-between; align-items: center;
  list-style: none; cursor: pointer; font-weight: 600; padding: 2px 0; }
details.group summary::-webkit-details-marker { display: none; }

.btn { border: 0; border-radius: 10px; padding: 10px 14px; font-size: 15px;
  background: #eef0f4; color: var(--text); cursor: pointer; }
.btn.primary { background: var(--accent); color: #fff; }
.btn.danger { background: #fdecec; color: var(--danger); }
.btn.block { display: block; width: 100%; margin-bottom: 12px; }
.btn.small { padding: 6px 10px; font-size: 13px; }
.btn-row { display: flex; gap: 8px; margin-top: 12px; }
.btn-row .btn { flex: 1; }
.seg { margin: 0 0 10px; }
.seg-btn.on { background: var(--accent); color: #fff; }

input, select { width: 100%; padding: 11px 12px; margin: 8px 0; border: 1px solid var(--line);
  border-radius: 10px; font-size: 16px; background: #fafbfc; }
.pick { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
.pk { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center;
  justify-content: center; font-size: 19px; background: #eef0f4; cursor: pointer; border: 2px solid transparent; }
.pk.on { border-color: var(--accent); }

#tabbar { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%;
  max-width: 520px; display: flex; align-items: center; justify-content: space-around;
  background: var(--card); border-top: 1px solid var(--line);
  padding: 6px 0 calc(6px + env(safe-area-inset-bottom)); }
.tab { border: 0; background: none; font-size: 14px; color: var(--muted); padding: 8px 26px; cursor: pointer; }
.tab.active { color: var(--accent); font-weight: 600; }
.fab { width: 52px; height: 52px; border-radius: 50%; border: 0; background: var(--accent);
  color: #fff; font-size: 26px; cursor: pointer; margin-top: -22px; box-shadow: 0 4px 12px rgba(79,110,247,.4); }

.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 100;
  display: flex; align-items: flex-end; justify-content: center; }
.sheet { background: var(--card); width: 100%; max-width: 520px; border-radius: 18px 18px 0 0;
  padding: 20px 16px calc(20px + env(safe-area-inset-bottom)); max-height: 80vh; overflow-y: auto; }
.sheet h3 { margin-bottom: 10px; }
.chart { width: 100%; height: auto; display: block; margin: 10px 0 4px; }
.stats { display: flex; align-items: baseline; gap: 10px; margin: 6px 0; }
```

- [ ] **Step 3: 写 ui.js（基础框架 + 资产总览 + 后续任务占位函数）**

`ui.js`:

```js
/* global Core, Gist */
'use strict';
const LS_KEY = 'assetbook.v1';
const $ = sel => document.querySelector(sel);

let state = loadState();
let currentTab = 'assets';
let trendRange = 90;
let trendAccount = '';

function loadState() {
  try { const raw = localStorage.getItem(LS_KEY); if (raw) return JSON.parse(raw); } catch (e) {}
  return Core.createInitialState();
}
function saveState() { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function persist() { saveState(); scheduleBackup(); renderAll(); }

// ---------- 工具 ----------
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function fmtMoney(n) {
  if (state.settings.hideAmounts) return '＊＊＊＊';
  return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtAgo(ts) {
  if (!ts) return '未记录';
  const d = Math.floor((Date.now() - ts) / 86400000);
  return d <= 0 ? '今天' : d === 1 ? '昨天' : d + ' 天前';
}
function isStale(ts) { return !ts || Date.now() - ts > 30 * 86400000; }

// ---------- 弹层 ----------
function openModal(html) {
  const root = $('#modal-root');
  root.innerHTML = '<div class="overlay"><div class="sheet">' + html + '</div></div>';
  root.querySelector('.overlay').addEventListener('click', e => {
    if (e.target.classList.contains('overlay')) closeModal();
  });
  return root;
}
function closeModal() { $('#modal-root').innerHTML = ''; }

// ---------- 视图切换 ----------
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('#tabbar .tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('#view-settings').classList.add('hidden');
  $('#view-assets').classList.toggle('hidden', tab !== 'assets');
  $('#view-trend').classList.toggle('hidden', tab !== 'trend');
  $('#title').textContent = tab === 'assets' ? '资产' : '趋势';
  renderAll();
}
function renderAll() {
  if (!$('#view-settings').classList.contains('hidden')) { renderSettings(); renderBadge(); return; }
  if (currentTab === 'assets') renderAssets(); else renderTrend();
  renderBadge();
}

// ---------- 资产总览 ----------
function renderAssets() {
  const total = Core.totalAssets(state);
  let html = '<div class="card total-card"><div class="muted">总资产</div>' +
    '<div class="total-num">' + fmtMoney(total) + '</div>' +
    '<div class="muted small">' + Core.activeAccounts(state).length + ' 个账户</div></div>';
  html += backupHintHtml();
  if (state.accounts.length) html += '<button class="btn primary block" id="btn-inventory">开始盘点</button>';
  for (const g of state.groups.slice().sort((a, b) => a.order - b.order)) {
    const accts = Core.activeAccounts(state).filter(a => a.groupId === g.id);
    if (!accts.length) continue;
    html += '<details open class="card group"><summary><span>' + esc(g.name) + '</span>' +
      '<span class="muted">' + fmtMoney(Core.groupSubtotal(state, g.id)) + '</span></summary>';
    for (const a of accts) {
      const ts = Core.lastUpdatedAt(state, a.id);
      html += '<div class="row acct' + (isStale(ts) ? ' stale' : '') + '" data-id="' + a.id + '">' +
        '<span class="dot" style="background:' + a.color + '22">' + a.icon + '</span>' +
        '<span class="grow"><b>' + esc(a.name) + '</b><br><span class="muted small">' + fmtAgo(ts) + '</span></span>' +
        '<span class="num">' + fmtMoney(Core.currentBalance(state, a.id)) + '</span></div>';
    }
    html += '</details>';
  }
  if (!state.accounts.length) html += '<div class="card muted center">点右下角 ＋ 添加第一个账户</div>';
  $('#view-assets').innerHTML = html;
  const inv = $('#btn-inventory'); if (inv) inv.onclick = startInventory;
  document.querySelectorAll('#view-assets .acct').forEach(el => { el.onclick = () => openBalanceModal(el.dataset.id); });
}
function backupHintHtml() {
  const s = state.settings;
  const last = Math.max(s.lastBackupAt || 0, s.lastExportAt || 0);
  if (state.snapshots.length && !s.gistToken && Date.now() - last > 30 * 86400000)
    return '<div class="card hint">已超过 30 天未备份，建议在设置中配置 Gist 自动备份或导出 JSON</div>';
  return '';
}

// ---------- 占位函数（后续任务替换为完整实现）----------
function openBalanceModal(accountId) { alert('Task 7 实现'); }   // Task 7 替换
function openAccountModal(accountId) { alert('Task 7 实现'); }   // Task 7 替换
function startInventory() { alert('Task 8 实现'); }              // Task 8 替换
function renderTrend() { $('#view-trend').innerHTML = '<div class="card muted center">Task 9 实现</div>'; } // Task 9 替换
function openSettings() { alert('Task 10 实现'); }               // Task 10 替换
function renderSettings() {}                                      // Task 10 替换
function scheduleBackup() {}                                      // Task 10 替换
function renderBadge() {}                                         // Task 10 替换

// ---------- 启动 ----------
$('#btn-eye').onclick = () => { state.settings.hideAmounts = !state.settings.hideAmounts; saveState(); renderAll(); };
$('#btn-settings').onclick = () => openSettings();
$('#btn-add').onclick = () => openAccountModal(null);
document.querySelectorAll('#tabbar .tab').forEach(b => { b.onclick = () => switchTab(b.dataset.tab); });
renderAll();
```

- [ ] **Step 4: 本地手动验证**

```bash
cd /Users/jiangyichun/.qoderwork/projects/asset-book && python3 -m http.server 8899 &
curl -s http://localhost:8899/ | head -5
```

浏览器打开 http://localhost:8899 检查：页面正常渲染，总资产 0.00，空状态提示，眼睛按钮可切换遮罩（此时 sw.js 尚未创建，控制台 SW 注册 404 报错属预期，Task 11 解决）。

- [ ] **Step 5: Commit**

```bash
git add index.html styles.css ui.js && git commit -m "feat: 页面骨架与资产总览视图"
```

---

### Task 7: 账户与余额交互（余额弹窗 / 历史快照 / 账户编辑与归档）

**Files:**
- Modify: `ui.js`（替换 Task 6 中 `openBalanceModal`、`openAccountModal` 两个占位函数，新增 `openHistoryModal`、`ICONS`、`COLORS`）

- [ ] **Step 1: 替换实现**

删除 Task 6 的两行占位函数，在「占位函数」区域上方加入：

```js
// ---------- 账户与余额 ----------
const ICONS = ['💰', '🏦', '💳', '📱', '🐷', '🥇', '🏠', '📈', '💵', '🪙'];
const COLORS = ['#4f6ef7', '#e6413d', '#12b76a', '#f79009', '#7a5af8', '#0ba5ec', '#f04438', '#079455'];

function openBalanceModal(accountId) {
  const a = state.accounts.find(x => x.id === accountId);
  if (!a) return;
  openModal('<h3>' + a.icon + ' ' + esc(a.name) + '</h3>' +
    '<div class="muted">当前余额：' + fmtMoney(Core.currentBalance(state, a.id)) + '</div>' +
    '<input id="in-balance" type="number" inputmode="decimal" step="0.01" min="0" placeholder="输入最新余额">' +
    '<div class="btn-row"><button class="btn" id="btn-history">历史</button>' +
    '<button class="btn" id="btn-edit-acct">编辑</button>' +
    '<button class="btn primary" id="btn-save-balance">保存</button></div>');
  const input = $('#in-balance');
  input.focus();
  $('#btn-save-balance').onclick = () => {
    try { Core.addSnapshot(state, a.id, input.value); closeModal(); persist(); }
    catch (e) { alert(e.message); }
  };
  $('#btn-history').onclick = () => openHistoryModal(a.id);
  $('#btn-edit-acct').onclick = () => openAccountModal(a.id);
}

function openHistoryModal(accountId) {
  const a = state.accounts.find(x => x.id === accountId);
  const list = Core.snapshotsOf(state, accountId).slice().reverse();
  openModal('<h3>' + esc(a.name) + ' · 历史快照</h3>' +
    (list.length ? list.map(s =>
      '<div class="row"><span class="grow small">' + new Date(s.at).toLocaleString('zh-CN') + '</span>' +
      '<span class="num">' + fmtMoney(s.balance) + '</span>' +
      '<button class="icon-btn del" data-id="' + s.id + '">✕</button></div>').join('')
      : '<div class="muted center">暂无记录</div>') +
    '<div class="btn-row"><button class="btn" id="btn-close-history">关闭</button></div>');
  $('#btn-close-history').onclick = closeModal;
  document.querySelectorAll('#modal-root .del').forEach(b => {
    b.onclick = () => {
      if (confirm('删除这条快照？余额将回退到上一条。')) {
        Core.deleteSnapshot(state, b.dataset.id); closeModal(); persist();
      }
    };
  });
}

function openAccountModal(accountId) {
  const a = accountId ? state.accounts.find(x => x.id === accountId) : null;
  const sel = { icon: a ? a.icon : ICONS[0], color: a ? a.color : COLORS[0] };
  openModal('<h3>' + (a ? '编辑账户' : '添加账户') + '</h3>' +
    '<input id="in-name" placeholder="账户名称" value="' + (a ? esc(a.name) : '') + '">' +
    '<select id="in-group">' + state.groups.slice().sort((x, y) => x.order - y.order).map(g =>
      '<option value="' + g.id + '"' + (a && a.groupId === g.id ? ' selected' : '') + '>' + esc(g.name) + '</option>').join('') +
    '</select>' +
    '<div class="pick" id="pick-icon">' + ICONS.map(i =>
      '<span class="pk' + (i === sel.icon ? ' on' : '') + '" data-v="' + i + '">' + i + '</span>').join('') + '</div>' +
    '<div class="pick" id="pick-color">' + COLORS.map(c =>
      '<span class="pk' + (c === sel.color ? ' on' : '') + '" data-v="' + c + '" style="background:' + c + '"></span>').join('') + '</div>' +
    '<div class="btn-row">' +
    (a ? '<button class="btn danger" id="btn-archive">归档</button>' : '') +
    '<button class="btn primary" id="btn-save-acct">保存</button></div>');
  const bindPick = (rootSel, key) => {
    document.querySelectorAll(rootSel + ' .pk').forEach(el => {
      el.onclick = () => {
        sel[key] = el.dataset.v;
        document.querySelectorAll(rootSel + ' .pk').forEach(x => x.classList.toggle('on', x === el));
      };
    });
  };
  bindPick('#pick-icon', 'icon');
  bindPick('#pick-color', 'color');
  $('#btn-save-acct').onclick = () => {
    try {
      const patch = { name: $('#in-name').value, groupId: $('#in-group').value, icon: sel.icon, color: sel.color };
      if (a) Core.updateAccount(state, a.id, patch); else Core.addAccount(state, patch);
      closeModal(); persist();
    } catch (e) { alert(e.message); }
  };
  if (a) $('#btn-archive').onclick = () => {
    if (confirm('归档后不计入总资产，历史数据保留，可在设置中恢复。')) {
      Core.setArchived(state, a.id, true); closeModal(); persist();
    }
  };
}
```

- [ ] **Step 2: 本地手动验证**

浏览器 http://localhost:8899 强刷：＋添加账户（名称/分组/图标/颜色）→ 点账户输入余额保存 → 总资产与分组小计更新 → 历史里能看到快照并可删除回退 → 编辑改名 → 归档后从列表消失且总资产减少。

- [ ] **Step 3: Commit**

```bash
git add ui.js && git commit -m "feat: 账户增改归档、余额录入与历史快照管理"
```

---

### Task 8: 盘点模式

**Files:**
- Modify: `ui.js`（替换 `startInventory` 占位函数）

- [ ] **Step 1: 替换实现**

```js
// ---------- 盘点模式 ----------
function startInventory() {
  const accts = [];
  for (const g of state.groups.slice().sort((a, b) => a.order - b.order))
    for (const a of Core.activeAccounts(state).filter(x => x.groupId === g.id)) accts.push(a);
  if (!accts.length) { alert('还没有账户'); return; }
  const totalBefore = Core.totalAssets(state);
  let idx = 0;
  const step = () => {
    if (idx >= accts.length) {
      const totalAfter = Core.totalAssets(state);
      const diff = Core.round2(totalAfter - totalBefore);
      openModal('<h3 class="center">盘点完成</h3>' +
        '<div class="total-num center">' + fmtMoney(totalAfter) + '</div>' +
        '<div class="center ' + (diff >= 0 ? 'up' : 'down') + '">较盘点前 ' +
        (diff >= 0 ? '+' : '-') + fmtMoney(Math.abs(diff)) + '</div>' +
        '<div class="btn-row"><button class="btn primary" id="btn-inv-done">完成</button></div>');
      $('#btn-inv-done').onclick = closeModal;
      persist();
      return;
    }
    const a = accts[idx];
    openModal('<div class="muted small">盘点进度 ' + (idx + 1) + '/' + accts.length + '</div>' +
      '<h3>' + a.icon + ' ' + esc(a.name) + '</h3>' +
      '<div class="muted">上次余额：' + fmtMoney(Core.currentBalance(state, a.id)) + '</div>' +
      '<input id="inv-balance" type="number" inputmode="decimal" step="0.01" min="0" placeholder="输入最新余额（留空则跳过）">' +
      '<div class="btn-row"><button class="btn" id="inv-skip">跳过</button>' +
      '<button class="btn primary" id="inv-next">下一个</button></div>');
    $('#inv-balance').focus();
    $('#inv-skip').onclick = () => { idx++; step(); };
    $('#inv-next').onclick = () => {
      const v = $('#inv-balance').value;
      if (v !== '') {
        try { Core.addSnapshot(state, a.id, v); saveState(); }
        catch (e) { alert(e.message); return; }
      }
      idx++; step();
    };
  };
  step();
}
```

- [ ] **Step 2: 本地手动验证**

添加 3 个账户后点「开始盘点」：逐个显示上次余额、可跳过、可输入；结束页显示本次总资产与较盘点前变化；关闭后首页数据已更新。

- [ ] **Step 3: Commit**

```bash
git add ui.js && git commit -m "feat: 盘点模式（逐账户更新与盘点小结）"
```

---

### Task 9: 趋势页

**Files:**
- Modify: `ui.js`（替换 `renderTrend` 占位函数）

- [ ] **Step 1: 替换实现**

```js
// ---------- 趋势 ----------
const RANGES = [{ label: '1月', days: 30 }, { label: '3月', days: 90 },
                { label: '1年', days: 365 }, { label: '全部', days: 0 }];
function renderTrend() {
  const series = Core.dailySeries(state, { days: trendRange, accountId: trendAccount || null });
  const stats = Core.rangeStats(series);
  let html = '<div class="card">' +
    '<div class="btn-row seg">' + RANGES.map(r =>
      '<button class="btn seg-btn' + (r.days === trendRange ? ' on' : '') + '" data-days="' + r.days + '">' + r.label + '</button>').join('') + '</div>' +
    '<select id="trend-acct"><option value="">全部账户</option>' +
    Core.activeAccounts(state).map(a =>
      '<option value="' + a.id + '"' + (a.id === trendAccount ? ' selected' : '') + '>' + esc(a.name) + '</option>').join('') +
    '</select>';
  if (!series.length) {
    html += '<div class="muted center" style="padding:30px 0">暂无数据，先去记录余额吧</div></div>';
  } else {
    const pctTxt = stats.pct === null ? '' : '（' + (stats.diff >= 0 ? '+' : '') + stats.pct + '%）';
    html += '<div class="stats"><span class="num big">' + fmtMoney(stats.end) + '</span>' +
      '<span class="' + (stats.diff >= 0 ? 'up' : 'down') + '">' +
      (stats.diff >= 0 ? '+' : '-') + fmtMoney(Math.abs(stats.diff)) + pctTxt + '</span></div>' +
      '<svg viewBox="0 0 320 200" class="chart" preserveAspectRatio="none">' +
      '<path d="' + Core.svgPath(series, 320, 200, 8) + '" fill="none" stroke="#4f6ef7" stroke-width="2"/></svg>' +
      '<div class="row muted small"><span class="grow">' + series[0].day + '</span>' +
      '<span>' + series[series.length - 1].day + '</span></div></div>';
    if (trendAccount) {
      const list = Core.snapshotsOf(state, trendAccount).slice().reverse().slice(0, 20);
      html += '<div class="card"><h3 class="small muted">最近快照</h3>' + list.map(s =>
        '<div class="row"><span class="grow small">' + new Date(s.at).toLocaleString('zh-CN') + '</span>' +
        '<span class="num">' + fmtMoney(s.balance) + '</span></div>').join('') + '</div>';
    }
  }
  $('#view-trend').innerHTML = html;
  document.querySelectorAll('#view-trend .seg-btn').forEach(b => {
    b.onclick = () => { trendRange = Number(b.dataset.days); renderTrend(); };
  });
  $('#trend-acct').onchange = e => { trendAccount = e.target.value; renderTrend(); };
}
```

- [ ] **Step 2: 本地手动验证**

录入几条不同日期的快照（可在控制台执行 `Core.addSnapshot(state, state.accounts[0].id, 5000, Date.now()-86400000*10); saveState(); renderAll()` 造历史数据），切到趋势页：折线正常、范围切换生效、单账户下钻显示快照明细、涨跌数字与颜色正确（涨红跌绿）。

- [ ] **Step 3: Commit**

```bash
git add ui.js && git commit -m "feat: 资产趋势页（范围切换/单账户下钻/区间涨跌）"
```

---

### Task 10: 设置页与备份引擎

**Files:**
- Modify: `ui.js`（替换 `openSettings`、`renderSettings`、`scheduleBackup`、`renderBadge` 四个占位函数，新增备份/恢复/导出/导入函数；删除整个「占位函数」注释区）

- [ ] **Step 1: 替换实现**

```js
// ---------- 设置 ----------
function openSettings() {
  $('#view-assets').classList.add('hidden');
  $('#view-trend').classList.add('hidden');
  $('#view-settings').classList.remove('hidden');
  $('#title').textContent = '设置';
  renderSettings();
}
function closeSettings() { switchTab(currentTab); }

function renderSettings() {
  const s = state.settings;
  const archived = state.accounts.filter(a => a.archived);
  $('#view-settings').innerHTML =
    '<button class="btn block" id="btn-back">← 返回</button>' +
    '<div class="card"><h3>分组管理</h3>' +
    state.groups.slice().sort((a, b) => a.order - b.order).map(g =>
      '<div class="row"><span class="grow">' + esc(g.name) + '</span>' +
      '<button class="icon-btn g-ren" data-id="' + g.id + '">✏️</button>' +
      '<button class="icon-btn g-del" data-id="' + g.id + '">✕</button></div>').join('') +
    '<button class="btn block" id="btn-add-group" style="margin-top:10px">添加分组</button></div>' +
    (archived.length ? '<div class="card"><h3>已归档账户</h3>' + archived.map(a =>
      '<div class="row"><span class="grow">' + a.icon + ' ' + esc(a.name) + '</span>' +
      '<button class="btn small g-restore" data-id="' + a.id + '">恢复</button></div>').join('') + '</div>' : '') +
    '<div class="card"><h3>Gist 自动备份</h3>' +
    '<div class="muted small">在 github.com/settings/tokens 创建 fine-grained token，仅勾选 Gists 读写权限</div>' +
    '<input id="in-token" type="password" placeholder="GitHub Token" value="' + esc(s.gistToken) + '">' +
    '<input id="in-pass" type="password" placeholder="加密口令（可选，留空为明文备份）" value="' + esc(s.passphrase) + '">' +
    '<div class="muted small">' + (s.lastBackupAt
      ? '上次备份：' + new Date(s.lastBackupAt).toLocaleString('zh-CN') + (s.lastBackupStatus === 'ok' ? ' ✓' : ' ✗')
      : '尚未备份') + '</div>' +
    '<div class="btn-row"><button class="btn" id="btn-save-backup">保存配置</button>' +
    '<button class="btn" id="btn-backup-now">立即备份</button>' +
    '<button class="btn" id="btn-restore">从备份恢复</button></div></div>' +
    '<div class="card"><h3>数据</h3><div class="btn-row">' +
    '<button class="btn" id="btn-export">导出 JSON</button>' +
    '<button class="btn" id="btn-import">导入 JSON</button></div>' +
    '<input id="file-import" type="file" accept=".json,application/json" hidden></div>' +
    '<div class="card muted small center">资产本 v1 · ' + state.accounts.length + ' 个账户 · ' +
    state.snapshots.length + ' 条快照</div>';

  $('#btn-back').onclick = closeSettings;
  $('#btn-add-group').onclick = () => {
    const name = prompt('分组名称'); if (!name) return;
    try { Core.addGroup(state, name); persist(); } catch (e) { alert(e.message); }
  };
  document.querySelectorAll('#view-settings .g-ren').forEach(b => {
    b.onclick = () => {
      const g = state.groups.find(x => x.id === b.dataset.id);
      const name = prompt('新名称', g.name); if (!name) return;
      try { Core.renameGroup(state, g.id, name); persist(); } catch (e) { alert(e.message); }
    };
  });
  document.querySelectorAll('#view-settings .g-del').forEach(b => {
    b.onclick = () => {
      if (!confirm('删除该分组？')) return;
      try { Core.deleteGroup(state, b.dataset.id); persist(); } catch (e) { alert(e.message); }
    };
  });
  document.querySelectorAll('#view-settings .g-restore').forEach(b => {
    b.onclick = () => { Core.setArchived(state, b.dataset.id, false); persist(); };
  });
  $('#btn-save-backup').onclick = () => {
    state.settings.gistToken = $('#in-token').value.trim();
    state.settings.passphrase = $('#in-pass').value;
    saveState(); renderBadge(); alert('已保存');
  };
  $('#btn-backup-now').onclick = () => {
    state.settings.gistToken = $('#in-token').value.trim();
    state.settings.passphrase = $('#in-pass').value;
    saveState(); doBackup();
  };
  $('#btn-restore').onclick = restoreFromGist;
  $('#btn-export').onclick = exportJSON;
  $('#btn-import').onclick = () => $('#file-import').click();
  $('#file-import').onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = Core.importData(reader.result);
        if (!confirm('将用备份覆盖当前数据（' + data.accounts.length + ' 个账户，' +
          data.snapshots.length + ' 条快照），确定？')) return;
        state = data; saveState(); alert('导入成功'); closeSettings();
      } catch (err) { alert('导入失败：' + err.message); }
    };
    reader.readAsText(file);
  };
}

// ---------- 备份引擎 ----------
let backupTimer = 0;
function setBadge(txt, cls) {
  const b = $('#backup-badge');
  b.textContent = txt; b.className = 'badge' + (cls ? ' ' + cls : '');
}
function renderBadge() {
  const s = state.settings;
  if (!s.gistToken) { setBadge(''); return; }
  if (backupTimer) setBadge('待备份', 'warn');
  else if (s.lastBackupStatus === 'fail') setBadge('备份失败', 'bad');
  else if (s.lastBackupAt) setBadge('已备份', 'ok');
  else setBadge('未备份', 'warn');
}
function scheduleBackup() {
  if (!state.settings.gistToken) return;
  clearTimeout(backupTimer);
  backupTimer = setTimeout(doBackup, 3000);
  renderBadge();
}
async function doBackup() {
  backupTimer = 0;
  const s = state.settings;
  if (!s.gistToken) return;
  try {
    setBadge('备份中…', 'warn');
    let content = Core.exportData(state);
    if (s.passphrase) content = await Core.encryptText(content, s.passphrase);
    const id = await Gist.pushBackup({ token: s.gistToken, gistId: s.gistId, content });
    s.gistId = id; s.lastBackupAt = Date.now(); s.lastBackupStatus = 'ok';
    saveState(); renderBadge();
  } catch (e) {
    s.lastBackupStatus = 'fail'; saveState(); renderBadge();
  }
}
async function restoreFromGist() {
  const token = ($('#in-token') ? $('#in-token').value.trim() : '') || state.settings.gistToken;
  if (!token) { alert('请先填写 Token'); return; }
  const gistId = state.settings.gistId ||
    prompt('输入备份 Gist ID（gist.github.com 上备份地址最后一段）');
  if (!gistId) return;
  try {
    let content = await Gist.fetchBackup(token, gistId);
    let data;
    try { data = Core.importData(content); }
    catch (e1) {
      const pw = ($('#in-pass') && $('#in-pass').value) || prompt('数据已加密，输入加密口令');
      if (!pw) return;
      content = await Core.decryptText(content, pw);
      data = Core.importData(content);
    }
    if (!confirm('将用备份覆盖当前数据（' + data.accounts.length + ' 个账户，' +
      data.snapshots.length + ' 条快照），确定？')) return;
    state = data;
    state.settings.gistToken = token; state.settings.gistId = gistId;
    saveState(); alert('恢复成功'); closeSettings();
  } catch (e) { alert('恢复失败：' + e.message); }
}
async function exportJSON() {
  const content = Core.exportData(state);
  const name = 'asset-book-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  const file = new File([content], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); } catch (e) { return; }
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    a.download = name; a.click();
  }
  state.settings.lastExportAt = Date.now();
  saveState(); renderSettings();
}
```

- [ ] **Step 2: 本地手动验证**

设置页：分组增删改、归档账户恢复、导出 JSON（桌面浏览器走下载）、导入恢复。Gist 备份用真实 token 验证或跳过（Task 13 真机验证）：改一笔余额 → 角标 3 秒后从「待备份」变「已备份」→ gist.github.com 出现私有 Gist。

- [ ] **Step 3: Commit**

```bash
git add ui.js && git commit -m "feat: 设置页、Gist 自动备份引擎与导出导入"
```

---

### Task 11: PWA 化 — manifest / Service Worker / 图标

**Files:**
- Create: `manifest.json`, `sw.js`, `tools/gen_icons.py`, `icons/*.png`

- [ ] **Step 1: 写 manifest.json**

```json
{
  "name": "资产本",
  "short_name": "资产本",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#f5f6f8",
  "theme_color": "#f5f6f8",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: 写 sw.js**

```js
const VERSION = 'assetbook-v1';
const ASSETS = ['./', './index.html', './styles.css', './core.js', './gist.js', './ui.js',
                './manifest.json', './icons/icon-192.png', './icons/icon-512.png',
                './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then(cached => {
    const fresh = fetch(e.request).then(res => {
      if (res.ok) { const clone = res.clone(); caches.open(VERSION).then(c => c.put(e.request, clone)); }
      return res;
    }).catch(() => cached);
    return cached || fresh;
  }));
});
```

（发版规则：以后每次修改任何文件，必须同时把 `VERSION` 递增，如 `assetbook-v2`，否则旧缓存不更新。）

- [ ] **Step 3: 写图标生成脚本并执行**

`tools/gen_icons.py`（纯标准库，无需 Pillow）:

```python
#!/usr/bin/env python3
"""生成 PWA 图标：蓝底白色 ¥ 符号。纯标准库实现。"""
import struct, zlib, os

def png(path, size, pixels):
    raw = b''.join(b'\x00' + b''.join(struct.pack('BBBB', *px) for px in row) for row in pixels)
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(data)

BG = (79, 110, 247, 255); FG = (255, 255, 255, 255); TR = (0, 0, 0, 0)
GLYPH = ["10000001", "01000010", "00100100", "00011000",
         "01111110", "00011000", "01111110", "00011000", "00011000"]

def make(size, path, rounded=True):
    r = int(size * 0.22)
    px = [[BG] * size for _ in range(size)]
    if rounded:
        for y in range(size):
            for x in range(size):
                cx = min(x, size - 1 - x); cy = min(y, size - 1 - y)
                if cx < r and cy < r:
                    dx = r - cx; dy = r - cy
                    if dx * dx + dy * dy > r * r:
                        px[y][x] = TR
    cell = size // 16
    ox = (size - 8 * cell) // 2; oy = (size - 9 * cell) // 2
    for gy, row in enumerate(GLYPH):
        for gx, bit in enumerate(row):
            if bit == '1':
                for y in range(oy + gy * cell, oy + (gy + 1) * cell):
                    for x in range(ox + gx * cell, ox + (gx + 1) * cell):
                        px[y][x] = FG
    png(path, size, px)

os.makedirs('icons', exist_ok=True)
make(192, 'icons/icon-192.png')
make(512, 'icons/icon-512.png')
make(180, 'icons/apple-touch-icon.png', rounded=False)  # iOS 自动加圆角，需不透明
print('icons generated')
```

```bash
cd /Users/jiangyichun/.qoderwork/projects/asset-book && python3 tools/gen_icons.py && ls -la icons/
```

Expected: 输出 `icons generated`，三个 PNG 文件生成。用 Read 工具查看 icons/icon-192.png 确认图案正常。

- [ ] **Step 4: 本地验证 PWA**

```bash
python3 -m http.server 8899 &
curl -sI http://localhost:8899/sw.js | head -1
curl -sI http://localhost:8899/manifest.json | head -1
curl -sI http://localhost:8899/icons/icon-192.png | head -1
```

Expected: 三个均 HTTP 200。浏览器强刷后控制台无 SW 注册错误；DevTools → Application → Service Worker 显示 activated；断网刷新页面仍可用。

- [ ] **Step 5: Commit**

```bash
git add manifest.json sw.js tools/ icons/ && git commit -m "feat: PWA 化（manifest/Service Worker 离线缓存/应用图标）"
```

---

### Task 12: GitHub 仓库与 Pages 部署

**Files:** 无新文件，纯部署操作

- [ ] **Step 1: 确认 GitHub 登录态**

```bash
gh auth status -h github.com
```

若显示 token 无效：**暂停并请用户执行** `gh auth login -h github.com --web`（浏览器授权），完成后重跑本步骤确认 OK。

- [ ] **Step 2: 创建仓库并推送**

```bash
cd /Users/jiangyichun/.qoderwork/projects/asset-book
gh repo create asset-book --public --source=. --remote=origin --push
```

Expected: 输出仓库地址 https://github.com/jiangyichun21-hub/asset-book

- [ ] **Step 3: 启用 GitHub Pages**

```bash
gh api repos/jiangyichun21-hub/asset-book/pages -X POST -f "source[branch]=main" -f "source[path]=/" || gh api repos/jiangyichun21-hub/asset-book/pages -X PUT -f "source[branch]=main" -f "source[path]=/"
```

- [ ] **Step 4: 验证线上可访问（Pages 构建约需 1-2 分钟）**

```bash
sleep 90 && curl -sI https://jiangyichun21-hub.github.io/asset-book/ | head -1
curl -s https://jiangyichun21-hub.github.io/asset-book/ | grep -o '<title>[^<]*</title>'
```

Expected: `HTTP/2 200` 与 `<title>资产本</title>`。若 404 则再等 60 秒重试（最多 5 次）。

---

### Task 13: 上线验收与真机安装指引

- [ ] **Step 1: 回归全部单测**

```bash
cd /Users/jiangyichun/.qoderwork/projects/asset-book && node --test tests/
```

Expected: 16 tests PASS

- [ ] **Step 2: 交付用户真机验收清单**

向用户输出以下内容（对照产品方案第 9 节验收标准）：

> 1. iPhone Safari 打开 https://jiangyichun21-hub.github.io/asset-book/
> 2. 分享按钮 → 「添加到主屏幕」→ 图标名"资产本"
> 3. 从主屏幕打开：应为全屏无地址栏
> 4. 添加你的真实账户（参考截图：现金/工商/招商/支付宝/微信/公积金等）
> 5. 走一遍「开始盘点」，确认总资产正确
> 6. 开飞行模式再打开 App，确认离线可用
> 7. 配置 Gist 备份：github.com/settings/personal-access-tokens → 新建 fine-grained token → 权限只勾 Gists（Read and write）→ 粘贴到设置页 → 改一笔余额 → 角标变"已备份"→ gist.github.com 确认出现私有备份
> 8. 趋势页查看曲线与涨跌

- [ ] **Step 3: 根据用户反馈修复问题后，更新 sw.js 的 VERSION 并 push**

---

## Self-Review 记录

- **Spec 覆盖检查**：账户管理→Task 7；余额快照→Task 2/7；盘点模式→Task 8；资产总览（大数字/分组小计/30天标灰/眼睛/备份角标）→Task 6/10；趋势图（范围/下钻/涨跌）→Task 3/9；Gist 自动备份+加密+恢复→Task 4/5/10；手动导出导入+30天提醒→Task 6/10；设置页→Task 10；PWA 离线/图标/主屏→Task 11；部署→Task 12；验收标准→Task 13。全部覆盖。
- **占位符检查**：Task 6 的占位函数均标注了明确的替换任务编号，属渐进式实现而非 TBD；无其他占位。
- **类型一致性**：state 形状全局统一；`Core.round2`/`fmtMoney`/`esc` 等跨任务引用名称一致；`RANGES`/`ICONS`/`COLORS` 常量只定义一次。
