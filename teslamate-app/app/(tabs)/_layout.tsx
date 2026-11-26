import { Tabs } from "expo-router";
import { StyleSheet, Text, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CarSelectionProvider } from "../../hooks/useCarSelection";

const tabs = [
  { name: "index", title: "车辆", icon: "⌂" },
  { name: "drives", title: "行程", icon: "☷" },
  { name: "charging", title: "充电", icon: "ϟ" },
  { name: "analytics", title: "分析", icon: "▥" },
  { name: "more", title: "更多", icon: "⋯" },
];

export default function TabLayout() {
  const { bottom } = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const bottomPadding = Math.max(bottom, 8);
  const labelLineHeight = 18;
  const extraLabelHeight = Math.ceil(labelLineHeight * Math.max(0, fontScale - 1));

  return (
    <CarSelectionProvider>
      <Tabs screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#FF676E",
        tabBarInactiveTintColor: "#A7ABB3",
        tabBarLabelPosition: "below-icon",
        tabBarLabelStyle: [styles.label, { lineHeight: labelLineHeight }],
        tabBarStyle: [styles.bar, { height: 58 + extraLabelHeight + bottomPadding, paddingBottom: bottomPadding }],
        sceneStyle: { backgroundColor: "#0A0B0D" },
      }}>
        {tabs.map(({ name, title, icon }) => (
          <Tabs.Screen key={name} name={name} options={{
            title,
            tabBarIcon: ({ color }) => <Text aria-hidden allowFontScaling={false} style={[styles.icon, { color }]}>{icon}</Text>,
          }} />
        ))}
      </Tabs>
    </CarSelectionProvider>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: "#17191D", borderTopColor: "#25282E" },
  label: { fontSize: 12, fontWeight: "600" },
  icon: { fontSize: 22, lineHeight: 24 },
});
