# TeslaMate Mobile

TeslaMate Mobile 采用一个仓库、两个独立工程的结构：

- `teslamate-server`：Node.js / TypeScript 服务端，后续负责 API、数据访问与业务逻辑。
- `teslamate-app`：Expo / React Native / TypeScript 手机 App，负责界面、交互与客户端状态。

当前已实现服务端连接检测和车辆列表：App 显示车辆名称、车型、数据库记录状态、电量、额定续航、累计里程及采集时间，支持刷新、空列表及错误提示。行程数据尚未接入。

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

App 从 `teslamate-app/.env` 中读取 `EXPO_PUBLIC_API_URL`。本机 Web / iOS 模拟器可使用 `http://localhost:3000`；Android 官方模拟器通常使用 `http://10.0.2.2:3000`；真机请填写开发电脑的局域网 IP，并确保手机和电脑在同一网络。修改后重启 Expo。

服务端自动加载 `teslamate-server/.env`，已有进程环境变量优先。默认监听 `127.0.0.1`；真机局域网调试时在服务端 `.env` 设置 `HOST=0.0.0.0`。Web 调试地址必须列入 `CORS_ORIGINS`，多个地址以逗号分隔。

启动服务端后，可运行 `curl http://localhost:3000/health` 验证连接，应返回 `{"status":"ok","service":"teslamate-server"}`。健康检查仅表示服务进程可用，不代表已连接 TeslaMate 数据库。

## TeslaMate 数据库

在服务端 `.env` 中填写现有 TeslaMate PostgreSQL 地址（不要放入 App 的环境变量）：

```dotenv
DATABASE_URL=postgresql://readonly_user:password@database-host:5432/teslamate
```

密码中的特殊字符需 URL 编码。建议使用仅有 SELECT 权限的账号；连接池同时设置只读事务、3 秒连接超时和 5 秒 SQL 超时。不会创建或迁移 TeslaMate 表。

`GET /api/cars` 返回 `{ "cars": [...] }`，读取 `cars`、`states` 中尚未结束的状态和 `positions` 中每辆车最近一条记录。距离统一为 km，UTC 时间以 ISO 8601 返回；缺失数据为 `null`。页面展示历史采集值，不推断正在行驶或充电，也不调用 Tesla API 唤醒车辆。充电期间的最新电量目前未合并 `charges` 表。

数据库未配置和连接/表结构异常分别返回 HTTP 503，错误码为 `DATABASE_NOT_CONFIGURED` 和 `DATABASE_UNAVAILABLE`；无车辆返回空数组。该实现仍需在你的 TeslaMate 版本上实际联调。当前 API 尚未加入用户鉴权，仅用于本机或可信局域网；CORS 不是鉴权，不要直接暴露到公网。

## 验证

```bash
npm run app:typecheck
npm run server:build
npm test --workspace teslamate-server
```

集成测试需要 Docker 和 `postgres:17-alpine` 镜像，会创建隔离的临时数据库并在结束时删除容器，不读取真实 `DATABASE_URL`。测试覆盖多车、空数据、时间排序、只读限制和接口错误响应；测试表只覆盖本次使用的字段，不代替真实 TeslaMate 数据库兼容性验证。
