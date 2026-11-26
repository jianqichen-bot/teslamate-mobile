import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CarPicker } from "../../components/CarPicker";
import { DriveList } from "../../components/DriveList";
import { useCarSelection } from "../../hooks/useCarSelection";

export default function DrivesTab() {
  const { state, carId, refresh } = useCarSelection();
  const car = state.status === "ready" ? state.cars.find((item) => item.id === carId) : undefined;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>行程</Text>
        {car && <Text style={styles.muted}>{car.name || `车辆 ${car.id}`} · 最近 20 条已完成行程</Text>}
        <CarPicker />
        {state.status === "loading" && <Text style={styles.muted}>正在读取车辆…</Text>}
        {state.status === "error" && (
          <>
            <Text style={styles.error}>{state.message}</Text>
            <Pressable accessibilityRole="button" onPress={refresh} style={styles.retry}>
              <Text style={styles.retryText}>重试</Text>
            </Pressable>
          </>
        )}
        {state.status === "ready" && !car && <Text style={styles.muted}>还没有可查看行程的车辆。</Text>}
      </View>
      {car && <DriveList key={car.id} carId={String(car.id)} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0A0B0D" },
  header: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 12 },
  title: { color: "#FFFFFF", fontSize: 34, fontWeight: "700" },
  muted: { color: "#A7ABB3", fontSize: 14, marginTop: 8 },
  error: { color: "#FF777C", fontSize: 14, marginTop: 8 },
  retry: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  retryText: { color: "#F5F6F7", fontSize: 15, fontWeight: "600" },
});
