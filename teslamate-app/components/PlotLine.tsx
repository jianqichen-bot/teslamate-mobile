import { StyleSheet, View } from "react-native";

export type PlotPoint = { x: number; y: number };

export function PlotLine({ from, to, color, thickness }: {
  from: PlotPoint;
  to: PlotPoint;
  color: string;
  thickness: number;
}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  const width = length + thickness;

  return <View style={[styles.line, {
    width,
    height: thickness,
    left: (from.x + to.x - width) / 2,
    top: (from.y + to.y - thickness) / 2,
    borderRadius: thickness / 2,
    backgroundColor: color,
    transform: [{ rotate: `${Math.atan2(dy, dx) * 180 / Math.PI}deg` }],
  }]} />;
}

const styles = StyleSheet.create({ line: { position: "absolute" } });
