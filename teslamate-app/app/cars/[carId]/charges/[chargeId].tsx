import { useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChargePowerChart } from "../../../../components/ChargePowerChart";
import { DetailScreenHeader } from "../../../../components/DetailScreenHeader";
import { useApiRequest } from "../../../../hooks/useApiRequest";
import { fetchCharge } from "../../../../services/api";
import { formatAmount } from "../../../../services/formatAmount";
import { isRouteId } from "../../../../types/drive";

export default function ChargeDetailScreen() {
  const { carId, chargeId } = useLocalSearchParams<{ carId: string; chargeId: string }>();
  return (
    <SafeAreaView style={styles.screen}>
      <DetailScreenHeader title="充电详情" fallback="/charging" />
      {isRouteId(carId) && isRouteId(chargeId)
        ? <ChargeDetail key={`${carId}/${chargeId}`} carId={carId} chargeId={chargeId} />
        : <Text style={[styles.error, styles.content]}>充电记录或车辆编号格式不正确。</Text>}
    </SafeAreaView>
  );
}

function ChargeDetail({ carId, chargeId }: { carId: string; chargeId: string }) {
  const load = useCallback((signal: AbortSignal) => fetchCharge(carId, chargeId, signal), [carId, chargeId]);
  const { state, refresh } = useApiRequest(load, "无法读取充电详情");
  const charge = state.status === "ready" ? state.data : null;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {state.status === "loading" && <Text style={styles.muted}>正在读取充电详情…</Text>}
      {state.status === "error" && (
        <View accessibilityLiveRegion="polite">
          <Text style={styles.error}>{state.message}</Text>
          <Pressable accessibilityRole="button" onPress={refresh} style={styles.retry}>
            <Text style={styles.value}>重试</Text>
          </Pressable>
        </View>
      )}
      {charge && (
        <>
          <View style={styles.card}>
            <Text style={styles.location}>{charge.location || "暂无地点记录"}</Text>
            <Text style={styles.muted}>开始 {new Date(charge.startedAt).toLocaleString("zh-CN")}</Text>
            <Text style={styles.muted}>结束 {new Date(charge.endedAt).toLocaleString("zh-CN")}</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.metrics}>
              <Metric label="充入电量" value={formatAmount(charge.energyAddedKwh, " kWh")} />
              <Metric label="用电量" value={formatAmount(charge.energyUsedKwh, " kWh")} />
              <Metric label="用时" value={formatAmount(charge.durationMinutes, " 分钟")} />
              <Metric label="起止电量" value={`${formatAmount(charge.startBatteryLevel, "%")} → ${formatAmount(charge.endBatteryLevel, "%")}`} />
              <Metric label="记录费用" value={charge.cost === null ? "未记录" : formatAmount(charge.cost, "", 2)} />
            </View>
          </View>
          <ChargePowerChart points={charge.powerPoints} peakPowerKw={charge.peakPowerKw} sampled={charge.powerSampled} />
        </>
      )}
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.value}>{value}</Text><Text style={styles.muted}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0A0B0D" },
  content: { paddingHorizontal: 24, paddingBottom: 24, gap: 14 },
  card: { backgroundColor: "#17191D", borderColor: "#25282E", borderRadius: 18, borderWidth: 1, padding: 16, gap: 6 },
  location: { color: "#F5F6F7", fontSize: 21, fontWeight: "700" },
  value: { color: "#F5F6F7", fontSize: 17, fontWeight: "600" },
  muted: { color: "#A7ABB3", fontSize: 14, lineHeight: 21 },
  error: { color: "#FF777C", fontSize: 14 },
  metrics: { flexDirection: "row", flexWrap: "wrap", rowGap: 14, justifyContent: "space-between" },
  metric: { width: "47%", gap: 3 },
  retry: { alignSelf: "flex-start", justifyContent: "center", minHeight: 44 },
});
