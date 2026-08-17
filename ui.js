/* global Core, Gist, Trades */
'use strict';
const LS_KEY = 'assetbook.v1';
const BUILD_ID = '202608180003';
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

// ---------- 滚动锁 ----------
let scrollLockCount = 0;
let savedScrollY = 0;
function lockScroll() {
  if (++scrollLockCount !== 1) return;
  savedScrollY = window.scrollY || 0;
  document.body.classList.add('scroll-locked');
  document.body.style.position = 'fixed';
  document.body.style.top = '-' + savedScrollY + 'px';
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
}
function unlockScroll() {
  if (scrollLockCount <= 0) { scrollLockCount = 0; return; }
  if (--scrollLockCount !== 0) return;
  document.body.classList.remove('scroll-locked');
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  window.scrollTo(0, savedScrollY);
}

// ---------- 弹层 ----------
function openModal(html) {
  const root = $('#modal-root');
  root.innerHTML = '<div class="overlay"><div class="sheet">' + html + '</div></div>';
  root.querySelector('.overlay').addEventListener('click', e => {
    if (e.target.classList.contains('overlay')) closeModal();
  });
  lockScroll();
  history.pushState({ ab: 'modal' }, '');
  return root;
}
function closeModal() {
  if (!$('#modal-root').innerHTML) return;
  if (history.state && history.state.ab === 'modal') { history.back(); return; }
  closeModalDom();
}
function closeModalDom() {
  if (!$('#modal-root').innerHTML) return;
  $('#modal-root').innerHTML = '';
  unlockScroll();
}

// ---------- 视图切换 ----------
let currentTradeTab = 'ledger'; // ledger | bills | analytics

function renderTabbar() {
  const bar = $('#tabbar');
  if (currentView === 'asset') {
    bar.innerHTML =
      '<button data-tab="assets" class="tab' + (currentTab === 'assets' ? ' active' : '') + '">资产</button>' +
      '<button id="btn-add" class="fab" title="添加账户">＋</button>' +
      '<button data-tab="trend" class="tab' + (currentTab === 'trend' ? ' active' : '') + '">趋势</button>';
    $('#btn-add').onclick = () => openAccountModal(null);
    bar.querySelectorAll('.tab').forEach(b => { b.onclick = () => switchTab(b.dataset.tab); });
  } else if (currentView === 'trade') {
    const t = currentTradeTab;
    bar.innerHTML =
      '<button data-ttab="ledger" class="tab' + (t === 'ledger' ? ' active' : '') + '">记账本</button>' +
      '<button data-ttab="bills" class="tab' + (t === 'bills' ? ' active' : '') + '">账单</button>' +
      '<button data-ttab="analytics" class="tab' + (t === 'analytics' ? ' active' : '') + '">数据分析</button>';
    bar.querySelectorAll('.tab').forEach(b => {
      b.onclick = () => {
        currentTradeTab = b.dataset.ttab;
        bar.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === b));
        Trades.switchTab(currentTradeTab);
        updateTradeFab();
      };
    });
  }
}

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
  } else if (view === 'trade') {
    $('#view-trade').classList.remove('hidden');
    Trades.render();
    Trades.switchTab(currentTradeTab);
  }
  $('#tabbar').classList.remove('hidden');
  renderTabbar();
  updateTradeFab();
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
  history.pushState({ ab: 'settings' }, '');
}
function closeSettings() {
  if ($('#view-settings').classList.contains('hidden')) return;
  if (history.state && history.state.ab === 'settings') { history.back(); return; }
  closeSettingsDom();
}
function closeSettingsDom() { switchView(settingsFromView); }

function renderSettings() {
  const s = state.settings;
  // Common section (shared across all modules)
  let commonHtml =
    '<div class="card"><h3>应用</h3>' +
    '<div class="muted small">当前版本 ' + BUILD_ID + '，如遇更新未生效可强制刷新</div>' +
    '<div class="btn-row"><button class="btn primary" id="btn-check-update">检查更新</button></div></div>' +
    '<div class="card"><h3>Gist 自动备份<span id="gist-status" class="badge"></span></h3>' +
    '<div class="muted small">在 github.com/settings/tokens 创建 fine-grained token，仅勾选 Gists 读写权限</div>' +
    '<div class="token-input-wrap"><input id="in-token" type="password" placeholder="GitHub Token" value="' + esc(s.gistToken) + '">' +
    '<button type="button" class="token-eye" id="btn-token-eye" title="显示/隐藏">' + svgIcon('eye') + '</button></div>' +
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
  let footerHtml = '<div class="card muted small center">eNook · 版本 ' + BUILD_ID + ' · ' +
    state.accounts.length + ' 个账户 · ' + state.snapshots.length + ' 条快照</div>';

  $('#view-settings').innerHTML = moduleHtml + commonHtml + footerHtml;

  // Bind common events
  $('#btn-check-update').onclick = forceUpdate;
  $('#btn-token-eye').onclick = () => {
    const inp = $('#in-token');
    const btn = $('#btn-token-eye');
    const isPw = inp.type === 'password';
    inp.type = isPw ? 'text' : 'password';
    btn.innerHTML = svgIcon(isPw ? 'eyeOff' : 'eye');
  };
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
async function forceUpdate() {
  const btn = $('#btn-check-update');
  if (btn) { btn.disabled = true; btn.textContent = '检查中…'; }
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        // Trigger update check
        await reg.update();
        // If there's a waiting worker, tell it to skip waiting
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        // Wait a beat for the new SW to install/activate
        await new Promise(r => setTimeout(r, 500));
      }
    }
    // Purge all caches so the reload fetches fresh assets
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    // Hard reload
    location.reload();
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = '检查更新'; }
    alert('更新失败：' + (e && e.message ? e.message : String(e)));
  }
}
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
async function parseBackupContent(content, pass) {
  // Parse a backup file content, handling v2 bundled, v1 legacy, and encrypted variants.
  // Returns { data, trades } where data is asset state and trades is trade JSON string (or null).
  let raw;
  try { raw = JSON.parse(content); } catch (_) { raw = null; }
  if (raw && raw.v === 2 && raw.assets) {
    return { data: Core.importData(raw.assets), trades: raw.trades || null };
  }
  try {
    return { data: Core.importData(content), trades: null };
  } catch (_) {
    if (!pass) throw new Error('数据已加密，需要口令');
    const dec = await Core.decryptText(content, pass);
    let raw2; try { raw2 = JSON.parse(dec); } catch (_) { raw2 = null; }
    if (raw2 && raw2.v === 2 && raw2.assets) {
      return { data: Core.importData(raw2.assets), trades: raw2.trades || null };
    }
    return { data: Core.importData(dec), trades: null };
  }
}
async function restoreFromGist() {
  const token = ($('#in-token') ? $('#in-token').value.trim() : '') || state.settings.gistToken;
  if (!token) { alert('请先填写 Token'); return; }
  const pass = ($('#in-pass') && $('#in-pass').value) || state.settings.passphrase || '';
  try {
    // Step 1: list all backups
    const list = await Gist.listBackups(token);
    if (!list.length) { alert('未找到任何备份'); return; }

    // Step 2: probe each backup to get account/snapshot counts
    const probes = [];
    for (const g of list) {
      try {
        const content = await Gist.fetchBackup(token, g.id);
        const parsed = await parseBackupContent(content, pass);
        probes.push({
          id: g.id, updatedAt: g.updatedAt,
          accounts: parsed.data.accounts.length,
          snapshots: parsed.data.snapshots.length,
          content: content
        });
      } catch (e) {
        probes.push({ id: g.id, updatedAt: g.updatedAt, error: e.message });
      }
    }

    // Step 3: pick target
    let target;
    const nonEmpty = probes.filter(p => !p.error && (p.accounts > 0 || p.snapshots > 0));
    if (nonEmpty.length === 0) {
      alert('所有备份都是空的（0 个账户 0 条快照）'); return;
    } else if (nonEmpty.length === 1) {
      target = nonEmpty[0];
      if (!confirm('找到 1 个有数据的备份：\n' + new Date(target.updatedAt).toLocaleString('zh-CN') +
        '\n账户 ' + target.accounts + ' 个，快照 ' + target.snapshots + ' 条\n\n是否恢复？')) return;
    } else {
      // Multiple non-empty backups: show picker
      const opts = nonEmpty.map((p, i) =>
        (i + 1) + '. ' + new Date(p.updatedAt).toLocaleString('zh-CN') +
        ' - ' + p.accounts + '账户 ' + p.snapshots + '快照').join('\n');
      const ans = prompt('找到 ' + nonEmpty.length + ' 个有数据的备份，输入序号选择（默认 1 = 最新）：\n' + opts, '1');
      if (ans === null) return;
      const idx = Math.max(1, Math.min(nonEmpty.length, parseInt(ans) || 1)) - 1;
      target = nonEmpty[idx];
    }

    // Step 4: apply
    const parsed = await parseBackupContent(target.content, pass);
    state = parsed.data;
    state.settings.gistToken = token;
    state.settings.gistId = target.id;
    if (parsed.trades) localStorage.setItem('assetbook.trades', parsed.trades);
    saveState();
    alert('恢复成功：' + parsed.data.accounts.length + ' 个账户，' +
      parsed.data.snapshots.length + ' 条快照');
    closeSettings();
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

// Title dropdown navigation
(function() {
  var wrap = $('#title-wrap');
  var dd = $('#title-dropdown');
  var overlay = $('#dd-overlay');
  var ddOpen = false;
  function openDD() {
    if (ddOpen) return;
    ddOpen = true;
    wrap.classList.add('open');
    overlay.classList.add('open');
    lockScroll();
  }
  function closeDD() {
    if (!ddOpen) return;
    ddOpen = false;
    wrap.classList.remove('open');
    overlay.classList.remove('open');
    unlockScroll();
  }
  function toggleDD() { ddOpen ? closeDD() : openDD(); }
  $('#title-btn').onclick = toggleDD;
  overlay.onclick = closeDD;
  dd.querySelectorAll('.dd-item').forEach(function(item) {
    item.onclick = function() { closeDD(); switchView(item.dataset.view); };
  });
})();

// Phone gesture-back: close top-most overlay/second-level page when history pops
window.addEventListener('popstate', function() {
  if ($('#modal-root').innerHTML) { closeModalDom(); return; }
  if (!$('#view-settings').classList.contains('hidden')) { closeSettingsDom(); return; }
});

// ---------- 买卖记账：FAB / 表单 / 动作面板 ----------
function updateTradeFab() {
  const fab = $('#fab-trade');
  if (!fab) return;
  const show = currentView === 'trade' && currentTradeTab === 'ledger'
    && $('#view-settings').classList.contains('hidden');
  fab.classList.toggle('hidden', !show);
}
function toast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:calc(90px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);background:rgba(0,0,0,.78);color:#fff;padding:9px 18px;border-radius:20px;font-size:14px;z-index:300;pointer-events:none;';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1500);
}
function nowLocalInput() {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}
function openTradeForm(record) {
  const isEdit = !!record;
  const r = record || {};
  const html = '<h3>' + (isEdit ? '编辑交易' : '新增交易') + '</h3>' +
    '<form id="trade-form">' +
    '<div class="form-row"><label>商品名</label>' +
      '<input name="name" required value="' + (r.name ? esc(r.name) : '') + '"></div>' +
    '<div class="form-two-col">' +
      '<div class="form-row"><label>平台</label>' +
        '<input name="platform" value="' + (r.platform ? esc(r.platform) : '') + '" placeholder="如 197淘宝"></div>' +
      '<div class="form-row"><label>时间</label>' +
        '<input name="date" type="datetime-local" required value="' + (r.date ? r.date.replace(' ', 'T').slice(0,16) : nowLocalInput()) + '"></div>' +
    '</div>' +
    '<div class="form-two-col">' +
      '<div class="form-row"><label>买入价</label>' +
        '<input name="buyPrice" type="number" step="0.01" required value="' + (r.buyPrice != null ? r.buyPrice : '') + '"></div>' +
      '<div class="form-row"><label>卖出价（可空）</label>' +
        '<input name="sellPrice" type="number" step="0.01" value="' + (r.sellPrice ? r.sellPrice : '') + '"></div>' +
    '</div>' +
    '<div class="form-two-col">' +
      '<div class="form-row"><label>手续费</label>' +
        '<input name="fee" type="number" step="0.01" value="' + (r.fee != null ? r.fee : 0) + '"></div>' +
      '<div class="form-row"><label>CPS 返现</label>' +
        '<input name="cps" type="number" step="0.01" value="' + (r.cps != null ? r.cps : 0) + '"></div>' +
    '</div>' +
    '<div class="form-row"><label>买家</label>' +
      '<input name="buyer" value="' + (r.buyer ? esc(r.buyer) : '') + '"></div>' +
    '<div class="form-two-col">' +
      '<div class="form-row"><label>买单号</label>' +
        '<input name="buyOrderNo" value="' + (r.buyOrderNo ? esc(r.buyOrderNo) : '') + '"></div>' +
      '<div class="form-row"><label>卖单号</label>' +
        '<input name="sellOrderNo" value="' + (r.sellOrderNo ? esc(r.sellOrderNo) : '') + '"></div>' +
    '</div>' +
    '<div class="form-row"><label>备注</label>' +
      '<input name="note" value="' + (r.note ? esc(r.note) : '') + '"></div>' +
    '<div class="form-check">' +
      '<label><input type="checkbox" name="shipped"' + (r.shipped ? ' checked' : '') + '>已发货</label>' +
      '<label><input type="checkbox" name="paid"' + (r.paid ? ' checked' : '') + '>已回款</label>' +
      '<label><input type="checkbox" name="cpsValid"' + (r.cpsValid !== false ? ' checked' : '') + '>CPS 有效</label>' +
    '</div>' +
    '<div class="btn-row">' +
      '<button type="button" class="btn" id="tf-cancel">取消</button>' +
      '<button type="submit" class="btn primary">保存</button>' +
    '</div></form>';
  openModal(html);
  $('#tf-cancel').onclick = closeModal;
  $('#trade-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const f = e.target;
    const patch = {
      name: f.name.value.trim(),
      platform: f.platform.value.trim(),
      date: f.date.value.replace('T', ' ') + ':00',
      buyPrice: parseFloat(f.buyPrice.value) || 0,
      sellPrice: parseFloat(f.sellPrice.value) || 0,
      fee: parseFloat(f.fee.value) || 0,
      cps: parseFloat(f.cps.value) || 0,
      buyer: f.buyer.value.trim(),
      buyOrderNo: f.buyOrderNo.value.trim(),
      sellOrderNo: f.sellOrderNo.value.trim(),
      note: f.note.value.trim(),
      shipped: f.shipped.checked,
      paid: f.paid.checked,
      cpsValid: f.cpsValid.checked,
      refunded: !!r.refunded
    };
    if (!patch.name) { alert('请填写商品名'); return; }
    if (isEdit) Trades.updateRecord(r, patch);
    else Trades.addRecord(patch);
    Trades.refresh();
    closeModal();
    toast(isEdit ? '已保存' : '已添加');
    scheduleBackup();
  });
}
function openTradeActions(rec) {
  if (!rec) return;
  const title = rec.name.length > 20 ? rec.name.slice(0, 20) + '…' : rec.name;
  const actions = [];
  if (rec.refunded) {
    actions.push({ label: '取消退款', fn: () => { Trades.markRefunded(rec, false); toast('已取消退款'); } });
  } else {
    actions.push({ label: rec.shipped ? '标为待发货' : '标为已发货',
      fn: () => { Trades.markShipped(rec, !rec.shipped); toast(rec.shipped ? '已取消发货' : '已标发货'); } });
    if (rec.sellPrice > 0) {
      actions.push({ label: rec.paid ? '标为待回款' : '标为已回款',
        fn: () => { Trades.markPaid(rec, !rec.paid); toast(rec.paid ? '已取消回款' : '已标回款'); } });
    }
    actions.push({ label: '编辑', fn: () => { closeModal(); setTimeout(() => openTradeForm(rec), 100); }, keepOpen: true });
    actions.push({ label: '标为已退款', fn: () => { Trades.markRefunded(rec, true); toast('已标退款'); } });
  }
  actions.push({ label: '删除', danger: true, fn: () => {
    if (!confirm('删除这条交易？不可恢复')) return;
    Trades.deleteRecord(rec); toast('已删除');
  } });
  const html = '<h3>' + esc(title) + '</h3>' +
    actions.map((a, i) => '<button class="action-btn' + (a.danger ? ' danger' : '') + '" data-i="' + i + '">' + a.label + '</button>').join('') +
    '<div class="btn-row"><button class="btn" id="ta-cancel">取消</button></div>';
  openModal(html);
  $('#ta-cancel').onclick = closeModal;
  document.querySelectorAll('#modal-root .action-btn').forEach(b => {
    b.onclick = () => {
      const a = actions[b.dataset.i];
      a.fn();
      if (!a.keepOpen) { Trades.refresh(); closeModal(); scheduleBackup(); }
    };
  });
}
document.addEventListener('trade-longpress', function(e) {
  const idx = parseInt(e.detail.idx, 10);
  const rec = Trades.getRecordByFilteredIdx(idx);
  if (rec) openTradeActions(rec);
});
$('#fab-trade').onclick = () => openTradeForm(null);

// ---------- 云同步条 / 打开自动拉 / 下拉刷新 ----------
function showSync(kind, msg, autoHide) {
  const bar = $('#sync-bar');
  if (!bar) return;
  bar.className = 'sync-bar' + (kind ? ' ' + kind : '');
  bar.textContent = msg;
  if (autoHide) setTimeout(() => bar.classList.add('hidden'), 2000);
}
function hideSync() { const bar = $('#sync-bar'); if (bar) bar.classList.add('hidden'); }
async function pullFromGist(silent) {
  const s = state.settings;
  if (!s.gistToken || !s.gistId) { if (!silent) toast('未配置 Gist'); return false; }
  try {
    if (!silent) showSync('', '正在同步…');
    const content = await Gist.fetchBackup(s.gistToken, s.gistId);
    const parsed = await parseBackupContent(content, s.passphrase || '');
    // Write assets state (preserve local settings/token)
    const oldSettings = state.settings;
    state = parsed.data;
    state.settings = Object.assign({}, state.settings, oldSettings);
    saveState();
    // Write trades if present
    if (parsed.trades) {
      localStorage.setItem('assetbook.trades', parsed.trades);
      if (window.Trades) Trades.reload();
    }
    renderAll();
    showSync('ok', '已同步 · ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }), true);
    return true;
  } catch (e) {
    console.error('pull failed', e);
    showSync('error', '同步失败：' + (e && e.message ? e.message : String(e)), false);
    return false;
  }
}

// Pull-to-refresh
(function() {
  let startY = 0, pull = 0, pulling = false;
  const indicator = $('#ptr-indicator');
  const ptrText = indicator ? indicator.querySelector('.ptr-text') : null;
  document.addEventListener('touchstart', e => {
    // Ignore when a modal/overlay is up or scrolled down
    if ($('#modal-root').innerHTML) return;
    if (window.scrollY > 2) return;
    startY = e.touches[0].clientY; pulling = true; pull = 0;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!pulling) return;
    pull = e.touches[0].clientY - startY;
    if (pull > 0 && pull < 120) {
      indicator.classList.add('pull');
      indicator.style.transform = 'translateX(-50%) translateY(' + Math.min(pull, 60) + 'px)';
      if (ptrText) ptrText.textContent = pull > 60 ? '松开刷新' : '下拉刷新';
    }
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (!pulling) return;
    const trigger = pull > 60;
    pulling = false;
    if (!trigger) {
      indicator.classList.remove('pull');
      indicator.style.transform = '';
      pull = 0; return;
    }
    indicator.classList.remove('pull');
    indicator.classList.add('loading');
    indicator.style.transform = 'translateX(-50%) translateY(50px)';
    if (ptrText) ptrText.textContent = '正在同步…';
    pullFromGist(false).finally(() => {
      indicator.classList.remove('loading');
      indicator.style.transform = '';
    });
    pull = 0;
  });
})();

// On-open silent Gist pull
window.addEventListener('load', function() {
  const s = state.settings;
  if (s.gistToken && s.gistId) {
    showSync('', '正在从云端同步…');
    pullFromGist(true);
  }
});

renderTabbar();
renderAll();
updateTradeFab();
