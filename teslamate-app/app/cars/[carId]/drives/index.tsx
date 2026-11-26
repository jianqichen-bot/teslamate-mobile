import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DriveList } from "../../../../components/DriveList";
import { DetailScreenHeader } from "../../../../components/DetailScreenHeader";
import { isRouteId } from "../../../../types/drive";

export default function CarDrivesScreen() {
  const { carId } = useLocalSearchParams<{ carId: string }>();
  return (
    <SafeAreaView style={styles.screen}>
      <DetailScreenHeader title="近期行程" fallback="/drives" />
      {isRouteId(carId) ? <DriveList key={carId} carId={carId} /> : <Text style={styles.error}>车辆编号格式不正确。</Text>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0A0B0D" },
  error: { color: "#FF777C", marginHorizontal: 24 },
});
