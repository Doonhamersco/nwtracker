"use client";

import { useCallback, useSyncExternalStore } from "react";
import { checkinDueLabel, type Timeframe } from "@/lib/dashboard-kpis";

const TIMEFRAME_KEY = "nwtracker.dashboard.timeframe";
const HIDE_DEBT_KEY = "nwtracker.dashboard.hideDebt";
const HIDE_ASSETS_KEY = "nwtracker.dashboard.hideAssets";
const SHOW_EVENTS_KEY = "nwtracker.dashboard.showEvents";
const PREFS_EVENT = "nwtracker-dashboard-prefs";

const TIMEFRAMES = new Set<Timeframe>(["1M", "3M", "6M", "1Y", "ALL"]);

interface DashboardPrefs {
  timeframe: Timeframe;
  hideDebt: boolean;
  hideAssets: boolean;
  showEvents: boolean;
}

const SERVER_PREFS: DashboardPrefs = {
  timeframe: "1Y",
  hideDebt: false,
  hideAssets: false,
  showEvents: true,
};

/** Missing or any value other than "0" keeps event markers visible. */
export function showChartEvents(stored: string | null | undefined): boolean {
  return stored !== "0";
}

let cachedRaw: string | null = null;
let cachedPrefs: DashboardPrefs = SERVER_PREFS;

function readTimeframe(value: string | null): Timeframe | null {
  if (value && TIMEFRAMES.has(value as Timeframe)) return value as Timeframe;
  return null;
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(PREFS_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(PREFS_EVENT, onStoreChange);
  };
}

function readPrefs(): DashboardPrefs {
  try {
    const raw = `${localStorage.getItem(TIMEFRAME_KEY)}|${localStorage.getItem(HIDE_DEBT_KEY)}|${localStorage.getItem(HIDE_ASSETS_KEY)}|${localStorage.getItem(SHOW_EVENTS_KEY)}`;
    if (raw === cachedRaw) return cachedPrefs;
    const timeframe = readTimeframe(localStorage.getItem(TIMEFRAME_KEY)) ?? "1Y";
    cachedPrefs = {
      timeframe,
      hideDebt: localStorage.getItem(HIDE_DEBT_KEY) === "1",
      hideAssets: localStorage.getItem(HIDE_ASSETS_KEY) === "1",
      showEvents: showChartEvents(localStorage.getItem(SHOW_EVENTS_KEY)),
    };
    cachedRaw = raw;
    return cachedPrefs;
  } catch {
    return SERVER_PREFS;
  }
}

function writePrefs(next: DashboardPrefs) {
  try {
    localStorage.setItem(TIMEFRAME_KEY, next.timeframe);
    localStorage.setItem(HIDE_DEBT_KEY, next.hideDebt ? "1" : "0");
    localStorage.setItem(HIDE_ASSETS_KEY, next.hideAssets ? "1" : "0");
    localStorage.setItem(SHOW_EVENTS_KEY, next.showEvents ? "1" : "0");
  } catch {
    return;
  }
  cachedRaw = null;
  window.dispatchEvent(new Event(PREFS_EVENT));
}

export function useDashboardPrefs() {
  const prefs = useSyncExternalStore(subscribe, readPrefs, () => SERVER_PREFS);

  const setTimeframe = useCallback((timeframe: Timeframe) => {
    writePrefs({ ...readPrefs(), timeframe });
  }, []);

  const setHideDebt = useCallback((value: boolean | ((current: boolean) => boolean)) => {
    const current = readPrefs();
    const hideDebt = typeof value === "function" ? value(current.hideDebt) : value;
    writePrefs({ ...current, hideDebt });
  }, []);

  const setHideAssets = useCallback((value: boolean | ((current: boolean) => boolean)) => {
    const current = readPrefs();
    const hideAssets = typeof value === "function" ? value(current.hideAssets) : value;
    writePrefs({ ...current, hideAssets });
  }, []);

  const setShowEvents = useCallback((value: boolean | ((current: boolean) => boolean)) => {
    const current = readPrefs();
    const showEvents = typeof value === "function" ? value(current.showEvents) : value;
    writePrefs({ ...current, showEvents });
  }, []);

  return {
    timeframe: prefs.timeframe,
    setTimeframe,
    hideDebt: prefs.hideDebt,
    setHideDebt,
    hideAssets: prefs.hideAssets,
    setHideAssets,
    showEvents: prefs.showEvents,
    setShowEvents,
  };
}

function emptySubscribe() {
  return () => {};
}

export function useCheckinDueLabel(lastTakenAt: string | null): string | null {
  const label = checkinDueLabel(lastTakenAt);
  return useSyncExternalStore(
    emptySubscribe,
    () => label,
    () => null
  );
}
