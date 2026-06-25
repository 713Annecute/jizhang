# Render 部署说明

这个项目可以部署到 Render，部署完成后会获得一个 `https://` 开头的网址，iPhone Safari 可以用它“添加到主屏幕”安装 PWA。

## 准备

1. 登录 GitHub。
2. 新建仓库，例如 `expense-tracker-pwa`。
3. 上传本项目全部文件，确保仓库根目录包含：
   - `package.json`
   - `server.js`
   - `render.yaml`
   - `public/index.html`
   - `public/manifest.webmanifest`
   - `public/service-worker.js`

## 在 Render 部署

1. 打开 `https://render.com` 并登录。
2. 点击 `New`。
3. 选择 `Web Service`。
4. 连接 GitHub 仓库。
5. 选择刚上传的项目仓库。
6. 使用以下配置：

```text
Environment: Node
Build Command: npm install
Start Command: npm start
```

如果 Render 识别到 `render.yaml`，也可以选择 Blueprint 部署。

## 部署后安装到 iPhone

1. 等 Render 部署成功，复制它给你的 `https://...onrender.com` 地址。
2. 用 iPhone 的 Safari 打开这个地址。
3. 点击底部分享按钮。
4. 选择“添加到主屏幕”。
5. 点击“添加”。

## 注意

- 免费 Render 服务一段时间不用可能会休眠，首次打开可能需要等待几十秒。
- 当前版本使用服务器上的 JSON 文件保存数据。免费服务重启或重新部署时，数据可能不适合长期保存。
- 如果要长期稳定使用，建议后续改成数据库版本，例如 PostgreSQL。
