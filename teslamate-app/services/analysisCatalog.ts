import type { ReportKind } from "../types/analysis";
import { dashboardGroups } from "./teslamateLinks";

export type SummaryMode = "home" | "overview" | "summary" | "driving" | "charging";
export type ReportMode = ReportKind | "drive-detail" | "charge-detail" | "tax" | "visited"
  | "charge-level" | "projected-range" | "battery-health" | SummaryMode;

const modes: Record<string, ReportMode> = {
  be2m9kga7b8qoc: "home", kOuP_Fggz: "overview", xo4BNRkZz: "states",
  SUBgwtigz: "timeline", IiC07mgWz: "updates",
  Y8upc6ZRk: "drives", zm7wN6Zgz: "drive-detail", _7WkNSyWk: "driving", FkUpJpQZk: "journeys",
  "ZzhF-aRWz": "places", RG_DxSmgk: "visited", lBIoQIggk: "tax",
  TSmNYvRRk: "charges", BHhxFeZRz: "charge-detail", "-pkIkhmRz": "charging", WopVO_mgz: "charge-level",
  "1EZnXszMk": "summary", NjtMTFggz: "mileage", fu4SiQgWz: "efficiency",
  riqUfXgRz: "projected-range", jchmRiqUfXgTM: "battery-health", zhHx2Fggk: "drain", jchmDbInfo: "database",
};

export const analysisGroups = dashboardGroups.map((group) => ({
  ...group, pages: group.pages.map((page) => ({ ...page, mode: modes[page.uid] })),
}));

export function findAnalysisPage(uid: string) {
  return analysisGroups.flatMap((group) => group.pages).find((page) => page.uid === uid);
}

export function summaryMode(mode: ReportMode): mode is SummaryMode {
  return ["home", "overview", "summary", "driving", "charging"].includes(mode);
}

export function reportKind(mode: Exclude<ReportMode, SummaryMode>): ReportKind {
  switch (mode) {
    case "drive-detail":
    case "tax": return "drives";
    case "charge-detail": return "charges";
    case "visited": return "places";
    case "charge-level":
    case "projected-range":
    case "battery-health": return "battery";
    default: return mode;
  }
}
