# TeslaMate Mobile

TeslaMate Mobile 采用一个仓库、两个独立工程的结构：

- `teslamate-server`：Node.js / TypeScript 服务端，后续负责 API、数据访问与业务逻辑。
- `teslamate-app`：Expo / React Native / TypeScript 手机 App，负责界面、交互与客户端状态。

App 包含「车辆」「行程」「充电」「分析」「更多」五个底部入口。车辆、行程、充电和分析共享当前选中的车辆。行程详情包含起终点、起止时间、电量、距离、用时、估算用电和原生轨迹预览，可在 Grafana 打开对应的道路底图。充电详情包含地点、用时、起止电量、充入电量、用电量、记录费用和充电功率曲线。分析支持查看近 7、30、90 天的行驶、充电、费用和每日趋势。「充电」和「分析」也提供 Grafana 网页入口，「更多」提供服务连接诊断和 TeslaMate 网页管理入口。

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

在同一文件填写浏览器可访问的 `EXPO_PUBLIC_TESLAMATE_URL` 和 `EXPO_PUBLIC_GRAFANA_URL`，启用管理和仪表盘入口。只填写服务的基础地址，登录使用网站现有的身份验证。仪表盘目录使用 TeslaMate 2.2.0 预置的 23 个 Grafana 仪表盘 ID。

服务端自动加载 `teslamate-server/.env`，已有进程环境变量优先。默认监听 `127.0.0.1`；真机局域网调试时在服务端 `.env` 设置 `HOST=0.0.0.0`。Web 调试地址必须列入 `CORS_ORIGINS`，多个地址以逗号分隔。

启动服务端后，可运行 `curl http://localhost:3000/health` 验证连接，应返回 `{"status":"ok","service":"teslamate-server"}`。健康检查仅表示服务进程可用，不代表已连接 TeslaMate 数据库。

## TeslaMate 数据库

在服务端 `.env` 中填写现有 TeslaMate PostgreSQL 地址（不要放入 App 的环境变量）：

```dotenv
DATABASE_URL=postgresql://readonly_user:password@database-host:5432/teslamate
```

密码中的特殊字符需 URL 编码。建议使用仅有 SELECT 权限的账号；连接池同时设置只读事务、3 秒连接超时和 5 秒 SQL 超时。不会创建或迁移 TeslaMate 表。

`GET /api/cars` 返回 `{ "cars": [...] }`，读取 `cars`、`states` 中尚未结束的状态和 `positions` 中每辆车最近一条记录。距离统一为 km，UTC 时间以 ISO 8601 返回；缺失数据为 `null`。页面展示历史采集值，不推断正在行驶或充电，也不调用 Tesla API 唤醒车辆。充电期间的最新电量目前未合并 `charges` 表。

`GET /api/cars/:carId/drives` 返回 `{ "drives": [...] }`，读取 `drives` 中已完成的行程，按出发时间和行程 ID 降序排列，最多 20 条。每条包含 `id`、`startedAt`、`endedAt`、`distanceKm` 和 `durationMinutes`。API 返回 UTC 时间，App 按设备时区显示。车辆存在但无已完成行程时返回空数组。无效车辆编号返回 HTTP 400，车辆不存在返回 HTTP 404。

`GET /api/cars/:carId/drives/:driveId` 返回 `{ "drive": {...} }`，在列表字段之外提供起终点名称、起止电量和 `estimatedEnergyKwh`。显示地点优先采用围栏名称，缺少围栏时使用地址。估算用电以额定续航下降乘以 TeslaMate 的车辆能效，缺少输入或额定续航未下降时返回 `null`。如果使用专用只读角色，详情额外需要读取 `addresses(id, display_name)` 和 `geofences(id, name)`。行程不存在、未完成或属于其他车辆时返回 HTTP 404。

`GET /api/cars/:carId/drives/:driveId/track` 返回 `{ "track": { "recordedPointCount", "points" } }`。以记录时间和位置 ID 升序返回有效经纬度，最多 360 个点。超出时按位置顺序抽样并保留首尾点。存在行程但缺少有效定位时返回空数组。专用只读角色需能读取 `positions` 的 `id`、`car_id`、`drive_id`、`date`、`latitude` 和 `longitude`。预览由 App 直接绘制，点击地图入口时使用已配置的 Grafana。

`GET /api/cars/:carId/charges` 返回 `{ "charges": [...] }`，按开始时间和记录 ID 降序读取最近 20 次已完成充电。详情 `GET /api/cars/:carId/charges/:chargeId` 返回 `{ "charge": {...} }`，包含原始记录的用电量、费用、最高功率和功率曲线。原始功率采样超过 120 条时，按采样顺序分组取平均功率，最高功率仍取原始峰值。费用沿用 TeslaMate 的记录值。充电详情不存在、未完成或属于其他车辆时返回 HTTP 404。

如果使用专用只读角色，充电接口还需要读取 `charging_processes` 中的 `id`、`car_id`、`start_date`、`end_date`、`duration_min`、`charge_energy_added`、`charge_energy_used`、`start_battery_level`、`end_battery_level`、`cost`、`address_id` 和 `geofence_id`，以及 `charges` 中的 `id`、`charging_process_id`、`date` 和 `charger_power`。地点沿用行程详情使用的地址和围栏权限。

`GET /api/cars/:carId/statistics?days=30&timeZone=Asia%2FShanghai` 返回 `{ "statistics": { "days", "timeZone", "summary", "daily" } }`，支持 7、30、90 天，按客户端时区的自然日统计，包含今天。已完成行程和充电按开始日期归入对应的自然日。没有记录的费用为 `null`，并用 `chargeCostCount` 区分免费记录和缺少费用记录。此接口沿用车辆、行程和充电的读取权限。

分析页的 23 个入口先打开原生报表，并带入当前车辆和日期区间。每个报表保留 Grafana 原版入口。当前原生报表覆盖状态和版本记录、时间线、行程和充电、到访地点、累计里程、能耗、电量与续航、静置耗电及数据库信息。Grafana 继续提供原版税务分类、详细诊断以及完整历史轨迹等视图。

`GET /api/cars/:carId/reports/:kind` 返回 `{ "report": { "from", "to", "page", "rowCount", "metrics", "rows" } }`。支持 `drives`、`charges`、`states`、`updates`、`timeline`、`journeys`、`places`、`battery`、`efficiency`、`drain`、`database` 和 `mileage`。按时间或次数排列的记录每页 30 条，支持 `page`、`days` 和 `timeZone` 查询参数。专用只读账号需增加 `updates` 的 `id`、`car_id`、`start_date`、`end_date`、`version`，`charges` 的 `battery_level`，`addresses` 的 `city`、`state`、`country` 和经纬度，以及 `geofences` 的经纬度。

数据库未配置和连接/表结构异常分别返回 HTTP 503，错误码为 `DATABASE_NOT_CONFIGURED` 和 `DATABASE_UNAVAILABLE`；无车辆返回空数组。该实现仍需在你的 TeslaMate 版本上实际联调。当前 API 尚未加入用户鉴权，仅用于本机或可信局域网；CORS 不是鉴权，不要直接暴露到公网。

## 验证

```bash
npm run app:typecheck
npm run server:build
npm test --workspace teslamate-server
```

集成测试需要 Docker 和 `postgres:17-alpine` 镜像，会创建隔离的临时数据库并在结束时删除容器，不读取真实 `DATABASE_URL`。测试覆盖多车、空数据、时间排序、行程结果上限、只读限制和接口错误响应。测试表覆盖接口使用的字段。
