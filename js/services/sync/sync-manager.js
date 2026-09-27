/**
 * LivingDex - Sync Manager
 * Central orchestrator managing sync providers, state persistence, events, and data application.
 */

import { GoogleDriveProvider } from "./providers/google-drive-provider.js";
import { FileSyncProvider } from "./providers/file-provider.js";
import { FirebaseStubProvider } from "./providers/firebase-stub-provider.js";
import { buildExportPayload, normalizeImportPayload } from "./schema.js";
import {
  saveGameCaughtSlots,
  saveGameShinyCaughtSlots,
  saveGameBoxLabels,
  saveGameSegmentSettings,
  saveItemInventory,
  saveSpecimenInventory,
} from "../../storage.js";
import { SYNC_STORAGE_KEY } from "../../config.js";

export class SyncManager extends EventTarget {
  constructor() {
    super();
    this.providers = new Map();
    this.activeProviderId = "gdrive";
    this.autoSyncTimer = null;

    const gdrive = new GoogleDriveProvider();
    const file = new FileSyncProvider();
    const firebase = new FirebaseStubProvider();

    this.registerProvider(gdrive);
    // Also register 'google-drive' alias
    this.providers.set("google-drive", gdrive);
    this.registerProvider(file);
    this.registerProvider(firebase);

    if (typeof window !== "undefined") {
      window.addEventListener("livingdex:storage-mutated", (event) => {
        this.handleStorageMutation(event.detail);
      });
    }
  }

  registerProvider(provider) {
    this.providers.set(provider.id, provider);
  }

  getProvider(id) {
    return this.providers.get(id);
  }

  getActiveProvider() {
    return this.providers.get(this.activeProviderId) || this.providers.get("gdrive");
  }

  setActiveProvider(id) {
    if (this.providers.has(id)) {
      this.activeProviderId = id;
      this.saveState();
      this.emit("provider:changed", { providerId: id });
    }
  }

  async init() {
    try {
      const raw = localStorage.getItem(SYNC_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.activeProviderId && this.providers.has(parsed.activeProviderId)) {
          this.activeProviderId = parsed.activeProviderId;
        }
      }
    } catch {
      // Ignore parse error
    }

    for (const provider of this.providers.values()) {
      try {
        await provider.init();
      } catch (err) {
        console.warn(`Failed to initialize sync provider "${provider.id}":`, err);
      }
    }

    this.emit("initialized", { activeProviderId: this.activeProviderId });
  }

  saveState() {
    try {
      localStorage.setItem(
        SYNC_STORAGE_KEY,
        JSON.stringify({
          activeProviderId: this.activeProviderId,
        }),
      );
    } catch {
      // Ignore quota errors
    }
  }

  async connect(providerId = this.activeProviderId) {
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new Error(`Unknown sync provider "${providerId}"`);
    }

    this.emit("sync:status", { providerId, status: "connecting" });
    try {
      const result = await provider.connect();
      this.emit("sync:status", {
        providerId,
        status: provider.isConnected() ? "connected" : "disconnected",
      });
      return result;
    } catch (err) {
      this.emit("sync:status", { providerId, status: "error", error: err.message });
      throw err;
    }
  }

  async disconnect(providerId = this.activeProviderId) {
    const provider = this.getProvider(providerId);
    if (!provider) return;

    await provider.disconnect();
    this.emit("sync:status", { providerId, status: "disconnected" });
  }

  async saveBackup(providerId = this.activeProviderId, customPayload = null) {
    const provider = this.getProvider(providerId);
    if (!provider) {
      return { success: false, error: `Provider "${providerId}" not found` };
    }

    this.emit("sync:progress", { providerId, action: "upload", state: "start" });
    try {
      const payload = customPayload || buildExportPayload();
      const res = await provider.saveBackup(payload);
      this.emit("sync:progress", {
        providerId,
        action: "upload",
        state: res.success ? "success" : "error",
        timestamp: res.timestamp,
        error: res.error,
      });
      return res;
    } catch (err) {
      this.emit("sync:progress", {
        providerId,
        action: "upload",
        state: "error",
        error: err.message,
      });
      return { success: false, error: err.message };
    }
  }

  /**
   * Alias for saveBackup
   */
  async backup(providerId = this.activeProviderId, customPayload = null) {
    return this.saveBackup(providerId, customPayload);
  }

  async loadBackup(providerId = this.activeProviderId) {
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider "${providerId}" not found`);
    }

    this.emit("sync:progress", { providerId, action: "download", state: "start" });
    try {
      const res = await provider.loadBackup();
      this.emit("sync:progress", {
        providerId,
        action: "download",
        state: "success",
      });
      return res;
    } catch (err) {
      this.emit("sync:progress", {
        providerId,
        action: "download",
        state: "error",
        error: err.message,
      });
      throw err;
    }
  }

  applyBackupPayload(normalizedData, { overwrite = true } = {}) {
    if (!normalizedData || typeof normalizedData !== "object") {
      throw new Error("Invalid normalized backup payload");
    }

    const { games = {}, inventory = {} } = normalizedData;

    for (const [gameId, gData] of Object.entries(games)) {
      if (!gData) continue;

      if (gData.caught && typeof gData.caught === "object") {
        const caughtMap = Array.isArray(gData.caught)
          ? gData.caught.reduce((acc, k) => {
              acc[k] = true;
              return acc;
            }, {})
          : gData.caught;
        saveGameCaughtSlots(gameId, caughtMap);
      }

      if (gData.shiny && typeof gData.shiny === "object") {
        const shinyMap = Array.isArray(gData.shiny)
          ? gData.shiny.reduce((acc, k) => {
              acc[k] = true;
              return acc;
            }, {})
          : gData.shiny;
        saveGameShinyCaughtSlots(gameId, shinyMap);
      }

      if (gData.boxLabels && typeof gData.boxLabels === "object") {
        saveGameBoxLabels(gameId, gData.boxLabels);
      }

      if (gData.segmentSettings && typeof gData.segmentSettings === "object") {
        saveGameSegmentSettings(gameId, gData.segmentSettings);
      }
    }

    if (inventory.items && typeof inventory.items === "object") {
      saveItemInventory(inventory.items);
    }
    if (inventory.specimens && typeof inventory.specimens === "object") {
      saveSpecimenInventory(inventory.specimens);
    }

    this.emit("data:applied", { timestamp: new Date().toISOString() });
  }

  handleStorageMutation(_detail) {
    const provider = this.getActiveProvider();
    if (!provider || !provider.isConnected() || provider.id === "file") {
      return;
    }

    if (this.autoSyncTimer) {
      clearTimeout(this.autoSyncTimer);
    }

    this.autoSyncTimer = setTimeout(async () => {
      this.autoSyncTimer = null;
      try {
        await this.saveBackup(provider.id);
      } catch (err) {
        console.warn("Auto-sync failed:", err);
      }
    }, 5000);
  }

  on(eventName, handler) {
    this.addEventListener(eventName, (e) => handler(e.detail));
  }

  off(eventName, handler) {
    this.removeEventListener(eventName, handler);
  }

  emit(eventName, detail = {}) {
    this.dispatchEvent(new CustomEvent(eventName, { detail }));
  }
}

export const syncManager = new SyncManager();
export { buildExportPayload, normalizeImportPayload };
