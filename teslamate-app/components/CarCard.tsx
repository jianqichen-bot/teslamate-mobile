import { StyleSheet, Text, View } from "react-native";
import type { Car } from "../types/car";

const states: Record<string, string> = { online: "在线", asleep: "休眠", offline: "离线", suspended: "暂停采集" };
const metric = (value: number | null, unit: string) => value === null ? "—" : `${value.toLocaleString("zh-CN", { maximumFractionDigits: 1 })}${unit}`;
const date = (value: string | null) => value ? new Date(value).toLocaleString("zh-CN") : "暂无记录";

export function CarCard({ car }: { car: Car }) {
  return <View style={styles.card}>
    <Text style={styles.name}>{car.name || `车辆 ${car.id}`}</Text>
    <Text style={styles.muted}>{car.model ? `Model ${car.model}` : "车型未知"} · 记录状态：{car.state ? states[car.state] ?? car.state : "未知"}</Text>
    <View style={styles.metrics}>
      <View><Text style={styles.value}>{metric(car.batteryLevel, "%")}</Text><Text style={styles.muted}>电量</Text></View>
      <View><Text style={styles.value}>{metric(car.ratedRangeKm, " km")}</Text><Text style={styles.muted}>额定续航</Text></View>
    </View>
    <Text style={styles.muted}>累计里程 {metric(car.odometerKm, " km")}</Text>
    <Text style={styles.timestamp}>遥测采集：{date(car.updatedAt)}</Text>
    <Text style={styles.timestamp}>状态开始：{date(car.stateSince)}</Text>
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#17191D", borderColor: "#25282E", borderWidth: 1, borderRadius: 18, padding: 20, marginTop: 16 },
  name: { color: "#FFFFFF", fontSize: 22, fontWeight: "700", marginBottom: 8 },
  muted: { color: "#A7ABB3", fontSize: 14, lineHeight: 22 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 32, marginVertical: 20 },
  value: { color: "#FFFFFF", fontSize: 26, fontWeight: "600" },
  timestamp: { color: "#7D828C", fontSize: 12, marginTop: 8 },
});
