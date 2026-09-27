/**
 * LivingDex - Firebase / Live-Sync Stub Provider
 * Architectural placeholder prepared for future full user accounts and real-time synchronization.
 */

import { BaseSyncProvider } from "./base-provider.js";

export class FirebaseStubProvider extends BaseSyncProvider {
  constructor() {
    super("firebase", "LivingDex Cloud Account");
    this.user = null;
  }

  async init() {
    return false;
  }

  async connect() {
    throw new Error(
      "LivingDex Cloud Accounts with live synchronization will be available in a future update.",
    );
  }

  async disconnect() {
    this.user = null;
  }

  isConnected() {
    return Boolean(this.user);
  }

  async saveBackup(_payload) {
    return {
      success: false,
      error: "Firebase sync provider is not yet active.",
    };
  }

  async loadBackup() {
    return {
      success: false,
      error: "Firebase sync provider is not yet active.",
    };
  }

  subscribeToRemoteChanges(_callback) {
    return () => {};
  }
}
