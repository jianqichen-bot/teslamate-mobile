import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useServerHealth } from "../hooks/useServerHealth";
import { apiUrl } from "../services/api";
import { useCars } from "../hooks/useCars";
import { CarCard } from "../components/CarCard";

export default function HomeScreen() {
  const { state, retry } = useServerHealth();
  const { state: carsState, refresh } = useCars();
  const loading = state.status === "loading" || carsState.status === "loading";
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>TESLAMATE MOBILE</Text>
        <Text style={styles.title}>车辆数据，随时掌握</Text>
        <Text style={styles.description}>
          查看 TeslaMate 最近记录的车辆数据。采集时间可能存在延迟，以下并非实时状态。
        </Text>

        <View style={styles.card}>
          <View style={[styles.statusDot, { backgroundColor: state.status === "connected" ? "#44D07B" : state.status === "error" ? "#E82127" : "#E5B95C" }]} />
          <View style={{ flex: 1 }} accessibilityLiveRegion="polite">
            <Text style={styles.cardLabel}>服务端连接</Text>
            <Text style={styles.cardValue}>{state.status === "loading" ? "正在连接…" : state.status === "connected" ? "已连接 TeslaMate Server" : "连接失败"}</Text>
          </View>
        </View>
        <Text style={styles.endpoint} selectable>{apiUrl}</Text>
        {state.status === "error" && <Text style={styles.error}>{state.message}</Text>}
        <View accessibilityLiveRegion="polite">
          {carsState.status === "loading" && <Text style={styles.endpoint}>正在读取车辆…</Text>}
          {carsState.status === "error" && <Text style={styles.error}>{carsState.message}</Text>}
          {carsState.status === "ready" && carsState.cars.length === 0 && <Text style={styles.description}>还没有车辆，请先在 TeslaMate 中添加车辆。</Text>}
        </View>
        {carsState.status === "ready" && carsState.cars.map((car) => <CarCard key={car.id} car={car} />)}
        <Pressable accessibilityRole="button" disabled={loading} onPress={() => { retry(); refresh(); }} style={[styles.button, loading && { opacity: 0.5 }]}>
          <Text style={styles.cardValue}>{loading ? "正在刷新…" : "刷新数据"}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  endpoint: { color: "#7D828C", fontSize: 12, marginTop: 12 },
  error: { color: "#FF777C", fontSize: 14, marginTop: 12 },
  button: { alignItems: "center", backgroundColor: "#25282E", borderRadius: 12, marginTop: 20, padding: 14 },
  safeArea: {
    flex: 1,
    backgroundColor: "#0A0B0D",
  },
  container: {
    flexGrow: 1,
    paddingVertical: 36,
    paddingHorizontal: 28,
  },
  eyebrow: {
    color: "#E82127",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 14,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "700",
    lineHeight: 42,
  },
  description: {
    color: "#A7ABB3",
    fontSize: 16,
    lineHeight: 25,
    marginTop: 16,
  },
  card: {
    alignItems: "center",
    backgroundColor: "#17191D",
    borderColor: "#25282E",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    marginTop: 36,
    padding: 18,
  },
  statusDot: {
    backgroundColor: "#44D07B",
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  cardLabel: {
    color: "#7D828C",
    fontSize: 12,
    marginBottom: 3,
  },
  cardValue: {
    color: "#F5F6F7",
    fontSize: 15,
    fontWeight: "600",
  },
});
