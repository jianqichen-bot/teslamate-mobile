import { Link, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useApiRequest } from "../hooks/useApiRequest";
import { fetchAnalysisReport, fetchCars, fetchStatistics } from "../services/api";
import { reportKind, summaryMode, type ReportMode, type SummaryMode } from "../services/analysisCatalog";
import { formatAmount } from "../services/formatAmount";
import { amount, field, type AnalysisReport, type ReportRow } from "../types/analysis";
import type { StatisticsPeriod } from "../types/statistics";
import { CarCard } from "./CarCard";
import { catalogStyles } from "./CatalogScreen";
import { LocationPlot } from "./DriveTrackCard";

const stateLabels: Record<string, string> = { online: "在线", asleep: "休眠", offline: "离线", suspended: "暂停采集" };
const pageSize = 30;

export function AnalysisReportBody({ mode, carId, days }: { mode: ReportMode; carId: string; days: StatisticsPeriod }) {
  return summaryMode(mode) ? (
    <SummaryReport mode={mode} carId={carId} days={days} />
  ) : (
    <DetailedReport mode={mode} carId={carId} days={days} />
  );
}

function SummaryReport({ mode, carId, days }: { mode: SummaryMode; carId: string; days: StatisticsPeriod }) {
  const load = useCallback((signal: AbortSignal) => fetchStatistics(Number(carId), days, signal), [carId, days]);
  const { state, refresh } = useApiRequest(load, "无法读取车辆统计");
  if (state.status !== "ready") return <RequestStatus state={state} onRetry={refresh} />;
  const { summary, daily } = state.data;
  const showDriving = mode !== "charging";
  const showCharging = mode !== "driving";

  return (
    <>
      {mode === "overview" && <VehicleSnapshot carId={Number(carId)} />}
      <Text style={catalogStyles.muted}>{daily[0].date} 至 {daily.at(-1)?.date}</Text>
      {mode === "home" && (
        <View style={catalogStyles.panel}>
          <Text accessibilityRole="header" style={catalogStyles.sectionTitle}>车辆入口</Text>
          <View style={styles.shortcuts}>
            <Shortcut title="车辆" href="/" />
            <Shortcut title="行程" href="/drives" />
            <Shortcut title="充电" href="/charging" />
          </View>
        </View>
      )}
      {showDriving && (
        <>
          <MetricPanel title="行驶汇总" values={[
            ["行驶里程", formatAmount(summary.driveCount ? summary.distanceKm : 0, " km")],
            ["行程次数", formatAmount(summary.driveCount, " 次")],
            ["行驶时间", formatAmount(summary.driveCount ? summary.driveMinutes : 0, " 分钟")],
          ]} />
          <SeriesChart title="每日里程" unit=" km" values={daily.map((day) => ({ date: day.date, value: day.distanceKm }))} />
        </>
      )}
      {showCharging && (
        <>
          <MetricPanel title="充电汇总" values={[
            ["充入电量", formatAmount(summary.chargeCount ? summary.energyAddedKwh : 0, " kWh")],
            ["用电量", formatAmount(summary.chargeCount ? summary.energyUsedKwh : 0, " kWh")],
            ["充电次数", formatAmount(summary.chargeCount, " 次")],
            ["已记录费用", summary.chargeCost === null ? "未记录" : formatAmount(summary.chargeCost, "", 2)],
          ]} note={summary.chargeCount > 0 ? `费用已记录 ${summary.chargeCostCount} / ${summary.chargeCount} 次` : undefined} />
          <SeriesChart title="每日充入电量" unit=" kWh" values={daily.map((day) => ({ date: day.date, value: day.energyAddedKwh }))} />
        </>
      )}
    </>
  );
}

function VehicleSnapshot({ carId }: { carId: number }) {
  const { state, refresh } = useApiRequest(fetchCars, "无法读取车辆概览");
  if (state.status !== "ready") return <RequestStatus state={state} onRetry={refresh} />;
  const car = state.data.find((item) => item.id === carId);
  return car ? <CarCard car={car} /> : <Text style={catalogStyles.muted}>找不到该车辆。</Text>;
}

function DetailedReport({ mode, carId, days }: { mode: Exclude<ReportMode, SummaryMode>; carId: string; days: StatisticsPeriod }) {
  const [page, setPage] = useState(1);
  return <ReportPage key={page} mode={mode} carId={carId} days={days} page={page} setPage={setPage} />;
}

function ReportPage({ mode, carId, days, page, setPage }: {
  mode: Exclude<ReportMode, SummaryMode>;
  carId: string;
  days: StatisticsPeriod;
  page: number;
  setPage: (page: number) => void;
}) {
  const kind = reportKind(mode);
  const load = useCallback((signal: AbortSignal) => fetchAnalysisReport(carId, kind, days, page, signal), [carId, kind, days, page]);
  const { state, refresh } = useApiRequest(load, "无法读取报表");
  if (state.status !== "ready") return <RequestStatus state={state} onRetry={refresh} />;
  const report = state.data;
  const pages = Math.ceil(report.rowCount / pageSize);
  const paginated = kind !== "battery" && kind !== "efficiency" && kind !== "database" && pages > 1;

  return (
    <>
      <Text style={catalogStyles.muted}>{date(report.from, true)} 至 {date(report.to, true)}</Text>
      <DetailedContent mode={mode} carId={carId} report={report} />
      {paginated && (
        <View style={styles.pager}>
          <PagerButton title="上一页" disabled={page <= 1} onPress={() => setPage(page - 1)} />
          <Text style={catalogStyles.muted}>{page} / {pages} 页</Text>
          <PagerButton title="下一页" disabled={page >= Math.min(pages, 10000)} onPress={() => setPage(page + 1)} />
        </View>
      )}
    </>
  );
}

function DetailedContent({ mode, carId, report }: { mode: Exclude<ReportMode, SummaryMode>; carId: string; report: AnalysisReport }) {
  const { rows, metrics, rowCount } = report;
  const kind = reportKind(mode);
  const measure = (key: string, unit = "") => formatAmount(metrics[key] ?? null, unit);

  if (kind === "database") return (
    <MetricPanel title={`PostgreSQL ${report.version ?? ""}`} values={[
      ["全库大小", formatAmount(metrics.sizeBytes == null ? null : metrics.sizeBytes / 1024 ** 2, " MB")],
      ["行程记录", measure("driveCount", " 条")], ["充电记录", measure("chargeCount", " 条")],
      ["位置采样", measure("positionCount", " 条")],
    ]} note="记录数按当前车辆和所选区间统计。" />
  );

  if (kind === "mileage") return (
    <>
      <MetricPanel title="里程表记录" values={[
        ["区间初次读数", measure("firstKm", " km")], ["区间末次读数", measure("lastKm", " km")],
        ["里程变化", formatAmount(metrics.firstKm == null || metrics.lastKm == null ? null : metrics.lastKm - metrics.firstKm, " km")],
        ["有效采样", measure("samples", " 条")],
      ]} note="里程表读数来自车辆遥测，可能包含 TeslaMate 未完整记录的行程。" />
      <SeriesChart title="每日末次里程表读数" unit=" km" values={series(rows, "odometerKm")} />
    </>
  );

  if (kind === "battery") {
    const level = mode === "charge-level" || mode === "battery";
    const projected = mode === "projected-range";
    return (
      <>
        <MetricPanel title={level ? "电量记录" : "额定续航观测"} values={level ? [
          ["区间最近电量", measure("latestLevel", "%")],
          ["有电量记录的天数", formatAmount(rows.filter((row) => amount(row, "latestLevel") !== null).length, " 天")],
        ] : projected ? [
          ["区间最近额定续航", measure("ratedRangeKm", " km")],
          ["最近折算满电续航", measure("projectedRangeKm", " km")],
        ] : [
          ["区间最近额定续航", measure("ratedRangeKm", " km")],
          ["最近满电等效续航", measure("fullRangeKm", " km")],
          ["估算电池容量", measure("capacityKwh", " kWh")],
          ["区间最高满电等效续航", measure("peakFullRangeKm", " km")],
          ["有高电量样本的天数", measure("sampleDays", " 天")],
        ]} note={level ? "合并位置与充电采样。" : projected
          ? "用 20% 至 100% 电量样本的额定续航折算满电值。可在 Grafana 按温度和里程对照。"
          : "按 90% 至 100% 电量时的额定续航折算。容量由满电等效续航和车辆能效估算。"} />
        <SeriesChart title={level ? "每日末次电量" : "满电等效续航趋势"} unit={level ? "%" : " km"}
          values={series(rows, level ? "latestLevel" : projected ? "projectedRangeKm" : "fullRangeKm")} />
        {level && <SeriesChart title="每日最低电量" unit="%" values={series(rows, "minLevel")} />}
        {mode === "battery-health" && <Text style={catalogStyles.muted}>原版退化分析可在 Grafana 查看。</Text>}
      </>
    );
  }

  if (kind === "efficiency") return (
    <>
      <MetricPanel title="区间估算能耗" values={[
        ["平均能耗", measure("kwhPer100Km", " kWh/100 km")],
        ["估算用电", measure("energyKwh", " kWh")], ["参与估算的里程", measure("distanceKm", " km")],
        ["有估算数据的行程", measure("samples", " 次")],
      ]} note="按额定续航下降与车辆能效计算，仅纳入有有效估算的行程。" />
      <SeriesChart title="每日平均能耗" unit=" kWh/100 km" values={series(rows, "kwhPer100Km")} />
    </>
  );

  if (kind === "places") return (
    <>
      <MetricPanel title="到访汇总" values={[
        ["记录地点", formatAmount(rowCount, " 处")], ["到访", measure("visits", " 次")],
        ["涉及城市", measure("cities", " 个")], ["涉及地区", measure("regions", " 个")],
        ["涉及国家", measure("countries", " 个")],
      ]} note="按行程到达地点统计，优先使用围栏名称。" />
      {mode === "visited" && <LocationPlot points={rows.flatMap((row) => {
        const latitude = amount(row, "latitude");
        const longitude = amount(row, "longitude");
        return latitude !== null && longitude !== null ? [{ latitude, longitude }] : [];
      })} />}
      {mode === "visited" && <Text style={catalogStyles.muted}>地图预览展示当前页的到访地点。全部历史轨迹可在 Grafana 查看。</Text>}
      <RowList title="地点记录" rows={rows} render={(row) => (
        <TextRow key={field(row, "key")} title={field(row, "label") ?? "未命名地点"}
          detail={[field(row, "city"), field(row, "state"), field(row, "country"),
            formatAmount(amount(row, "count"), " 次"), `最近到访 ${date(field(row, "lastVisitedAt"))}`].filter(Boolean).join(" · ")} />
      )} />
    </>
  );

  if (kind === "drain") return (
    <>
      <MetricPanel title="静置耗电估算" values={[
        ["有效区间", formatAmount(rowCount, " 段")], ["累计电量下降", measure("loss", " 个百分点")],
        ["折算每天", measure("lossPerDay", " 个百分点")], ["估算耗电", measure("energyKwh", " kWh")],
      ]} note="从相邻行程或充电之间选取至少 30 分钟的停放区间，要求首尾有电量记录且里程变化不足 1 km。" />
      <RowList title="静置区间" rows={rows} render={(row) => (
        <TextRow key={`${field(row, "kind")}/${amount(row, "id")}`} title={`${formatAmount(amount(row, "startLevel"), "%")} → ${formatAmount(amount(row, "endLevel"), "%")}`}
          detail={`${date(field(row, "startedAt"))} · ${formatAmount(amount(row, "minutes"), " 分钟")}`} />
      )} />
    </>
  );

  return (
    <>
      {kind === "states" && <MetricPanel title="状态时长" values={[
        ["在线", formatAmount((metrics.onlineMinutes ?? 0) / 60, " 小时")],
        ["休眠", formatAmount((metrics.asleepMinutes ?? 0) / 60, " 小时")],
        ["离线", formatAmount((metrics.offlineMinutes ?? 0) / 60, " 小时")],
        ["状态记录", formatAmount(rowCount, " 段")],
      ]} note="仅统计落在所选日期范围内的时长。" />}
      {kind === "updates" && <MetricPanel title="软件更新" values={[
        ["更新记录", formatAmount(rowCount, " 次")], ["本页最近版本", field(rows[0] ?? {}, "label") ?? "暂无记录"],
      ]} />}
      {kind !== "states" && kind !== "updates" && <MetricPanel title="区间汇总" values={[
        ...(kind === "charges" ? [] : [["行程次数", measure("driveCount", " 次")], ["行驶里程", measure("distanceKm", " km")]] as [string, string][]),
        ...(kind === "drives" ? [] : [["充电次数", measure("chargeCount", " 次")], ["充入电量", measure("energyAddedKwh", " kWh")]] as [string, string][]),
        ...(kind === "journeys" ? [["行驶用时", measure("driveMinutes", " 分钟")], ["充电用时", measure("chargeMinutes", " 分钟")]] as [string, string][] : []),
      ]} />}
      {mode === "tax" && <Text style={catalogStyles.muted}>这里按区间列出原始行程。税务分类及原版表格可在 Grafana 查看。</Text>}
      <RowList title={kind === "states" ? "状态记录" : kind === "updates" ? "版本记录" : "按时间排序"} rows={rows}
        render={(row) => <EventRow key={`${field(row, "kind")}/${amount(row, "id")}`} row={row} carId={carId} showOdometer={mode === "tax"} />} />
    </>
  );
}

function EventRow({ row, carId, showOdometer }: { row: ReportRow; carId: string; showOdometer: boolean }) {
  const kind = field(row, "kind");
  const id = amount(row, "id");
  const label = field(row, "label");
  const title = kind === "drive" ? `${field(row, "startPlace") ?? "出发"} → ${field(row, "endPlace") ?? "到达"}`
    : kind === "charge" ? label ?? "充电" : kind === "state" ? stateLabels[label ?? ""] ?? label ?? "未知状态" : label ?? "软件更新";
  const details = [date(field(row, "startedAt"))];
  if (kind === "drive") details.push(formatAmount(amount(row, "amount"), " km"));
  if (kind === "charge") details.push(formatAmount(amount(row, "amount"), " kWh"));
  if (kind === "charge" && amount(row, "cost") !== null) details.push(`费用 ${formatAmount(amount(row, "cost"), "", 2)}`);
  if (amount(row, "minutes") !== null) details.push(formatAmount(amount(row, "minutes"), " 分钟"));
  if (field(row, "endedAt") === null) details.push("进行中");
  if (showOdometer) {
    details.push(`到达 ${date(field(row, "endedAt"))}`);
    details.push(`里程表 ${formatAmount(amount(row, "startOdometer"), " km")} → ${formatAmount(amount(row, "endOdometer"), " km")}`);
  }

  const href: Href | undefined = id !== null && kind === "drive"
    ? { pathname: "/cars/[carId]/drives/[driveId]", params: { carId, driveId: String(id) } }
    : id !== null && kind === "charge"
      ? { pathname: "/cars/[carId]/charges/[chargeId]", params: { carId, chargeId: String(id) } }
      : undefined;
  return <TextRow title={title} detail={details.join(showOdometer ? "\n" : " · ")} href={href} />;
}

function RequestStatus({ state, onRetry }: { state: { status: "loading" } | { status: "error"; message: string }; onRetry: () => void }) {
  return state.status === "loading" ? <Text style={catalogStyles.muted} accessibilityLiveRegion="polite">正在读取报表…</Text> : (
    <View style={catalogStyles.panel} accessibilityLiveRegion="polite">
      <Text style={catalogStyles.error}>{state.message}</Text>
      <PagerButton title="重试" disabled={false} onPress={onRetry} />
    </View>
  );
}

function MetricPanel({ title, values, note }: { title: string; values: [string, string][]; note?: string }) {
  return (
    <View style={catalogStyles.panel}>
      <Text accessibilityRole="header" style={catalogStyles.sectionTitle}>{title}</Text>
      {values.length > 0 && <View style={styles.metrics}>
        {values.map(([label, value]) => <View key={label} style={styles.metric}>
          <Text style={styles.value}>{value}</Text><Text style={catalogStyles.muted}>{label}</Text>
        </View>)}
      </View>}
      {note && <Text style={catalogStyles.muted}>{note}</Text>}
    </View>
  );
}

function RowList({ title, rows, render }: { title: string; rows: ReportRow[]; render: (row: ReportRow) => React.ReactNode }) {
  return <View style={catalogStyles.panel}>
    <Text accessibilityRole="header" style={catalogStyles.sectionTitle}>{title}</Text>
    {rows.length ? rows.map(render) : <Text style={catalogStyles.muted}>此区间没有可显示的记录。</Text>}
  </View>;
}

function TextRow({ title, detail, href }: { title: string; detail: string; href?: Href }) {
  const content = <>
    <View style={styles.rowText}><Text style={styles.rowTitle}>{title}</Text><Text style={catalogStyles.muted}>{detail}</Text></View>
    {href && <Text aria-hidden style={catalogStyles.muted}>›</Text>}
  </>;
  return href ? (
    <Link href={href} asChild><Pressable accessibilityRole="link" style={styles.record}>{content}</Pressable></Link>
  ) : <View style={styles.record}>{content}</View>;
}

function series(rows: ReportRow[], key: string) {
  return rows.map((row) => ({ date: field(row, "date") ?? "", value: amount(row, key) }));
}

function SeriesChart({ title, unit, values }: { title: string; unit: string; values: { date: string; value: number | null }[] }) {
  const points = values.filter((point) => point.date && point.value !== null);
  const peak = Math.max(0, ...points.map((point) => point.value ?? 0));
  const first = points[0]?.date;
  const last = points.at(-1)?.date;
  return (
    <View style={catalogStyles.panel}>
      <Text accessibilityRole="header" style={catalogStyles.sectionTitle}>{title}</Text>
      {points.length === 0 && <Text style={catalogStyles.muted}>此区间没有可绘制的数据。</Text>}
      {points.length > 0 && (<View accessible accessibilityRole="image" accessibilityLabel={`${title}，最高 ${formatAmount(peak, unit)}`}>
        <Text style={catalogStyles.muted}>{formatAmount(peak, unit)}</Text>
        <View style={[styles.plot, { columnGap: values.length > 30 ? 1 : 3 }]}>
          {values.map((point) => <View key={point.date} style={styles.column}>
            {peak > 0 && (point.value ?? 0) > 0 && <View style={{ height: Math.max(2, 90 * (point.value ?? 0) / peak), backgroundColor: "#FF676E" }} />}
          </View>)}
        </View>
        <View style={styles.pager}><Text style={catalogStyles.muted}>{first?.slice(5)}</Text><Text style={catalogStyles.muted}>{last?.slice(5)}</Text></View>
      </View>)}
    </View>
  );
}

function Shortcut({ title, href }: { title: string; href: Href }) {
  return <Link href={href} asChild><Pressable accessibilityRole="link" style={styles.button}><Text style={styles.rowTitle}>{title} ›</Text></Pressable></Link>;
}

function PagerButton({ title, disabled, onPress }: { title: string; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}>
    <Text style={styles.rowTitle}>{title}</Text>
  </Pressable>;
}

function date(value: string | null, dateOnly = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  const stamp = new Date(value);
  return dateOnly ? stamp.toLocaleDateString("zh-CN") : stamp.toLocaleString("zh-CN");
}

const styles = StyleSheet.create({
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { width: "46%", gap: 3, marginTop: 4 },
  value: { color: "#F5F6F7", fontSize: 19, fontWeight: "700" },
  shortcuts: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  plot: { flexDirection: "row", height: 91, borderBottomWidth: 1, borderColor: "#343740", marginVertical: 5 },
  column: { flex: 1, justifyContent: "flex-end" },
  record: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 54,
    paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#30323A" },
  rowText: { flex: 1, gap: 4 },
  rowTitle: { color: "#F5F6F7", fontSize: 15, fontWeight: "600" },
  pager: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  button: { minHeight: 44, paddingHorizontal: 12, justifyContent: "center", borderRadius: 9, backgroundColor: "#292B32" },
  disabled: { opacity: 0.36 },
});
