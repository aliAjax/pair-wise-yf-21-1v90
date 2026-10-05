import { useSyncExternalStore } from "react";
import type { State } from "./types.ts";
import { WorkshopStore } from "./store.ts";
import { buildSeed } from "./seed.ts";

/** 单例台账：演示环境下整个前端共享一份 */
export const store = new WorkshopStore(buildSeed());

export function useWorkshop(): State {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
