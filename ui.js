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

// ---------- 占位函数（后续任务替换为完整实现）----------
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
