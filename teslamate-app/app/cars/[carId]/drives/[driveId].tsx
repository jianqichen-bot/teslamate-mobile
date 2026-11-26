import { useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DetailScreenHeader } from "../../../../components/DetailScreenHeader";
import { DriveTrackCard } from "../../../../components/DriveTrackCard";
import { useApiRequest } from "../../../../hooks/useApiRequest";
import { fetchDrive } from "../../../../services/api";
import { formatAmount } from "../../../../services/formatAmount";
import { isRouteId } from "../../../../types/drive";

export default function DriveDetailScreen() {
  const { carId, driveId } = useLocalSearchParams<{ carId: string; driveId: string }>();
  return (
    <SafeAreaView style={styles.screen}>
      <DetailScreenHeader title="行程详情" fallback="/drives" />
      {isRouteId(carId) && isRouteId(driveId)
        ? <DriveDetail key={`${carId}/${driveId}`} carId={carId} driveId={driveId} />
        : <Text style={[styles.error, styles.content]}>行程或车辆编号格式不正确。</Text>}
    </SafeAreaView>
  );
}

function DriveDetail({ carId, driveId }: { carId: string; driveId: string }) {
  const load = useCallback((signal: AbortSignal) => fetchDrive(carId, driveId, signal), [carId, driveId]);
  const { state, refresh } = useApiRequest(load, "无法读取行程详情");
  const drive = state.status === "ready" ? state.data : null;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {state.status === "loading" && <Text style={styles.muted}>正在读取行程详情…</Text>}
      {state.status === "error" && (
        <View accessibilityLiveRegion="polite">
          <Text style={styles.error}>{state.message}</Text>
          <Pressable accessibilityRole="button" onPress={refresh} style={styles.retry}>
            <Text style={styles.value}>重试</Text>
          </Pressable>
        </View>
      )}
      {drive && (
        <>
          <View style={styles.card}>
            <View style={styles.metrics}>
              <Metric label="距离" value={formatAmount(drive.distanceKm, " km")} />
              <Metric label="用时" value={formatAmount(drive.durationMinutes, " 分钟")} />
              <Metric label="估算用电" value={formatAmount(drive.estimatedEnergyKwh, " kWh")} />
            </View>
            {drive.estimatedEnergyKwh !== null && <Text style={styles.muted}>按额定续航变化和车辆能效估算</Text>}
          </View>
          <View style={styles.card}>
            <Stop label="出发" location={drive.startLocation} time={drive.startedAt} battery={drive.startBatteryLevel} />
            <View style={styles.divider} />
            <Stop label="到达" location={drive.endLocation} time={drive.endedAt} battery={drive.endBatteryLevel} />
          </View>
          <DriveTrackCard carId={carId} drive={drive} />
        </>
      )}
    </ScrollView>
  );
}

function Stop({ label, location, time, battery }: { label: string; location: string | null; time: string; battery: number | null }) {
  return (
    <View style={styles.stop}>
      <Text style={styles.muted}>{label} · {new Date(time).toLocaleString("zh-CN")}</Text>
      <Text style={styles.value}>{location || "暂无地点记录"}</Text>
      <Text style={styles.muted}>电量 {formatAmount(battery, "%")}</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.stop}><Text style={styles.value}>{value}</Text><Text style={styles.muted}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0A0B0D" },
  content: { paddingHorizontal: 24, paddingBottom: 24, gap: 14 },
  card: { backgroundColor: "#17191D", borderColor: "#25282E", borderRadius: 18, borderWidth: 1, padding: 18, gap: 14 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 20 },
  stop: { gap: 4 },
  value: { color: "#F5F6F7", fontSize: 17, fontWeight: "600" },
  muted: { color: "#A7ABB3", fontSize: 14, lineHeight: 21 },
  error: { color: "#FF777C", fontSize: 14 },
  divider: { borderBottomWidth: 1, borderColor: "#343740" },
  retry: { alignSelf: "flex-start", justifyContent: "center", minHeight: 44 },
});
