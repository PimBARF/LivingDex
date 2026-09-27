/**
 * LivingDex - Base Sync Provider Interface
 * Abstract base class defining the contract for all cloud/local storage sync providers.
 */

export class BaseSyncProvider {
  /**
   * @param {string} id Unique identifier for the provider (e.g., 'gdrive', 'firebase', 'file')
   * @param {string} name Human-readable name
   */
  constructor(id, name) {
    if (new.target === BaseSyncProvider) {
      throw new TypeError("Cannot construct BaseSyncProvider instances directly");
    }
    this.id = id;
    this.name = name;
  }

  /**
   * Initialize provider (check saved credentials, initialize third-party SDKs)
   * @returns {Promise<boolean>} True if ready/authenticated
   */
  async init() {
    return false;
  }

  /**
   * Authenticate / Connect to the service
   * @returns {Promise<boolean>} True if authentication succeeded
   */
  async connect() {
    throw new Error("connect() must be implemented");
  }

  /**
   * Disconnect / Clear local credentials
   * @returns {Promise<void>}
   */
  async disconnect() {
    throw new Error("disconnect() must be implemented");
  }

  /**
   * Check if currently connected/authenticated
   * @returns {boolean}
   */
  isConnected() {
    return false;
  }

  /**
   * Save / export the full backup payload to the remote destination
   * @param {object} _payload Canonical Schema v3 export payload
   * @returns {Promise<{ success: boolean, timestamp?: string, error?: string }>}
   */
  async saveBackup(_payload) {
    throw new Error("saveBackup() must be implemented");
  }

  /**
   * Fetch / load the backup payload from the remote destination
   * @returns {Promise<{ success: boolean, payload?: object, timestamp?: string, error?: string }>}
   */
  async loadBackup() {
    throw new Error("loadBackup() must be implemented");
  }

  /**
   * Optional: subscribe to remote changes for live-sync providers
   * @param {Function} _callback Called with updated data when remote changes occur
   * @returns {Function} Unsubscribe function
   */
  subscribeToRemoteChanges(_callback) {
    return () => {};
  }
}
