import { useState, type PropsWithChildren } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ExternalPage } from "../services/teslamateLinks";

export function CatalogScreen({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function ExternalPageGroup({ title, pages, source }: { title: string; pages: ExternalPage[]; source: string }) {
  const [error, setError] = useState("");
  const configured = pages.some((page) => page.url);

  async function openPage(page: ExternalPage) {
    if (!page.url) return;
    setError("");
    try {
      await Linking.openURL(page.url);
    } catch {
      setError(`无法打开「${page.title}」，请检查连接后重试。`);
    }
  }

  return (
    <View style={styles.group}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
      <View style={styles.panel}>
        {pages.map((page, index) => (
          <Pressable
            key={page.title}
            accessibilityRole="link"
            accessibilityLabel={`${page.title}（${source}）`}
            disabled={!page.url}
            onPress={() => void openPage(page)}
            style={[styles.row, index > 0 && styles.separator]}
          >
            <Text style={[styles.label, !page.url && styles.muted]}>{page.title}</Text>
            {page.url && <Text style={styles.muted} accessibilityElementsHidden>↗</Text>}
          </Pressable>
        ))}
      </View>
      {!configured && <Text style={styles.muted}>请先配置 {source} 地址。</Text>}
      {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
    </View>
  );
}

export const catalogStyles = StyleSheet.create({
  muted: { color: "#A7ABB3", fontSize: 14, lineHeight: 21 },
  error: { color: "#FF777C", fontSize: 14, lineHeight: 21 },
  panel: { backgroundColor: "#17191D", borderColor: "#25282E", borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  sectionTitle: { color: "#F5F6F7", fontSize: 17, fontWeight: "600" },
  action: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
});

const styles = StyleSheet.create({
  ...catalogStyles,
  screen: { flex: 1, backgroundColor: "#0A0B0D" },
  content: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 24, gap: 18 },
  title: { color: "#FFFFFF", fontSize: 34, fontWeight: "700" },
  group: { gap: 8 },
  panel: { backgroundColor: "#17191D", borderColor: "#25282E", borderWidth: 1, borderRadius: 16, paddingHorizontal: 14 },
  row: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 10, minHeight: 50 },
  separator: { borderTopColor: "#25282E", borderTopWidth: 1 },
  label: { color: "#F5F6F7", fontSize: 15, flexShrink: 1 },
});
