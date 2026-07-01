import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getContacts, getDatabase, clearDatabase } from "./DatabaseService";

// Base directories
const BASE_DIR = `${FileSystem.documentDirectory}Unity/`;
const IMAGES_DIR = `${BASE_DIR}Media/Images/`;
const AVATARS_DIR = `${BASE_DIR}Media/Avatars/`;
const VIDEOS_DIR = `${BASE_DIR}Media/Videos/`;
const USERDATA_DIR = `${BASE_DIR}UserData/`;

const SETTINGS_BACKUP_PATH = `${USERDATA_DIR}settings.json`;

/**
 * Initializes the local folder structures.
 */
export async function initDirectories() {
  if (Platform.OS === "web") {
    console.warn("[StorageService] initDirectories skipped on web.");
    return true;
  }

  try {
    const dirs = [IMAGES_DIR, AVATARS_DIR, VIDEOS_DIR, USERDATA_DIR];
    for (const dir of dirs) {
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        console.log(`[StorageService] Created directory: ${dir}`);
      }
    }
    return true;
  } catch (error) {
    console.error("[StorageService] initDirectories error:", error);
    return false;
  }
}

/**
 * Generates a safe local filename for any remote URL.
 */
function getFilenameFromUrl(url, type) {
  if (!url) return `${Date.now()}_file`;
  // Sanitize the URL to make a unique filename
  const clean = url.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 150);
  const ext = url.includes(".png") ? "png" : "jpg";
  return `${type}_${clean}.${ext}`;
}

/**
 * Silently caches a remote image locally and returns the local file path.
 * Supports background caching.
 */
export async function cacheRemoteImage(remoteUrl, type = "image") {
  if (
    !remoteUrl ||
    typeof remoteUrl !== "string" ||
    !remoteUrl.startsWith("http")
  ) {
    return remoteUrl; // Return input if it's already a local URI or invalid
  }

  if (Platform.OS === "web") {
    console.warn("[StorageService] cacheRemoteImage fallback on web.");
    return remoteUrl;
  }

  try {
    await initDirectories();
    const filename = getFilenameFromUrl(remoteUrl, type);
    const targetDir = type === "avatar" ? AVATARS_DIR : IMAGES_DIR;
    const targetPath = `${targetDir}${filename}`;

    const fileInfo = await FileSystem.getInfoAsync(targetPath);
    if (fileInfo.exists) {
      return targetPath; // Cache hit
    }

    console.log(
      `[StorageService] Caching remote file: ${remoteUrl} -> ${targetPath}`,
    );
    const downloadResult = await FileSystem.downloadAsync(
      remoteUrl,
      targetPath,
    );
    return downloadResult.uri;
  } catch (error) {
    console.warn(`[StorageService] Caching failed for ${remoteUrl}:`, error);
    return remoteUrl; // Fallback to remote URL on failure
  }
}

/**
 * Backs up the user settings locally in settings.json.
 */
export async function backupSettingsLocally(settings) {
  if (Platform.OS === "web") {
    console.warn("[StorageService] backupSettingsLocally skipped on web.");
    return false;
  }

  try {
    await initDirectories();
    const content = JSON.stringify(settings, null, 2);
    await FileSystem.writeAsStringAsync(SETTINGS_BACKUP_PATH, content);
    console.log("[StorageService] Settings backed up locally.");
    return true;
  } catch (error) {
    console.error("[StorageService] backupSettingsLocally error:", error);
    return false;
  }
}

/**
 * Restores user settings from settings.json if it exists.
 */
export async function restoreSettingsLocally() {
  if (Platform.OS === "web") {
    console.warn("[StorageService] restoreSettingsLocally skipped on web.");
    return null;
  }

  try {
    const fileInfo = await FileSystem.getInfoAsync(SETTINGS_BACKUP_PATH);
    if (!fileInfo.exists) return null;

    const content = await FileSystem.readAsStringAsync(SETTINGS_BACKUP_PATH);
    return JSON.parse(content);
  } catch (error) {
    console.error("[StorageService] restoreSettingsLocally error:", error);
    return null;
  }
}

/**
 * Performs a smart, contact-aware 30-day storage cleanup.
 * - Deletes posts/images media older than 30 days.
 * - Deletes avatars ONLY if the user is no longer in the active contacts list.
 */
export async function runSmartStorageCleanup() {
  if (Platform.OS === "web") {
    console.warn("[StorageService] runSmartStorageCleanup skipped on web.");
    return { imagesDeleted: 0, avatarsDeleted: 0 };
  }

  try {
    console.log("[StorageService] Running smart storage cleanup...");

    // 1. Clean old post media in Images directory
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const images = await FileSystem.readDirectoryAsync(IMAGES_DIR);
    let imagesDeleted = 0;

    for (const image of images) {
      const path = `${IMAGES_DIR}${image}`;
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists && info.modificationTime * 1000 < thirtyDaysAgo) {
        await FileSystem.deleteAsync(path);
        imagesDeleted++;
      }
    }

    // 2. Clean avatars strictly: Keep only active contacts' avatars
    const activeContacts = await getContacts();

    // Map of active local paths to protect from deletion
    const protectedAvatars = new Set();
    activeContacts.forEach((c) => {
      if (c.avatar && c.avatar.startsWith("file:///")) {
        // Extract filename from file path
        const filename = c.avatar.split("/").pop();
        if (filename) protectedAvatars.add(filename);
      }
    });

    const avatars = await FileSystem.readDirectoryAsync(AVATARS_DIR);
    let avatarsDeleted = 0;

    for (const avatar of avatars) {
      // Do not delete if the avatar belongs to an active contact
      if (!protectedAvatars.has(avatar)) {
        const path = `${AVATARS_DIR}${avatar}`;
        await FileSystem.deleteAsync(path);
        avatarsDeleted++;
      }
    }

    console.log(
      `[StorageService] Smart cleanup complete. Purged ${imagesDeleted} images and ${avatarsDeleted} stale contact avatars.`,
    );
    return { imagesDeleted, avatarsDeleted };
  } catch (error) {
    console.error("[StorageService] runSmartStorageCleanup error:", error);
    return { imagesDeleted: 0, avatarsDeleted: 0 };
  }
}

/**
 * Computes directory sizes in bytes for storage statistics UI.
 */
export async function getStorageStats() {
  try {
    const getDirSize = async (dirPath) => {
      if (Platform.OS === "web") {
        return 0;
      }

      let total = 0;
      const info = await FileSystem.getInfoAsync(dirPath);
      if (!info.exists) return 0;

      const files = await FileSystem.readDirectoryAsync(dirPath);
      for (const file of files) {
        const fileInfo = await FileSystem.getInfoAsync(`${dirPath}${file}`);
        if (fileInfo.exists) {
          total += fileInfo.size;
        }
      }
      return total;
    };

    const imagesSize = await getDirSize(IMAGES_DIR);
    const avatarsSize = await getDirSize(AVATARS_DIR);
    const videosSize = await getDirSize(VIDEOS_DIR);

    return {
      imagesSize: (imagesSize / (1024 * 1024)).toFixed(2), // in MB
      avatarsSize: (avatarsSize / (1024 * 1024)).toFixed(2), // in MB
      videosSize: (videosSize / (1024 * 1024)).toFixed(2), // in MB
      totalSize: ((imagesSize + avatarsSize + videosSize) / (1024 * 1024)).toFixed(2),
    };
  } catch (error) {
    console.error("[StorageService] getStorageStats error:", error);
    return { imagesSize: "0.00", avatarsSize: "0.00", videosSize: "0.00", totalSize: "0.00" };
  }
}

/**
 * Deletes all cached local media files.
 */
export async function clearLocalMediaCache() {
  if (Platform.OS === "web") {
    console.warn("[StorageService] clearLocalMediaCache skipped on web.");
    return true;
  }

  try {
    const clearDir = async (dirPath) => {
      const files = await FileSystem.readDirectoryAsync(dirPath);
      for (const file of files) {
        await FileSystem.deleteAsync(`${dirPath}${file}`, {
          idempotent: true,
        });
      }
    };
    await clearDir(IMAGES_DIR);
    await clearDir(AVATARS_DIR);
    await clearDir(VIDEOS_DIR);
    return true;
  } catch (error) {
    console.error("[StorageService] clearLocalMediaCache error:", error);
    return false;
  }
}

/**
 * Removes every bit of app data and returns the app to a fresh state.
 */
export async function clearAllAppData() {
  try {
    await clearDatabase();
    await clearLocalMediaCache();

    const allKeys = await AsyncStorage.getAllKeys();
    if (allKeys.length > 0) {
      await AsyncStorage.multiRemove(allKeys);
    }

    if (Platform.OS !== "web") {
      const backupInfo = await FileSystem.getInfoAsync(SETTINGS_BACKUP_PATH);
      if (backupInfo.exists) {
        await FileSystem.deleteAsync(SETTINGS_BACKUP_PATH, {
          idempotent: true,
        });
      }
    }

    console.log("[StorageService] App data cleared successfully.");
    return true;
  } catch (error) {
    console.error("[StorageService] clearAllAppData error:", error);
    return false;
  }
}
/**
 * Triggers weekly cloud backup of contacts, chats, explore profiles, and posts.
 */
export async function triggerCloudBackup(force = false) {
  try {
    const lastBackupStr = await AsyncStorage.getItem("unity_last_backup_time");
    const lastBackup = lastBackupStr ? parseInt(lastBackupStr, 10) : 0;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    if (!force && Date.now() - lastBackup < sevenDays) {
      console.log(
        "[StorageService] Backup skipped. Last backup was less than 7 days ago.",
      );
      return false;
    }

    console.log("[StorageService] Preparing cloud backup payload...");
    const db = await getDatabase();

    // Fetch all database tables
    const contacts = await db.getAllAsync("SELECT * FROM contacts;");
    const chats = await db.getAllAsync("SELECT * FROM chats;");
    const posts = await db.getAllAsync("SELECT * FROM posts;");

    const payload = {
      contacts,
      chats,
      posts,
      backupTime: Date.now(),
    };

    const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com"}/api/backup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      await AsyncStorage.setItem(
        "unity_last_backup_time",
        Date.now().toString(),
      );
      console.log("[StorageService] Cloud backup completed successfully.");
      return true;
    } else {
      throw new Error(`Server returned HTTP ${response.status}`);
    }
  } catch (error) {
    console.error("[StorageService] triggerCloudBackup failed:", error.message);
    return false;
  }
}

