# TeslaMate Mobile

TeslaMate Mobile 采用一个仓库、两个独立工程的结构：

- `teslamate-server`：Node.js / TypeScript 服务端，后续负责 API、数据访问与业务逻辑。
- `teslamate-app`：Expo / React Native / TypeScript 手机 App，负责界面、交互与客户端状态。

当前阶段只包含项目骨架和基础配置，尚未加入 TeslaMate 业务功能。

## 目录结构

```text
teslamate-mobile/
├── teslamate-server/
│   └── src/
│       ├── routes/
│       ├── services/
│       ├── repositories/
│       ├── middleware/
│       ├── config/
│       └── app.ts
└── teslamate-app/
    ├── app/
    ├── components/
    ├── hooks/
    ├── services/
    ├── stores/
    ├── types/
    └── assets/
```

## 服务端开发

在项目根目录安装依赖并启动服务端：

```bash
npm install
cp teslamate-server/.env.example teslamate-server/.env
npm run server:dev
```

## 移动端开发

移动端采用 Expo、React Native、TypeScript 和 Expo Router。在项目根目录运行：

```bash
cp teslamate-app/.env.example teslamate-app/.env
npm run app:start
```

也可以使用 `npm run app:ios`、`npm run app:android` 或 `npm run app:web` 启动对应平台。
