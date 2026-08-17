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

  return {
    SCHEMA, DEFAULT_GROUPS, uid, round2, pad,
    createInitialState,
    addGroup, renameGroup, deleteGroup,
    addAccount, updateAccount, setArchived, activeAccounts,
    addSnapshot, deleteSnapshot, snapshotsOf, latestSnapshot,
    currentBalance, lastUpdatedAt, totalAssets, groupSubtotal,
    dailySeries, rangeStats, svgPath, startOfDay, dayKey,
    exportData, importData, encryptText, decryptText
  };
});
