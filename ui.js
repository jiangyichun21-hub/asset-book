/* global Core, Gist, Trades */
'use strict';
const LS_KEY = 'assetbook.v1';
const BUILD_ID = '202608171842';
const $ = sel => document.querySelector(sel);

let state = loadState();
let currentTab = 'assets';
let currentView = 'asset'; // 'asset' | 'trade'
let settingsFromView = 'asset'; // remember where settings was opened from
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
const SVG_PATHS = {
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
  pencil: '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  grip: '<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>',
  arrowLeft: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>'
};
function svgIcon(name) {
  return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
    ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + SVG_PATHS[name] + '</svg>';
}

// ---------- 分组拖拽排序 ----------
let dragId = null;
function bindGroupDrag() {
  document.querySelectorAll('#view-settings .group-item .drag-handle').forEach(h => {
    h.addEventListener('pointerdown', e => {
      e.preventDefault();
      dragId = h.closest('.group-item').dataset.id;
      h.closest('.group-item').classList.add('dragging');
    });
  });
}
document.addEventListener('pointermove', e => {
  if (!dragId) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const target = el && el.closest && el.closest('.group-item');
  if (!target || target.dataset.id === dragId) return;
  const arr = state.groups.slice().sort((a, b) => a.order - b.order);
  const from = arr.findIndex(g => g.id === dragId);
  const to = arr.findIndex(g => g.id === target.dataset.id);
  if (from < 0 || to < 0 || from === to) return;
  const [m] = arr.splice(from, 1);
  arr.splice(to, 0, m);
  arr.forEach((g, i) => { g.order = i; });
  renderSettings();
  const el2 = document.querySelector('#view-settings .group-item[data-id="' + dragId + '"]');
  if (el2) el2.classList.add('dragging');
});
function endDrag() {
  if (!dragId) return;
  dragId = null;
  saveState(); scheduleBackup();
  const el = document.querySelector('#view-settings .group-item.dragging');
  if (el) el.classList.remove('dragging');
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

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
  $('#tabbar').classList.remove('hidden');
  renderAll();
}
function switchView(view) {
  currentView = view;
  // Hide all views
  $('#view-assets').classList.add('hidden');
  $('#view-trend').classList.add('hidden');
  $('#view-trade').classList.add('hidden');
  $('#view-settings').classList.add('hidden');
  // Show correct view
  if (view === 'asset') {
    $('#view-assets').classList.toggle('hidden', currentTab !== 'assets');
    $('#view-trend').classList.toggle('hidden', currentTab !== 'trend');
    $('#tabbar').classList.remove('hidden');
  } else if (view === 'trade') {
    $('#view-trade').classList.remove('hidden');
    $('#tabbar').classList.add('hidden');
    Trades.render();
  }
  // Update title
  var titles = { asset: '资产', trade: '买卖记账' };
  $('#title').textContent = titles[view] || view;
  // Update dropdown active state
  document.querySelectorAll('.dd-item').forEach(function(d) {
    d.classList.toggle('active', d.dataset.view === view);
  });
  renderAll();
}
function renderAll() {
  syncTopbar();
  if (!$('#view-settings').classList.contains('hidden')) { renderSettings(); renderBadge(); return; }
  if (currentView === 'trade') return; // trade view handles its own rendering
  if (currentTab === 'assets') renderAssets(); else renderTrend();
  renderBadge();
}
function syncTopbar() {
  const inSettings = !$('#view-settings').classList.contains('hidden');
  const nav = $('#btn-settings');
  const eye = $('#btn-eye');
  const arrow = $('.title-btn .arrow');
  if (inSettings) {
    nav.innerHTML = svgIcon('arrowLeft');
    nav.title = '返回';
    nav.onclick = closeSettings;
    eye.classList.add('hidden');
    if (arrow) arrow.style.display = 'none';
  } else {
    nav.innerHTML = svgIcon('gear');
    nav.title = '设置';
    nav.onclick = openSettings;
    if (arrow) arrow.style.display = '';
    // Eye only visible on asset view
    if (currentView === 'asset') {
      eye.classList.remove('hidden');
      eye.innerHTML = svgIcon(state.settings.hideAmounts ? 'eyeOff' : 'eye');
      eye.title = state.settings.hideAmounts ? '显示金额' : '隐藏金额';
    } else {
      eye.classList.add('hidden');
    }
  }
}

// ---------- 资产总览 ----------
function renderAssets() {
  const total = Core.totalAssets(state);
  let html = '<div class="card total-card"><div class="muted">总资产</div>' +
    '<div class="total-num">' + fmtMoney(total) + '</div>' +
    '<div class="muted small">' + Core.activeAccounts(state).length + ' 个账户</div></div>';
  html += backupHintHtml();
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
  if (state.accounts.length) html += '<button class="btn primary block" id="btn-inventory">开始盘点</button>';
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
      '<button class="icon-btn del" data-id="' + s.id + '">' + svgIcon('x') + '</button></div>').join('')
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
// ---------- 设置 ----------
function openSettings() {
  settingsFromView = currentView;
  $('#view-assets').classList.add('hidden');
  $('#view-trend').classList.add('hidden');
  $('#view-trade').classList.add('hidden');
  $('#view-settings').classList.remove('hidden');
  $('#tabbar').classList.add('hidden');
  $('#title').textContent = '设置';
  syncTopbar();
  renderSettings();
}
function closeSettings() { switchView(settingsFromView); }

function renderSettings() {
  const s = state.settings;
  // Common section (shared across all modules)
  let commonHtml =
    '<div class="card"><h3>Gist 自动备份<span id="gist-status" class="badge"></span></h3>' +
    '<div class="muted small">在 github.com/settings/tokens 创建 fine-grained token，仅勾选 Gists 读写权限</div>' +
    '<input id="in-token" type="password" placeholder="GitHub Token" value="' + esc(s.gistToken) + '">' +
    '<input id="in-pass" type="password" placeholder="加密口令（可选，留空为明文备份）" value="' + esc(s.passphrase) + '">' +
    '<div class="muted small">' + (s.lastBackupAt
      ? '上次备份：' + new Date(s.lastBackupAt).toLocaleString('zh-CN') + (s.lastBackupStatus === 'ok' ? ' ✓' : ' ✗')
      : '尚未备份') + '</div>' +
    (s.lastBackupStatus === 'fail' && s.lastBackupError
      ? '<div class="hint small" style="margin-top:6px;padding:6px 10px;border-radius:8px">错误：' + esc(s.lastBackupError) + '</div>'
      : '') +
    '<div class="btn-row"><button class="btn" id="btn-save-backup">保存配置</button>' +
    '<button class="btn" id="btn-backup-now">立即备份</button>' +
    '<button class="btn" id="btn-restore">从备份恢复</button></div></div>' +
    '<div class="card"><h3>数据</h3><div class="btn-row">' +
    '<button class="btn" id="btn-export">导出 JSON</button>' +
    '<button class="btn" id="btn-import">导入 JSON</button></div>' +
    '<input id="file-import" type="file" accept=".json,application/json" hidden></div>';

  // Module-specific section
  let moduleHtml = '';
  if (settingsFromView === 'asset') {
    const archived = state.accounts.filter(a => a.archived);
    moduleHtml =
      '<div class="card"><h3>分组管理<span class="muted small" style="margin-left:auto;font-weight:normal">拖拽排序</span></h3>' +
      state.groups.slice().sort((a, b) => a.order - b.order).map(g =>
        '<div class="row group-item" data-id="' + g.id + '">' +
        '<span class="drag-handle" title="拖拽排序">' + svgIcon('grip') + '</span>' +
        '<span class="grow">' + esc(g.name) + '</span>' +
        '<button class="icon-btn g-ren" data-id="' + g.id + '">' + svgIcon('pencil') + '</button>' +
        '<button class="icon-btn g-del" data-id="' + g.id + '">' + svgIcon('x') + '</button></div>').join('') +
      '<button class="btn block" id="btn-add-group" style="margin-top:10px">添加分组</button></div>' +
      (archived.length ? '<div class="card"><h3>已归档账户</h3>' + archived.map(a =>
        '<div class="row"><span class="grow">' + a.icon + ' ' + esc(a.name) + '</span>' +
        '<button class="btn small g-restore" data-id="' + a.id + '">恢复</button></div>').join('') + '</div>' : '');
  } else if (settingsFromView === 'trade') {
    moduleHtml =
      '<div class="card"><h3>买卖记账设置</h3>' +
      '<div class="muted small">交易记录：' + Trades.getRecordCount() + ' 条</div></div>';
  }

  // Version footer
  let footerHtml = '<div class="card muted small center">资产本 · 版本 ' + BUILD_ID + ' · ' +
    state.accounts.length + ' 个账户 · ' + state.snapshots.length + ' 条快照</div>';

  $('#view-settings').innerHTML = moduleHtml + commonHtml + footerHtml;

  // Bind common events
  $('#btn-save-backup').onclick = () => {
    state.settings.gistToken = $('#in-token').value.trim();
    state.settings.passphrase = $('#in-pass').value;
    saveState(); renderBadge(); alert('已保存');
  };
  $('#btn-backup-now').onclick = () => {
    state.settings.gistToken = $('#in-token').value.trim();
    state.settings.passphrase = $('#in-pass').value;
    saveState(); doBackup(true);
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

  // Bind module-specific events
  if (settingsFromView === 'asset') {
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
    bindGroupDrag();
  }
}

// ---------- 备份引擎 ----------
let backupTimer = 0;
function setBadge(txt, cls) {
  const b = $('#gist-status');
  if (!b) return;
  b.textContent = txt; b.className = 'badge' + (cls ? ' ' + cls : '');
}
function renderBadge() {
  const s = state.settings;
  if (!s.gistToken) { setBadge('未配置'); return; }
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
async function doBackup(isManual) {
  backupTimer = 0;
  const s = state.settings;
  if (!s.gistToken) { if (isManual) alert('请先在下方填入 GitHub Token 并保存'); return; }
  try {
    setBadge('备份中…', 'warn');
    let content = JSON.stringify({
      v: 2,
      assets: Core.exportData(state),
      trades: localStorage.getItem('assetbook.trades') || '{}'
    });
    if (s.passphrase) content = await Core.encryptText(content, s.passphrase);
    const id = await Gist.pushBackup({ token: s.gistToken, gistId: s.gistId, content });
    s.gistId = id; s.lastBackupAt = Date.now(); s.lastBackupStatus = 'ok'; s.lastBackupError = '';
    saveState(); renderBadge();
    if (isManual) alert('备份成功');
  } catch (e) {
    s.lastBackupStatus = 'fail'; s.lastBackupError = e && e.message ? e.message : String(e);
    saveState(); renderBadge();
    console.error('backup failed', e);
    if (isManual) alert('备份失败：' + s.lastBackupError);
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
    let raw;
    try { raw = JSON.parse(content); } catch (_) { raw = null; }
    // v2 format: { v:2, assets:..., trades:... }
    let data;
    if (raw && raw.v === 2 && raw.assets) {
      data = Core.importData(raw.assets);
      if (raw.trades) localStorage.setItem('assetbook.trades', raw.trades);
    } else {
      // Try v1 (legacy) format
      try { data = Core.importData(content); }
      catch (e1) {
        const pw = ($('#in-pass') && $('#in-pass').value) || prompt('数据已加密，输入加密口令');
        if (!pw) return;
        content = await Core.decryptText(content, pw);
        try {
          raw = JSON.parse(content);
          if (raw && raw.v === 2 && raw.assets) {
            data = Core.importData(raw.assets);
            if (raw.trades) localStorage.setItem('assetbook.trades', raw.trades);
          } else { data = Core.importData(content); }
        } catch (_) { data = Core.importData(content); }
      }
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

// ---------- 启动 ----------
$('#btn-eye').onclick = () => { state.settings.hideAmounts = !state.settings.hideAmounts; saveState(); renderAll(); };
$('#btn-settings').onclick = openSettings;
$('#btn-add').onclick = () => openAccountModal(null);
document.querySelectorAll('#tabbar .tab').forEach(b => { b.onclick = () => switchTab(b.dataset.tab); });

// Title dropdown navigation
(function() {
  var wrap = $('#title-wrap');
  var dd = $('#title-dropdown');
  var overlay = $('#dd-overlay');
  function toggleDD() { wrap.classList.toggle('open'); overlay.classList.toggle('open'); }
  function closeDD() { wrap.classList.remove('open'); overlay.classList.remove('open'); }
  $('#title-btn').onclick = toggleDD;
  overlay.onclick = closeDD;
  dd.querySelectorAll('.dd-item').forEach(function(item) {
    item.onclick = function() { closeDD(); switchView(item.dataset.view); };
  });
})();

renderAll();
