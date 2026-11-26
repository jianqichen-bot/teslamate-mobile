import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { formatAmount } from "../services/formatAmount";
import type { ChargePowerPoint } from "../types/charge";
import { PlotLine } from "./PlotLine";

const plotHeight = 132;
const padding = 4;
const lineColor = "#4FDEA1";

export function ChargePowerChart({ points, peakPowerKw, sampled }: {
  points: ChargePowerPoint[];
  peakPowerKw: number | null;
  sampled: boolean;
}) {
  const [width, setWidth] = useState(0);
  const first = points[0];
  const last = points[points.length - 1];
  const start = first ? Date.parse(first.recordedAt) : 0;
  const span = last ? Date.parse(last.recordedAt) - start : 0;
  const maxPower = Math.max(peakPowerKw ?? 0, ...points.map((point) => point.powerKw), 1);
  const step = 10 ** Math.floor(Math.log10(maxPower));
  const scale = Math.ceil(maxPower / step) * step;
  const peak = formatAmount(peakPowerKw, " kW");

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>充电功率</Text>
        {peakPowerKw !== null && <Text style={styles.peak}>最高 {peak}</Text>}
      </View>
      {span > 0 ? (
        <>
          <View accessible accessibilityRole="image" accessibilityLabel={`充电功率随时间变化，最高 ${peak}`} style={styles.chart}>
            <View style={styles.axis}>
              {[scale, scale / 2, 0].map((value) => (
                <Text key={value} style={styles.axisText}>{formatAmount(value, "")}</Text>
              ))}
            </View>
            <View style={styles.plot} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
              {[padding, plotHeight / 2, plotHeight - padding].map((y) => (
                <View key={y} style={[styles.gridLine, { top: y }]} />
              ))}
              {width > padding * 2 && points.map((point, index) => {
                if (index === 0) return null;
                const previous = points[index - 1];
                const x1 = padding + (Date.parse(previous.recordedAt) - start) / span * (width - padding * 2);
                const x2 = padding + (Date.parse(point.recordedAt) - start) / span * (width - padding * 2);
                const y1 = plotHeight - padding - previous.powerKw / scale * (plotHeight - padding * 2);
                const y2 = plotHeight - padding - point.powerKw / scale * (plotHeight - padding * 2);
                return (
                  <PlotLine key={index} from={{ x: x1, y: y1 }} to={{ x: x2, y: y2 }} color={lineColor} thickness={2} />
                );
              })}
            </View>
          </View>
          <View style={styles.times}>
            <Text style={styles.axisText}>{new Date(first.recordedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</Text>
            <Text style={styles.axisText}>{new Date(last.recordedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</Text>
          </View>
          {sampled && <Text style={styles.muted}>曲线按分组平均功率绘制，最高值取原始采样。</Text>}
        </>
      ) : (
        <Text style={styles.muted}>{points.length === 0 ? "没有记录功率数据。" : "采样时间不足以绘制曲线。"}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#17191D", borderColor: "#25282E", borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 },
  heading: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 6 },
  title: { color: "#F5F6F7", fontSize: 17, fontWeight: "700" },
  peak: { color: lineColor, fontSize: 14, fontWeight: "600" },
  chart: { flexDirection: "row", gap: 8 },
  axis: { minWidth: 28, justifyContent: "space-between", alignItems: "flex-end" },
  axisText: { color: "#A7ABB3", fontSize: 11 },
  plot: { height: plotHeight, flex: 1, position: "relative" },
  gridLine: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "#343740" },
  times: { flexDirection: "row", justifyContent: "space-between", marginLeft: 36, marginTop: -4 },
  muted: { color: "#A7ABB3", fontSize: 13, lineHeight: 20 },
});
