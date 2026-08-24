import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>TESLAMATE MOBILE</Text>
        <Text style={styles.title}>车辆数据，随时掌握</Text>
        <Text style={styles.description}>
          React Native 客户端已经就绪。下一步将连接 TeslaMate Server，展示车辆状态与行程数据。
        </Text>

        <View style={styles.card}>
          <View style={styles.statusDot} />
          <View>
            <Text style={styles.cardLabel}>应用状态</Text>
            <Text style={styles.cardValue}>移动端工程运行正常</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0A0B0D",
  },
  container: {
    flex: 1,
    justifyContent: "center",
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
