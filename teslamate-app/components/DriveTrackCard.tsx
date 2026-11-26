import { useCallback, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useApiRequest } from "../hooks/useApiRequest";
import { fetchDriveTrack } from "../services/api";
import { driveMapUrl } from "../services/teslamateLinks";
import type { DriveDetail, TrackPoint } from "../types/drive";
import { PlotLine, type PlotPoint } from "./PlotLine";

const plotHeight = 210;
const plotPadding = 20;
const degreesToRadians = Math.PI / 180;

function fitTrack(points: TrackPoint[], width: number): PlotPoint[] {
  let previousLongitude = points[0].longitude;
  const coordinates = points.map(({ latitude, longitude }) => {
    // Keep a trip crossing the international date line continuous.
    const x = longitude + 360 * Math.round((previousLongitude - longitude) / 360);
    previousLongitude = x;
    const clampedLatitude = Math.max(-85.051129, Math.min(85.051129, latitude));
    const y = Math.log(Math.tan(Math.PI / 4 + clampedLatitude * degreesToRadians / 2)) / degreesToRadians;
    return { x, y };
  });

  const minX = Math.min(...coordinates.map((point) => point.x));
  const maxX = Math.max(...coordinates.map((point) => point.x));
  const minY = Math.min(...coordinates.map((point) => point.y));
  const maxY = Math.max(...coordinates.map((point) => point.y));
  const scale = Math.min((width - 2 * plotPadding) / (maxX - minX), (plotHeight - 2 * plotPadding) / (maxY - minY));
  const zoom = Number.isFinite(scale) ? scale : 1;

  return coordinates.map(({ x, y }) => ({
    x: width / 2 + (x - (minX + maxX) / 2) * zoom,
    y: plotHeight / 2 - (y - (minY + maxY) / 2) * zoom,
  }));
}

export function DriveTrackCard({ carId, drive }: { carId: string; drive: DriveDetail }) {
  const driveId = String(drive.id);
  const load = useCallback((signal: AbortSignal) => fetchDriveTrack(carId, driveId, signal), [carId, driveId]);
  const { state, refresh } = useApiRequest(load, "无法读取行程轨迹");
  const [linkError, setLinkError] = useState(false);
  const mapUrl = driveMapUrl(carId, driveId, drive.startedAt, drive.endedAt);
  const track = state.status === "ready" ? state.data : null;

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>轨迹预览</Text>
      {state.status === "loading" && <Text style={styles.muted} accessibilityLiveRegion="polite">正在读取轨迹…</Text>}
      {state.status === "error" && (
        <View accessibilityLiveRegion="polite">
          <Text style={styles.error}>{state.message}</Text>
          <Pressable accessibilityRole="button" onPress={refresh} style={styles.action}>
            <Text style={styles.linkLabel}>重试轨迹</Text>
          </Pressable>
        </View>
      )}
      {track && track.points.length < 2 && <Text style={styles.muted}>定位记录不足，无法绘制轨迹。</Text>}
      {track && track.points.length >= 2 && (
        <>
          <TrackPlot points={track.points} />
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.startMarker]} />
              <Text style={styles.muted}>出发</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.endMarker]} />
              <Text style={styles.muted}>到达</Text>
            </View>
          </View>
          {track.recordedPointCount > track.points.length && (
            <Text style={styles.muted}>长行程按顺序抽取定位点绘制。</Text>
          )}
        </>
      )}
      {mapUrl && (
        <Pressable accessibilityRole="link" style={styles.action} onPress={() => {
          setLinkError(false);
          void Linking.openURL(mapUrl).catch(() => setLinkError(true));
        }}>
          <Text style={styles.linkLabel}>在 Grafana 查看地图 ↗</Text>
        </Pressable>
      )}
      {linkError && <Text style={styles.error} accessibilityLiveRegion="polite">无法打开 Grafana 地图。</Text>}
    </View>
  );
}

function TrackPlot({ points }: { points: TrackPoint[] }) {
  const [width, setWidth] = useState(0);
  const coordinates = width > plotPadding * 2 ? fitTrack(points, width) : [];
  const start = coordinates[0];
  const end = coordinates[coordinates.length - 1];

  return (
    <View accessible accessibilityRole="image" accessibilityLabel="行程轨迹预览，标注出发点和到达点"
      style={styles.plot} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View style={styles.horizontalGuide} />
      <View style={styles.verticalGuide} />
      {coordinates.slice(1).map((point, index) => (
        <PlotLine key={index} from={coordinates[index]} to={point} color="#8C9DFF" thickness={2.5} />
      ))}
      {start && <View style={[styles.marker, styles.startMarker, { left: start.x - 5, top: start.y - 5 }]} />}
      {end && <View style={[styles.marker, styles.endMarker, styles.arrival, { left: end.x - 3, top: end.y - 3 }]} />}
      <Text aria-hidden style={styles.north}>↑ 北</Text>
    </View>
  );
}

export function LocationPlot({ points }: { points: TrackPoint[] }) {
  const [width, setWidth] = useState(0);
  const valid = points.filter(({ latitude, longitude }) => Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180);
  if (!valid.length) return <Text style={styles.muted}>此页没有可绘制的地点坐标。</Text>;
  const coordinates = width > plotPadding * 2 ? fitTrack(valid, width) : [];

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`到访地点分布，此页 ${valid.length} 个坐标`}
      style={styles.plot} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View style={styles.horizontalGuide} />
      <View style={styles.verticalGuide} />
      {coordinates.map((point, index) => <View key={index} style={[styles.marker, styles.startMarker,
        { left: point.x - 5, top: point.y - 5 }]} />)}
      <Text aria-hidden style={styles.north}>↑ 北</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#17191D", borderColor: "#25282E", borderWidth: 1, borderRadius: 18, padding: 16, gap: 8 },
  title: { color: "#F5F6F7", fontSize: 17, fontWeight: "700" },
  muted: { color: "#A7ABB3", fontSize: 13, lineHeight: 20 },
  error: { color: "#FF777C", fontSize: 14 },
  plot: { position: "relative", height: plotHeight, backgroundColor: "#10141F", borderRadius: 12, overflow: "hidden" },
  horizontalGuide: { position: "absolute", top: "50%", left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: "#263147" },
  verticalGuide: { position: "absolute", left: "50%", top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: "#263147" },
  north: { position: "absolute", top: 8, right: 10, color: "#A7ABB3", fontSize: 12 },
  marker: { position: "absolute", width: 10, height: 10, borderRadius: 5 },
  arrival: { width: 6, height: 6, borderRadius: 3 },
  startMarker: { backgroundColor: "#4FDEA1" },
  endMarker: { backgroundColor: "#FF676E" },
  legend: { flexDirection: "row", gap: 18 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  action: { alignSelf: "flex-start", justifyContent: "center", minHeight: 44 },
  linkLabel: { color: "#DCE1FF", fontSize: 14, fontWeight: "600" },
});
