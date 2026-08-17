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
