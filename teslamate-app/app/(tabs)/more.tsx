import { Pressable, Text, View } from "react-native";
import { CatalogScreen, ExternalPageGroup, catalogStyles as styles } from "../../components/CatalogScreen";
import { useServerHealth } from "../../hooks/useServerHealth";
import { apiUrl } from "../../services/api";
import { managementPages } from "../../services/teslamateLinks";

export default function MoreScreen() {
  const { state, retry } = useServerHealth();

  return (
    <CatalogScreen title="更多">
      <View style={styles.panel} accessibilityLiveRegion="polite">
        <Text accessibilityRole="header" style={styles.sectionTitle}>服务端连接</Text>
        <Text style={styles.muted} selectable>{apiUrl}</Text>
        {state.status === "loading" && <Text style={styles.muted}>正在测试连接…</Text>}
        {state.status === "connected" && <Text style={styles.muted}>已连接 TeslaMate Mobile 服务端</Text>}
        {state.status === "error" && <Text style={styles.error}>{state.message}</Text>}
        <Pressable accessibilityRole="button" disabled={state.status === "loading"} onPress={retry} style={styles.action}>
          <Text style={styles.sectionTitle}>测试连接</Text>
        </Pressable>
      </View>
      <ExternalPageGroup title="在 TeslaMate 管理" pages={managementPages} source="TeslaMate" />
    </CatalogScreen>
  );
}
