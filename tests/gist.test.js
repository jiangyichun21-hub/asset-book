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
