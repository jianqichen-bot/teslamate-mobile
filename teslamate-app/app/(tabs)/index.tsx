import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CarCard } from "../../components/CarCard";
import { CarPicker } from "../../components/CarPicker";
import { useCarSelection } from "../../hooks/useCarSelection";

export default function VehicleScreen() {
  const { state, refresh, carId } = useCarSelection();
  const car = state.status === "ready" ? state.cars.find((item) => item.id === carId) : undefined;
  const loading = state.status === "loading";

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>车辆</Text>
        <CarPicker />
        {car && <CarCard car={car} />}
        <View accessibilityLiveRegion="polite">
          {loading && <Text style={styles.muted}>正在读取车辆…</Text>}
          {state.status === "error" && <Text style={styles.error}>{state.message}</Text>}
          {state.status === "ready" && !car && <Text style={styles.muted}>请先在 TeslaMate 中添加车辆。</Text>}
        </View>
        <Pressable accessibilityRole="button" disabled={loading} onPress={refresh} style={[styles.button, loading && { opacity: 0.55 }]}>
          <Text style={styles.buttonLabel}>{loading ? "正在刷新…" : state.status === "error" ? "重试" : "刷新数据"}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0A0B0D" },
  content: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 24 },
  title: { color: "#FFFFFF", fontSize: 34, fontWeight: "700" },
  muted: { color: "#A7ABB3", fontSize: 15, marginTop: 16 },
  error: { color: "#FF777C", fontSize: 15, marginTop: 16 },
  button: { alignItems: "center", backgroundColor: "#25282E", borderRadius: 12, marginTop: 20, padding: 14 },
  buttonLabel: { color: "#F5F6F7", fontSize: 15, fontWeight: "600" },
});
