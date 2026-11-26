import { Pressable, StyleSheet, Text, View } from "react-native";
import { useCarSelection } from "../hooks/useCarSelection";

export function CarPicker() {
  const { state, carId, selectCar } = useCarSelection();
  if (state.status !== "ready" || state.cars.length < 2) return null;

  return (
    <View style={styles.choices}>
      {state.cars.map((car) => (
        <Pressable
          key={car.id}
          accessibilityRole="button"
          accessibilityState={{ selected: car.id === carId }}
          onPress={() => selectCar(car.id)}
          style={[styles.choice, car.id === carId && styles.selected]}
        >
          <Text style={styles.label}>{car.name || `车辆 ${car.id}`}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 12 },
  choice: { minHeight: 44, justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: "#343740", paddingHorizontal: 12 },
  selected: { borderColor: "#FF676E", backgroundColor: "#2A181C" },
  label: { color: "#F5F6F7", fontSize: 14 },
});
