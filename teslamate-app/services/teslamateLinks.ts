export type ExternalPage = { title: string; url: string | null };

function pageUrl(base: string | undefined, path: string) {
  if (!base?.trim()) return null;
  try {
    const url = new URL(base.trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null;
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/${path}`;
    return url.toString();
  } catch {
    return null;
  }
}

const grafanaBase = process.env.EXPO_PUBLIC_GRAFANA_URL;
const teslaMateBase = process.env.EXPO_PUBLIC_TESLAMATE_URL;

function dashboard(title: string, uid: string) {
  return { title, uid, url: pageUrl(grafanaBase, `d/${uid}`) };
}

export function analysisDashboardUrl(uid: string, carId: string, days: number) {
  const page = pageUrl(grafanaBase, `d/${uid}`);
  if (!page) return null;
  const end = new Date();
  const start = new Date(end);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days + 1);
  const url = new URL(page);
  url.search = new URLSearchParams({ "var-car_id": carId, from: String(start.getTime()), to: String(end.getTime()) }).toString();
  return url.toString();
}

export function driveMapUrl(carId: string, driveId: string, startedAt: string, endedAt: string) {
  const page = pageUrl(grafanaBase, "d/zm7wN6Zgz/drive-details");
  if (!page) return null;

  const from = Math.floor(Date.parse(startedAt) / 1000) * 1000;
  const to = Math.max(Math.ceil(Date.parse(endedAt) / 1000) * 1000, from + 1000);
  const url = new URL(page);
  url.search = new URLSearchParams({
    from: String(from),
    to: String(to),
    "var-car_id": carId,
    "var-drive_id": driveId,
    viewPanel: "4",
  }).toString();
  return url.toString();
}

function management(title: string, path: string): ExternalPage {
  return { title, url: pageUrl(teslaMateBase, path) };
}

export const chargingDashboards = [
  dashboard("充电记录", "TSmNYvRRk"),
  dashboard("单次充电详情", "BHhxFeZRz"),
  dashboard("充电统计", "-pkIkhmRz"),
  dashboard("电量历史", "WopVO_mgz"),
];

export const dashboardGroups = [
  {
    title: "概览与状态",
    pages: [
      dashboard("仪表盘主页", "be2m9kga7b8qoc"),
      dashboard("车辆概览", "kOuP_Fggz"),
      dashboard("车辆状态历史", "xo4BNRkZz"),
      dashboard("时间线", "SUBgwtigz"),
      dashboard("软件更新", "IiC07mgWz"),
    ],
  },
  {
    title: "行程与地点",
    pages: [
      dashboard("行程记录", "Y8upc6ZRk"),
      dashboard("单次行程详情", "zm7wN6Zgz"),
      dashboard("行程统计", "_7WkNSyWk"),
      dashboard("多段旅程", "FkUpJpQZk"),
      dashboard("地点", "ZzhF-aRWz"),
      dashboard("访问地点", "RG_DxSmgk"),
      dashboard("荷兰税务行程", "lBIoQIggk"),
    ],
  },
  { title: "充电", pages: chargingDashboards },
  {
    title: "能效与电池",
    pages: [
      dashboard("综合统计", "1EZnXszMk"),
      dashboard("里程", "NjtMTFggz"),
      dashboard("能效", "fu4SiQgWz"),
      dashboard("预计续航", "riqUfXgRz"),
      dashboard("电池健康", "jchmRiqUfXgTM"),
      dashboard("静置耗电", "zhHx2Fggk"),
    ],
  },
  { title: "系统", pages: [dashboard("数据库信息", "jchmDbInfo")] },
];

export const managementPages = [
  management("TeslaMate 网页", ""),
  management("地理围栏", "geo-fences"),
  management("采集与系统设置", "settings"),
  management("历史数据导入", "import"),
  management("Tesla 授权", "sign_in"),
];
