/**
 * LivingDex - Local File Sync Provider
 * Exports backup as a JSON file download and imports from user file selection.
 */

import { BaseSyncProvider } from "./base-provider.js";
import { buildExportPayload, normalizeImportPayload } from "../schema.js";

export class FileSyncProvider extends BaseSyncProvider {
  constructor() {
    super("file", "Local File Backup");
  }

  async init() {
    return true;
  }

  async connect() {
    return true;
  }

  async disconnect() {
    // No-op for file provider
  }

  isConnected() {
    return true;
  }

  /**
   * Triggers a browser download of the backup JSON file.
   * @param {object} [customPayload] Optional pre-built payload; defaults to buildExportPayload()
   */
  async saveBackup(customPayload = null) {
    try {
      const payload = customPayload || buildExportPayload();
      const jsonString = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonString], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const dateStr = new Date().toISOString().split("T")[0];
      const link = document.createElement("a");
      link.href = url;
      link.download = `livingdex-backup-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return {
        success: true,
        timestamp: payload.timestamp || new Date().toISOString(),
      };
    } catch (err) {
      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Prompts user to pick a JSON file and parses it.
   * @returns {Promise<{ success: boolean, payload?: object, timestamp?: string, error?: string }>}
   */
  async loadBackup() {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";

      input.onchange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
          resolve({ success: false, error: "No file selected" });
          return;
        }

        try {
          const text = await file.text();
          const rawData = JSON.parse(text);
          const normalized = normalizeImportPayload(rawData);

          if (!normalized.valid) {
            resolve({ success: false, error: normalized.error || "Invalid backup file structure" });
            return;
          }

          resolve({
            success: true,
            payload: normalized.data,
            schemaVersion: normalized.schemaVersion,
            timestamp: rawData.timestamp || new Date(file.lastModified).toISOString(),
          });
        } catch (err) {
          resolve({ success: false, error: `Failed to read file: ${err.message}` });
        }
      };

      input.oncancel = () => {
        resolve({ success: false, error: "File selection cancelled" });
      };

      input.click();
    });
  }
}
