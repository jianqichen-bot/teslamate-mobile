import { useRouter, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function DetailScreenHeader({ title, fallback }: { title: string; fallback: Href }) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace(fallback)} style={styles.back}>
        <Text style={styles.action}>‹ 返回</Text>
      </Pressable>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 14 },
  back: { alignSelf: "flex-start", justifyContent: "center", minHeight: 44 },
  action: { color: "#F5F6F7", fontSize: 15, fontWeight: "600" },
  title: { color: "#FFFFFF", fontSize: 32, fontWeight: "700" },
});
