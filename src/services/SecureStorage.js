import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Securely stores a key-value pair in the device's hardware-encrypted enclave.
 * Falls back to AsyncStorage on the web.
 */
export async function saveSecureValue(key, value) {
  try {
    if (Platform.OS === "web") {
      await AsyncStorage.setItem(`secure_${key}`, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
    return true;
  } catch (error) {
    console.error(`[SecureStorage] Error saving key "${key}":`, error);
    return false;
  }
}

/**
 * Retrieves a securely stored value.
 */
export async function getSecureValue(key) {
  try {
    if (Platform.OS === "web") {
      return await AsyncStorage.getItem(`secure_${key}`);
    }
    const value = await SecureStore.getItemAsync(key);
    return value;
  } catch (error) {
    console.error(`[SecureStorage] Error getting key "${key}":`, error);
    return null;
  }
}

/**
 * Deletes a securely stored value.
 */
export async function deleteSecureValue(key) {
  try {
    if (Platform.OS === "web") {
      await AsyncStorage.removeItem(`secure_${key}`);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
    return true;
  } catch (error) {
    console.error(`[SecureStorage] Error deleting key "${key}":`, error);
    return false;
  }
}

/**
 * Stores the timestamp of the last import check.
 * Key: 'last_import_check_timestamp'
 */
export async function saveLastImportCheckTime(timestamp = Date.now()) {
  return saveSecureValue("last_import_check_timestamp", String(timestamp));
}

/**
 * Retrieves the timestamp of the last import check.
 * Returns null if never checked or not available.
 */
export async function getLastImportCheckTime() {
  const value = await getSecureValue("last_import_check_timestamp");
  return value ? Number(value) : null;
}

/**
 * Stores whether this is the first time the app is being used.
 * Key: 'is_first_time_import'
 */
export async function saveFirstTimeImportStatus(isFirstTime = true) {
  return saveSecureValue(
    "is_first_time_import",
    isFirstTime ? "true" : "false",
  );
}

/**
 * Checks if this is the first time import.
 * Returns true if it's the first time, false otherwise.
 */
export async function isFirstTimeImport() {
  const value = await getSecureValue("is_first_time_import");
  return value === null || value === "true";
}

/**
 * Stores the date of the last auto sync (YYYY-MM-DD).
 */
export async function saveLastAutoSyncDate(dateStr) {
  return saveSecureValue("last_auto_sync_date", dateStr);
}

/**
 * Retrieves the date of the last auto sync (YYYY-MM-DD).
 */
export async function getLastAutoSyncDate() {
  return await getSecureValue("last_auto_sync_date");
}

