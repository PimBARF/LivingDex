/**
 * LivingDex - Google Drive Cloud Sync Provider
 * Uses Google Identity Services (GIS) token client to authenticate and save/load
 * backups to the isolated Google Drive AppData folder (`drive.appdata`).
 */

import { BaseSyncProvider } from "./base-provider.js";
import { buildExportPayload, normalizeImportPayload } from "../schema.js";
import { DEFAULT_GOOGLE_CLIENT_ID } from "../../../config.js";

const GIS_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const DRIVE_APPDATA_SCOPE =
  "https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email";
const BACKUP_FILENAME = "livingdex-cloud-backup.json";
const AUTH_STORAGE_KEY = "livingdex_gdrive_auth";

export class GoogleDriveProvider extends BaseSyncProvider {
  constructor() {
    super("gdrive", "Google Drive");
    this.tokenClient = null;
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.clientId = DEFAULT_GOOGLE_CLIENT_ID;
    this.userInfo = null;
    this.lastBackupMeta = null;

    // Immediately restore persisted authentication state from localStorage
    this.restoreSavedSession();
  }

  /**
   * Restore token and user info session from localStorage
   * @returns {boolean}
   */
  restoreSavedSession() {
    try {
      const savedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
      if (savedAuth) {
        const parsed = JSON.parse(savedAuth);
        if (parsed.userInfo) {
          this.userInfo = parsed.userInfo;
        }
        if (parsed.accessToken) {
          this.accessToken = parsed.accessToken;
          this.tokenExpiresAt = Number(parsed.tokenExpiresAt) || 0;
        }
        if (parsed.lastBackupMeta) {
          this.lastBackupMeta = parsed.lastBackupMeta;
        }
        return Boolean(this.userInfo || this.accessToken);
      }
    } catch {
      // Ignore parse errors
    }
    return false;
  }

  /**
   * Persist current authentication state and metadata to localStorage
   */
  persistSession() {
    try {
      if (this.userInfo || this.accessToken || this.lastBackupMeta) {
        localStorage.setItem(
          AUTH_STORAGE_KEY,
          JSON.stringify({
            accessToken: this.accessToken,
            tokenExpiresAt: this.tokenExpiresAt,
            userInfo: this.userInfo,
            lastBackupMeta: this.lastBackupMeta,
          }),
        );
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch {
      // Ignore storage quota errors
    }
  }

  /**
   * Get configured Google Client ID
   * @returns {string}
   */
  getClientId() {
    return this.clientId;
  }

  /**
   * Get current authenticated user profile
   * @returns {object|null}
   */
  getUser() {
    if (!this.userInfo) {
      this.restoreSavedSession();
    }
    return this.userInfo;
  }

  /**
   * Load Google Identity Services SDK script dynamically
   * @returns {Promise<void>}
   */
  async loadGisScript() {
    if (window.google?.accounts?.oauth2) {
      return;
    }

    return new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${GIS_SCRIPT_URL}"]`);
      if (existingScript) {
        existingScript.addEventListener("load", () => resolve());
        existingScript.addEventListener("error", () =>
          reject(new Error("Failed to load Google Identity script")),
        );
        return;
      }

      const script = document.createElement("script");
      script.src = GIS_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Google Identity Services SDK"));
      document.head.appendChild(script);
    });
  }

  /**
   * Initialize provider and verify saved session
   */
  async init() {
    this.clientId = DEFAULT_GOOGLE_CLIENT_ID;
    this.restoreSavedSession();
    return this.isConnected();
  }

  /**
   * Check if an active, unexpired access token is available.
   * @returns {boolean}
   */
  hasValidToken() {
    return Boolean(this.accessToken && this.tokenExpiresAt > Date.now() + 60000);
  }

  /**
   * Check if user is connected
   * @returns {boolean}
   */
  isConnected() {
    if (!this.userInfo && !this.accessToken) {
      this.restoreSavedSession();
    }
    // Considered connected if user info is persisted or a valid unexpired token exists
    return Boolean(this.userInfo || this.hasValidToken());
  }

  /**
   * Alias for isConnected
   */
  async isAuthenticated() {
    return this.isConnected();
  }

  /**
   * Ensures an active, unexpired access token is available.
   * Only prompts user if interactive is explicitly true (e.g. during user-initiated backup/restore).
   * Passive / non-interactive calls will NOT open auth popups.
   * @param {object} [opts]
   * @param {boolean} [opts.interactive=false]
   * @returns {Promise<string>}
   */
  async ensureValidToken({ interactive = false } = {}) {
    this.restoreSavedSession();
    if (this.hasValidToken()) {
      return this.accessToken;
    }

    if (!interactive) {
      throw new Error("Google Drive access token expired or not available.");
    }

    // Token is expired or missing, request token renewal only during interactive user actions
    await this.connect({ prompt: "" });
    return this.accessToken;
  }

  /**
   * Connect and authorize using Google Identity Services popup
   * @param {object} [opts]
   * @param {string} [opts.prompt='consent']
   * @returns {Promise<boolean>}
   */
  async connect({ prompt = "consent" } = {}) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error(
        "You are offline. Google Drive connection requires an active internet connection.",
      );
    }
    if (!this.clientId) {
      throw new Error("Google Client ID is not configured.");
    }

    await this.loadGisScript();

    return new Promise((resolve, reject) => {
      try {
        this.tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: this.clientId,
          scope: DRIVE_APPDATA_SCOPE,
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
              reject(new Error(tokenResponse.error_description || tokenResponse.error));
              return;
            }

            this.accessToken = tokenResponse.access_token;
            const expiresInMs = (parseInt(tokenResponse.expires_in, 10) || 3600) * 1000;
            this.tokenExpiresAt = Date.now() + expiresInMs;

            try {
              const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                headers: { Authorization: `Bearer ${this.accessToken}` },
              });
              if (infoRes.ok) {
                this.userInfo = await infoRes.json();
              }
            } catch {
              // Keep existing user info if available
            }

            this.persistSession();
            resolve(true);
          },
        });

        this.tokenClient.requestAccessToken({ prompt });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Alias for connect
   */
  async authenticate(opts = {}) {
    return this.connect(opts);
  }

  /**
   * Disconnect and clear session
   */
  async disconnect() {
    if (this.accessToken && window.google?.accounts?.oauth2?.revoke) {
      try {
        window.google.accounts.oauth2.revoke(this.accessToken, () => {});
      } catch {
        // Ignore revoke errors
      }
    }
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.userInfo = null;
    this.lastBackupMeta = null;
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  /**
   * Alias for disconnect
   */
  async signOut() {
    return this.disconnect();
  }

  /**
   * Find existing backup file in appDataFolder
   * @param {object} [opts]
   * @param {boolean} [opts.interactive=false]
   * @returns {Promise<{ id: string, modifiedTime: string }|null>}
   */
  async findBackupFile({ interactive = false } = {}) {
    await this.ensureValidToken({ interactive });

    const query = encodeURIComponent(
      `name = '${BACKUP_FILENAME}' and 'appDataFolder' in parents and trashed = false`,
    );
    const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime)`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (!res.ok) {
      if (res.status === 401) {
        this.accessToken = null;
        this.tokenExpiresAt = 0;
        this.persistSession();
        throw new Error("Google Drive authorization expired. Please reconnect.");
      }
      throw new Error(`Drive search failed: ${res.statusText}`);
    }

    const data = await res.json();
    if (data.files && data.files.length > 0) {
      this.lastBackupMeta = {
        id: data.files[0].id,
        modifiedAt: data.files[0].modifiedTime,
      };
      this.persistSession();
      return data.files[0];
    }
    return null;
  }

  /**
   * Get metadata for the cloud backup file.
   * Passive check: returns cached metadata if token is expired, or fetches fresh if valid token exists.
   * Never triggers auth popup.
   * @returns {Promise<{ modifiedAt?: string }|null>}
   */
  async getMetadata() {
    if (!this.isConnected()) return null;
    if (this.hasValidToken()) {
      try {
        const file = await this.findBackupFile({ interactive: false });
        return file ? { modifiedAt: file.modifiedTime } : null;
      } catch {
        // Fall back to cached metadata
      }
    }
    return this.lastBackupMeta ? { modifiedAt: this.lastBackupMeta.modifiedAt } : null;
  }

  /**
   * Save / upload backup to Google Drive AppData folder
   * @param {object} [customPayload]
   * @returns {Promise<{ success: boolean, timestamp?: string, error?: string }>}
   */
  async saveBackup(customPayload = null) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return {
        success: false,
        error: "You are offline. Cloud backup requires an active internet connection.",
      };
    }
    try {
      await this.ensureValidToken({ interactive: true });
      const payload = customPayload || buildExportPayload();
      const fileContent = JSON.stringify(payload, null, 2);
      const existingFile = await this.findBackupFile({ interactive: false });

      let uploadUrl;
      let method;

      if (existingFile && existingFile.id) {
        uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`;
        method = "PATCH";
      } else {
        uploadUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
        method = "POST";
      }

      let res;
      if (existingFile && existingFile.id) {
        res = await fetch(uploadUrl, {
          method,
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: fileContent,
        });
      } else {
        const metadata = {
          name: BACKUP_FILENAME,
          parents: ["appDataFolder"],
        };
        const boundary = "-------314159265358979323846";
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelim = `\r\n--${boundary}--`;

        const multipartBody =
          delimiter +
          "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
          JSON.stringify(metadata) +
          delimiter +
          "Content-Type: application/json\r\n\r\n" +
          fileContent +
          closeDelim;

        res = await fetch(uploadUrl, {
          method,
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body: multipartBody,
        });
      }

      if (!res.ok) {
        if (res.status === 401) {
          this.accessToken = null;
          this.tokenExpiresAt = 0;
          this.persistSession();
          return { success: false, error: "Google Drive authorization expired. Please reconnect." };
        }
        return { success: false, error: `Drive upload failed: ${res.statusText}` };
      }

      const uploadedData = await res.json().catch(() => ({}));
      this.lastBackupMeta = {
        id: uploadedData.id || existingFile?.id || "",
        modifiedAt: uploadedData.modifiedTime || new Date().toISOString(),
      };
      this.persistSession();

      return {
        success: true,
        timestamp: payload.timestamp || new Date().toISOString(),
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Load / download backup from Google Drive AppData folder
   * @returns {Promise<{ success: boolean, payload?: object, timestamp?: string, error?: string }>}
   */
  async loadBackup() {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error("You are offline. Cloud restore requires an active internet connection.");
    }
    try {
      await this.ensureValidToken({ interactive: true });
      const file = await this.findBackupFile({ interactive: false });
      if (!file || !file.id) {
        return null;
      }

      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
      const res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });

      if (!res.ok) {
        if (res.status === 401) {
          this.accessToken = null;
          this.tokenExpiresAt = 0;
          this.persistSession();
          throw new Error("Google Drive authorization expired. Please reconnect.");
        }
        throw new Error(`Drive download failed: ${res.statusText}`);
      }

      const rawData = await res.json();
      const normalized = normalizeImportPayload(rawData);

      if (!normalized.valid) {
        throw new Error(normalized.error || "Invalid cloud backup format");
      }

      return normalized.data;
    } catch (err) {
      throw err;
    }
  }
}
