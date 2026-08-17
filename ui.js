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
