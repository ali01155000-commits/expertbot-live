"use client";

/**
 * Invisible lifecycle component.
 *
 * The singleton socket.io client is created lazily by `ensureExpertSocket()`
 * (called from the LoginScreen on mount, and re-called here on dashboard
 * mount). All socket listeners are attached exactly once via an idempotent
 * flag inside `attachExpertListeners`, so re-mounting is safe.
 *
 * Responsibilities of this component:
 *  - guarantee the socket exists while the dashboard is mounted
 *  - re-emit the selected-asset subscription if we are already connected
 *  - perform no UI work (returns null)
 *
 * Disconnect is handled by the "قطع الاتصال" action in DashboardHeader
 * via `expert:disconnect` emit; the socket.io transport itself persists
 * across the login <-> dashboard transition.
 */

import { useEffect } from "react";

import {
  ensureExpertSocket,
  useExpertStore,
} from "@/lib/expert-store";

export default function ExpertSocket() {
  useEffect(() => {
    // Make sure the singleton socket exists (idempotent).
    const socket = ensureExpertSocket();

    // If we are already connected to Expert Option, ask the service to
    // re-stream the currently-selected asset (helps after a hot reload or
    // route change). Safe no-op otherwise.
    const state = useExpertStore.getState();
    if (state.connected) {
      socket.emit("expert:set-asset", { assetId: state.selectedAssetId });
    }

    // No cleanup: socket + listeners are intentionally persistent.
  }, []);

  return null;
}
