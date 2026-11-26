import { Link } from "expo-router";
import { useCallback } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useApiRequest } from "../hooks/useApiRequest";
import { fetchDrives } from "../services/api";

export function DriveList({ carId }: { carId: string }) {
  const load = useCallback((signal: AbortSignal) => fetchDrives(carId, signal), [carId]);
  const { state, refresh } = useApiRequest(load, "无法读取行程数据");

  return (
    <FlatList
      data={state.status === "ready" ? state.data : []}
      contentContainerStyle={styles.list}
      keyExtractor={(drive) => String(drive.id)}
      onRefresh={refresh}
      refreshing={state.status === "loading"}
      ListHeaderComponent={
        <Pressable accessibilityRole="button" disabled={state.status === "loading"} onPress={refresh} style={styles.action}>
          <Text style={styles.actionText}>{state.status === "error" ? "重试" : "刷新行程"}</Text>
        </Pressable>
      }
      ListEmptyComponent={
        <View accessibilityLiveRegion="polite">
          {state.status === "loading" && <Text style={styles.muted}>正在读取行程…</Text>}
          {state.status === "error" && <Text style={styles.error}>{state.message}</Text>}
          {state.status === "ready" && <Text style={styles.muted}>这辆车还没有已完成的行程。</Text>}
        </View>
      }
      renderItem={({ item }) => (
        <Link href={{ pathname: "/cars/[carId]/drives/[driveId]", params: { carId, driveId: String(item.id) } }} asChild>
          <Pressable accessibilityRole="link" style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.time}>{new Date(item.startedAt).toLocaleString("zh-CN")}</Text>
              <Text style={styles.actionText} accessibilityElementsHidden>›</Text>
            </View>
            <Text style={styles.muted}>结束 {new Date(item.endedAt).toLocaleString("zh-CN")}</Text>
            <View style={styles.metrics}>
              <Text style={styles.time}>距离 {item.distanceKm === null ? "—" : `${item.distanceKm.toLocaleString("zh-CN", { maximumFractionDigits: 1 })} km`}</Text>
              <Text style={styles.time}>用时 {item.durationMinutes === null ? "—" : `${item.durationMinutes} 分钟`}</Text>
            </View>
          </Pressable>
        </Link>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 24, paddingBottom: 16 },
  action: { alignSelf: "flex-start", justifyContent: "center", minHeight: 44 },
  actionText: { color: "#F5F6F7", fontSize: 15, fontWeight: "600" },
  card: { backgroundColor: "#17191D", borderColor: "#25282E", borderRadius: 18, borderWidth: 1, marginBottom: 12, padding: 18, gap: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  time: { color: "#F5F6F7", fontSize: 15, fontWeight: "600" },
  muted: { color: "#A7ABB3", fontSize: 14, lineHeight: 22 },
  error: { color: "#FF777C", fontSize: 14 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 8 },
});
