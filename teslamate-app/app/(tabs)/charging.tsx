import { Link } from "expo-router";
import { useCallback } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CarPicker } from "../../components/CarPicker";
import { ExternalPageGroup } from "../../components/CatalogScreen";
import { useApiRequest } from "../../hooks/useApiRequest";
import { useCarSelection } from "../../hooks/useCarSelection";
import { fetchCharges } from "../../services/api";
import { formatAmount } from "../../services/formatAmount";
import { chargingDashboards } from "../../services/teslamateLinks";

export default function ChargingScreen() {
  const { state, carId, refresh } = useCarSelection();
  const car = state.status === "ready" ? state.cars.find((item) => item.id === carId) : undefined;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>充电</Text>
        {car && <Text style={styles.muted}>{car.name || `车辆 ${car.id}`} · 最近 20 条已完成充电</Text>}
        <CarPicker />
        {state.status === "loading" && <Text style={styles.muted}>正在读取车辆…</Text>}
        {state.status === "error" && (
          <>
            <Text style={styles.error} accessibilityLiveRegion="polite">{state.message}</Text>
            <Pressable accessibilityRole="button" onPress={refresh} style={styles.action}>
              <Text style={styles.value}>重试</Text>
            </Pressable>
          </>
        )}
        {state.status === "ready" && !car && <Text style={styles.muted}>还没有可查看充电记录的车辆。</Text>}
      </View>
      {car ? <ChargeList key={car.id} carId={String(car.id)} /> : <View style={styles.footer}><GrafanaLinks /></View>}
    </SafeAreaView>
  );
}

function ChargeList({ carId }: { carId: string }) {
  const load = useCallback((signal: AbortSignal) => fetchCharges(carId, signal), [carId]);
  const { state, refresh } = useApiRequest(load, "无法读取充电记录");

  return (
    <FlatList
      data={state.status === "ready" ? state.data : []}
      keyExtractor={(charge) => String(charge.id)}
      contentContainerStyle={styles.list}
      refreshing={state.status === "loading"}
      onRefresh={refresh}
      ListHeaderComponent={
        <Pressable accessibilityRole="button" disabled={state.status === "loading"} onPress={refresh} style={styles.action}>
          <Text style={styles.value}>{state.status === "error" ? "重试" : "刷新充电记录"}</Text>
        </Pressable>
      }
      ListEmptyComponent={
        <View accessibilityLiveRegion="polite">
          {state.status === "loading" && <Text style={styles.muted}>正在读取充电记录…</Text>}
          {state.status === "error" && <Text style={styles.error}>{state.message}</Text>}
          {state.status === "ready" && <Text style={styles.muted}>这辆车还没有已完成的充电记录。</Text>}
        </View>
      }
      ListFooterComponent={<View style={styles.listFooter}><GrafanaLinks /></View>}
      renderItem={({ item }) => (
        <Link href={{ pathname: "/cars/[carId]/charges/[chargeId]", params: { carId, chargeId: String(item.id) } }} asChild>
          <Pressable accessibilityRole="link" style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.value}>{item.location || "暂无地点记录"}</Text>
              <Text style={styles.energy}>{formatAmount(item.energyAddedKwh, " kWh")}</Text>
            </View>
            <Text style={styles.muted}>{new Date(item.startedAt).toLocaleString("zh-CN")}</Text>
            <View style={styles.metrics}>
              <Text style={styles.muted}>电量 {formatAmount(item.startBatteryLevel, "%")} → {formatAmount(item.endBatteryLevel, "%")}</Text>
              <Text style={styles.muted}>用时 {formatAmount(item.durationMinutes, " 分钟")}</Text>
            </View>
          </Pressable>
        </Link>
      )}
    />
  );
}

function GrafanaLinks() {
  return <ExternalPageGroup title="在 Grafana 查看" pages={chargingDashboards} source="Grafana" />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0A0B0D" },
  header: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 12 },
  title: { color: "#FFFFFF", fontSize: 34, fontWeight: "700" },
  muted: { color: "#A7ABB3", fontSize: 14, lineHeight: 22 },
  error: { color: "#FF777C", fontSize: 14, marginTop: 8 },
  action: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  value: { color: "#F5F6F7", fontSize: 15, fontWeight: "600", flexShrink: 1 },
  energy: { color: "#4FDEA1", fontSize: 16, fontWeight: "700" },
  row: { flexDirection: "row", gap: 12, justifyContent: "space-between" },
  metrics: { flexDirection: "row", flexWrap: "wrap", columnGap: 16 },
  card: { backgroundColor: "#17191D", borderColor: "#25282E", borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12, gap: 6 },
  list: { paddingHorizontal: 24, paddingBottom: 24 },
  footer: { marginHorizontal: 24, marginTop: 12 },
  listFooter: { marginTop: 12 },
});
