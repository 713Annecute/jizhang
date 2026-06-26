# 个人记账本 PWA - Render 无依赖扁平版

这个版本专门解决手机 GitHub 网页上传不能保留文件夹的问题。

所有文件都放在同一层，不需要 `public`、`icons`、`data` 文件夹。

## 上传到 GitHub

1. 删除仓库里旧文件。
2. 解压这个 ZIP。
3. 把 ZIP 里的所有文件直接上传到 GitHub 仓库根目录。
4. 提交更改。

GitHub 根目录应该直接看到：

```text
README.md
package.json
server.js
render.yaml
index.html
manifest.webmanifest
offline.html
service-worker.js
expenses.json
icon.svg
icon-192.png
icon-512.png
```

## Render 设置

```text
Build Command: npm install
Start Command: npm start
Root Directory: 留空
```

## 测试

部署完成后先打开：

```text
https://你的地址.onrender.com/health
```

如果看到：

```text
indexFileExists: true
```

再打开首页：

```text
https://你的地址.onrender.com/
```
