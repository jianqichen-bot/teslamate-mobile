import { Link } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CarPicker } from "../../components/CarPicker";
import { CatalogScreen, ExternalPageGroup, catalogStyles } from "../../components/CatalogScreen";
import { useApiRequest } from "../../hooks/useApiRequest";
import { useCarSelection } from "../../hooks/useCarSelection";
import { fetchStatistics } from "../../services/api";
import { formatAmount } from "../../services/formatAmount";
import { analysisGroups } from "../../services/analysisCatalog";
import type { DailyActivity, StatisticsPeriod } from "../../types/statistics";

const periods: StatisticsPeriod[] = [7, 30, 90];
const metrics = {
  distanceKm: { label: "行驶里程", unit: " km", color: "#FF676E" },
  energyAddedKwh: { label: "充入电量", unit: " kWh", color: "#4FDEA1" },
} as const;
type TrendMetric = keyof typeof metrics;

export default function AnalyticsScreen() {
  const { state, carId, refresh } = useCarSelection();
  const car = state.status === "ready" ? state.cars.find((item) => item.id === carId) : undefined;
  const [days, setDays] = useState<StatisticsPeriod>(30);
  const [metric, setMetric] = useState<TrendMetric>("distanceKm");
  const [showDashboards, setShowDashboards] = useState(true);

  return (
    <CatalogScreen title="分析">
      <CarPicker />
      {car && (
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={catalogStyles.sectionTitle}>{car.name || `车辆 ${car.id}`}</Text>
            <Text style={catalogStyles.muted}>按本地日期统计</Text>
          </View>
          <View style={styles.controls}>
            {periods.map((period) => (
              <Choice key={period} title={`近 ${period} 天`} selected={days === period} onPress={() => setDays(period)} />
            ))}
          </View>
          <StatisticsResults key={`${car.id}/${days}`} carId={car.id} days={days} metric={metric} onMetricChange={setMetric} />
        </View>
      )}
      {state.status === "loading" && <Text style={catalogStyles.muted}>正在读取车辆…</Text>}
      {state.status === "error" && (
        <View style={catalogStyles.panel} accessibilityLiveRegion="polite">
          <Text style={catalogStyles.error}>{state.message}</Text>
          <Pressable accessibilityRole="button" onPress={refresh} style={catalogStyles.action}>
            <Text style={catalogStyles.sectionTitle}>重试</Text>
          </Pressable>
        </View>
      )}
      {state.status === "ready" && !car && <Text style={catalogStyles.muted}>还没有可统计的车辆。</Text>}
      {state.status !== "loading" && <Pressable accessibilityRole="button" accessibilityState={{ expanded: showDashboards }}
        onPress={() => setShowDashboards((visible) => !visible)} style={[catalogStyles.panel, styles.row, styles.disclosure]}>
        <Text style={catalogStyles.sectionTitle}>{car ? "分析报表" : "Grafana 仪表盘"}</Text>
        <Text aria-hidden style={catalogStyles.muted}>{showDashboards ? "−" : "+"}</Text>
      </Pressable>}
      {car && showDashboards && analysisGroups.map((group) => (
        <View key={group.title} style={styles.reportGroup}>
          <Text accessibilityRole="header" style={catalogStyles.sectionTitle}>{group.title}</Text>
          <View style={styles.reportPanel}>
            {group.pages.map((page, index) => (
              <Link key={page.uid} href={{
                pathname: "/analytics/[reportId]",
                params: { reportId: page.uid, carId: String(car.id), days: String(days) },
              }} asChild>
                <Pressable accessibilityRole="link" style={index > 0 ? styles.reportRowSeparated : styles.reportRow}>
                  <Text style={styles.choiceLabel}>{page.title}</Text>
                  <Text aria-hidden style={catalogStyles.muted}>›</Text>
                </Pressable>
              </Link>
            ))}
          </View>
        </View>
      ))}
      {!car && showDashboards && state.status !== "loading" && analysisGroups.map((group) => (
        <ExternalPageGroup key={group.title} title={group.title} pages={group.pages} source="Grafana" />
      ))}
    </CatalogScreen>
  );
}

function StatisticsResults({ carId, days, metric, onMetricChange }: {
  carId: number;
  days: StatisticsPeriod;
  metric: TrendMetric;
  onMetricChange: (metric: TrendMetric) => void;
}) {
  const load = useCallback((signal: AbortSignal) => fetchStatistics(carId, days, signal), [carId, days]);
  const { state, refresh } = useApiRequest(load, "无法读取车辆统计");

  if (state.status === "loading") return <Text style={catalogStyles.muted} accessibilityLiveRegion="polite">正在读取统计…</Text>;
  if (state.status === "error") return (
    <View style={catalogStyles.panel} accessibilityLiveRegion="polite">
      <Text style={catalogStyles.error}>{state.message}</Text>
      <Pressable accessibilityRole="button" onPress={refresh} style={catalogStyles.action}>
        <Text style={catalogStyles.sectionTitle}>重试</Text>
      </Pressable>
    </View>
  );

  const { summary, daily } = state.data;
  const noActivity = summary.driveCount === 0 && summary.chargeCount === 0;
  return (
    <>
      <Text style={catalogStyles.muted}>{daily[0].date.replace(/-/g, "/")} – {daily[daily.length - 1].date.replace(/-/g, "/")}</Text>
      {noActivity && <Text style={catalogStyles.muted}>这段时间没有已完成的行程或充电。</Text>}
      <View style={catalogStyles.panel}>
        <Text accessibilityRole="header" style={catalogStyles.sectionTitle}>行驶</Text>
        <View style={styles.values}>
          <Value title="行驶里程" amount={formatAmount(summary.driveCount ? summary.distanceKm : 0, " km")} />
          <Value title="行程次数" amount={formatAmount(summary.driveCount, " 次")} />
          <Value title="行驶时间" amount={formatAmount(summary.driveCount ? summary.driveMinutes : 0, " 分钟")} />
        </View>
      </View>
      <View style={catalogStyles.panel}>
        <Text accessibilityRole="header" style={catalogStyles.sectionTitle}>充电</Text>
        <View style={styles.values}>
          <Value title="充入电量" amount={formatAmount(summary.chargeCount ? summary.energyAddedKwh : 0, " kWh")} />
          <Value title="用电量" amount={formatAmount(summary.chargeCount ? summary.energyUsedKwh : 0, " kWh")} />
          <Value title="充电次数" amount={formatAmount(summary.chargeCount, " 次")} />
          <Value title="已记录费用" amount={summary.chargeCost === null ? "未记录" : formatAmount(summary.chargeCost, "", 2)} />
        </View>
        {summary.chargeCount > 0 && <Text style={catalogStyles.muted}>费用已记录 {summary.chargeCostCount} / {summary.chargeCount} 次</Text>}
      </View>
      <View style={catalogStyles.panel}>
        <Text accessibilityRole="header" style={catalogStyles.sectionTitle}>每日趋势</Text>
        <View style={styles.controls}>
          <Choice title="行驶里程" selected={metric === "distanceKm"} onPress={() => onMetricChange("distanceKm")} />
          <Choice title="充入电量" selected={metric === "energyAddedKwh"} onPress={() => onMetricChange("energyAddedKwh")} />
        </View>
        <ActivityChart daily={daily} metric={metric} />
      </View>
    </>
  );
}

function ActivityChart({ daily, metric }: { daily: DailyActivity[]; metric: TrendMetric }) {
  const { label, unit, color } = metrics[metric];
  const values = daily.map((day) => day[metric]);
  const peak = Math.max(0, ...values.map((value) => value ?? 0));
  if (peak === 0) {
    const allZero = values.includes(0) && values.every((value) => value === null || value === 0);
    return <Text style={catalogStyles.muted}>{allZero ? `已记录的${label}均为 0。` : `这段时间没有可用的${label}数据。`}</Text>;
  }

  const ticks = [daily[0], daily[Math.floor(daily.length / 2)], daily[daily.length - 1]];
  const peakDay = daily[values.indexOf(peak)];
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`${label}每日趋势，${shortDate(peakDay.date)}最高，${formatAmount(peak, unit)}`}>
      <Text style={styles.axis}>{formatAmount(peak, unit)}</Text>
      <View style={[styles.plot, { columnGap: daily.length > 30 ? 1 : 3 }]}>
        {daily.map((day) => (
          <View key={day.date} style={styles.column}>
            {(day[metric] ?? 0) > 0 && <View style={{ height: Math.max(2, Math.round((day[metric] ?? 0) / peak * 96)), backgroundColor: color }} />}
          </View>
        ))}
      </View>
      <View style={styles.row}>
        {ticks.map((day) => <Text key={day.date} style={styles.axis}>{shortDate(day.date)}</Text>)}
      </View>
    </View>
  );
}

function shortDate(date: string) {
  return date.slice(5).replace("-", "/");
}

function Choice({ title, selected, onPress }: { title: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}
      style={[styles.choice, selected && styles.selected]}>
      <Text style={styles.choiceLabel}>{title}</Text>
    </Pressable>
  );
}

function Value({ title, amount }: { title: string; amount: string }) {
  return <View style={styles.value}><Text style={styles.amount}>{amount}</Text><Text style={catalogStyles.muted}>{title}</Text></View>;
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 },
  disclosure: { minHeight: 54, alignItems: "center", justifyContent: "space-between" },
  reportGroup: { gap: 8 },
  reportPanel: { backgroundColor: "#17191D", borderColor: "#25282E", borderWidth: 1, borderRadius: 16, paddingHorizontal: 14 },
  reportRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  reportRowSeparated: {
    minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12,
    borderTopColor: "#25282E", borderTopWidth: 1,
  },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { minHeight: 44, justifyContent: "center", paddingHorizontal: 13, borderRadius: 10, borderWidth: 1, borderColor: "#343740" },
  selected: { borderColor: "#FF676E", backgroundColor: "#2A181C" },
  choiceLabel: { color: "#F5F6F7", fontSize: 14, fontWeight: "600" },
  values: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  value: { width: "46%", gap: 3, marginTop: 4 },
  amount: { color: "#F5F6F7", fontSize: 20, fontWeight: "700" },
  axis: { color: "#A7ABB3", fontSize: 12 },
  plot: { flexDirection: "row", height: 97, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#343740", marginVertical: 5 },
  column: { flex: 1, justifyContent: "flex-end" },
});
