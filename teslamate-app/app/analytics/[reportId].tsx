import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnalysisReportBody } from "../../components/AnalysisReportBody";
import { catalogStyles } from "../../components/CatalogScreen";
import { DetailScreenHeader } from "../../components/DetailScreenHeader";
import { findAnalysisPage } from "../../services/analysisCatalog";
import { analysisDashboardUrl } from "../../services/teslamateLinks";
import { isRouteId } from "../../types/drive";
import type { StatisticsPeriod } from "../../types/statistics";

const periods: StatisticsPeriod[] = [7, 30, 90];

export default function AnalyticsReportScreen() {
  const params = useLocalSearchParams<{ reportId: string; carId: string; days?: string }>();
  const report = typeof params.reportId === "string" ? findAnalysisPage(params.reportId) : undefined;
  const initialDays = periods.find((days) => String(days) === params.days) ?? 30;
  return (
    <SafeAreaView style={styles.screen}>
      <DetailScreenHeader title={report?.title ?? "分析报表"} fallback="/analytics" />
      {report && isRouteId(params.carId)
        ? <ReportContent key={`${report.uid}/${params.carId}/${initialDays}`} uid={report.uid} mode={report.mode} carId={params.carId} initialDays={initialDays} />
        : <Text style={[catalogStyles.error, styles.content]}>找不到报表或车辆编号格式不正确。</Text>}
    </SafeAreaView>
  );
}

function ReportContent({ uid, mode, carId, initialDays }: {
  uid: string;
  mode: NonNullable<ReturnType<typeof findAnalysisPage>>["mode"];
  carId: string;
  initialDays: StatisticsPeriod;
}) {
  const [days, setDays] = useState(initialDays);
  const [linkError, setLinkError] = useState(false);
  const originalUid = mode === "drive-detail" ? "Y8upc6ZRk" : mode === "charge-detail" ? "TSmNYvRRk" : uid;
  const original = analysisDashboardUrl(originalUid, carId, days);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.range}>
        {periods.map((period) => (
          <Pressable key={period} accessibilityRole="button" accessibilityState={{ selected: period === days }}
            onPress={() => setDays(period)} style={[styles.choice, period === days && styles.selected]}>
            <Text style={styles.choiceLabel}>近 {period} 天</Text>
          </Pressable>
        ))}
      </View>
      <AnalysisReportBody key={days} mode={mode} carId={carId} days={days} />
      {original && (
        <Pressable accessibilityRole="link" style={[catalogStyles.panel, styles.original]} onPress={() => {
          setLinkError(false);
          void Linking.openURL(original).catch(() => setLinkError(true));
        }}>
          <Text style={catalogStyles.sectionTitle}>打开 Grafana 原版 ↗</Text>
        </Pressable>
      )}
      {linkError && <Text style={catalogStyles.error} accessibilityLiveRegion="polite">无法打开 Grafana 报表。</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0A0B0D" },
  content: { paddingHorizontal: 24, paddingBottom: 24, gap: 14 },
  range: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { minHeight: 44, justifyContent: "center", paddingHorizontal: 13, borderRadius: 10, borderWidth: 1, borderColor: "#343740" },
  selected: { borderColor: "#FF676E", backgroundColor: "#2A181C" },
  choiceLabel: { color: "#F5F6F7", fontSize: 14, fontWeight: "600" },
  original: { minHeight: 52, justifyContent: "center" },
});
