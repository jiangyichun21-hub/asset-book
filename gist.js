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
      body: JSON.stringify({ description: 'asset-book 资产本自动备份（资产+交易）', public: false,
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
  async function listBackups(token, fetchImpl) {
    const f = fetchImpl || fetch;
    const res = await f(API + '/gists?per_page=100', { headers: headers(token) });
    if (!res.ok) throw new Error('列出 Gist 失败: HTTP ' + res.status);
    const arr = await res.json();
    return arr
      .filter(g => g.files && g.files[FILE])
      .map(g => ({ id: g.id, updatedAt: g.updated_at, description: g.description || '' }))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }
  return { FILE, createBackup, updateBackup, fetchBackup, pushBackup, listBackups };
});
