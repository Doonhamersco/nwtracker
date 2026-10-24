"use client";

import { useCallback, useSyncExternalStore } from "react";
import { checkinDueLabel, type Timeframe } from "@/lib/dashboard-kpis";

const TIMEFRAME_KEY = "nwtracker.dashboard.timeframe";
const HIDE_DEBT_KEY = "nwtracker.dashboard.hideDebt";
const PREFS_EVENT = "nwtracker-dashboard-prefs";

const TIMEFRAMES = new Set<Timeframe>(["1M", "3M", "6M", "1Y", "ALL"]);

interface DashboardPrefs {
  timeframe: Timeframe;
  hideDebt: boolean;
}

const SERVER_PREFS: DashboardPrefs = { timeframe: "1Y", hideDebt: false };

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
    const raw = `${localStorage.getItem(TIMEFRAME_KEY)}|${localStorage.getItem(HIDE_DEBT_KEY)}`;
    if (raw === cachedRaw) return cachedPrefs;
    const timeframe = readTimeframe(localStorage.getItem(TIMEFRAME_KEY)) ?? "1Y";
    cachedPrefs = {
      timeframe,
      hideDebt: localStorage.getItem(HIDE_DEBT_KEY) === "1",
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

  return {
    timeframe: prefs.timeframe,
    setTimeframe,
    hideDebt: prefs.hideDebt,
    setHideDebt,
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
