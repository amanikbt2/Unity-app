import * as SecureStore from 'expo-secure-store';

/**
 * Securely stores a key-value pair in the device's hardware-encrypted enclave.
 */
export async function saveSecureValue(key, value) {
  try {
    await SecureStore.setItemAsync(key, value);
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
    await SecureStore.deleteItemAsync(key);
    return true;
  } catch (error) {
    console.error(`[SecureStorage] Error deleting key "${key}":`, error);
    return false;
  }
}
