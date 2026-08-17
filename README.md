# 资产本 asset-book

个人资产盘点 PWA。记录各账户余额快照，自动计算总资产，查看资产趋势。

- 线上地址：https://jiangyichun21-hub.github.io/asset-book/
- 数据存储：手机本地 localStorage，不经过任何服务器
- 备份：GitHub 私有 Gist 自动备份（可选口令加密）+ JSON 手动导出
- 测试：`node --test tests/`
- 本地预览：`python3 -m http.server 8899` 后打开 http://localhost:8899
