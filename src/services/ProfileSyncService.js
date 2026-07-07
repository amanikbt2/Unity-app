import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

const SERVER_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";

const QUEUE_KEY = "amani_profile_sync_queue";

/**
 * Queue a profile update or deletion locally if offline, or sync immediately if online.
 * 
 * @param {string} action - 'save' | 'delete'
 * @param {object} profile - { uid, name, avatar, flag, langName, bio }
 */
export async function queueProfileSync(action, profile) {
  try {
    const netState = await NetInfo.fetch();
    if (netState.isConnected) {
      console.log(`[ProfileSync] Online. Syncing ${action} immediately...`);
      const success = await sendSyncRequest(action, profile);
      if (success) return;
    }

    console.log(`[ProfileSync] Offline or sync failed. Queuing ${action} locally...`);
    const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
    let queue = queueJson ? JSON.parse(queueJson) : [];
    
    // Filter out previous pending actions for the same user to avoid duplicate work
    queue = queue.filter(item => item.profile.uid !== profile.uid);
    queue.push({ action, profile, timestamp: Date.now() });
    
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error("[ProfileSync] Failed to queue profile action:", err);
  }
}

/**
 * Helper to perform the actual HTTP request to the backend.
 */
async function sendSyncRequest(action, profile) {
  try {
    if (action === "save") {
      const response = await fetch(`${SERVER_URL}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      return response.ok;
    } else if (action === "delete") {
      const response = await fetch(`${SERVER_URL}/api/users/${profile.uid}`, {
        method: "DELETE",
      });
      return response.ok;
    }
    return false;
  } catch (err) {
    console.warn(`[ProfileSync] HTTP request failed for action ${action}:`, err.message);
    return false;
  }
}

/**
 * Processes all pending local profile sync actions in the queue.
 */
export async function processSyncQueue() {
  try {
    const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
    if (!queueJson) return;

    const queue = JSON.parse(queueJson);
    if (queue.length === 0) return;

    console.log(`[ProfileSync] Found ${queue.length} pending actions. Syncing...`);
    const remaining = [];

    for (const item of queue) {
      const success = await sendSyncRequest(item.action, item.profile);
      if (!success) {
        remaining.push(item);
      }
    }

    if (remaining.length > 0) {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    } else {
      await AsyncStorage.removeItem(QUEUE_KEY);
      console.log("[ProfileSync] All pending actions successfully synced.");
    }
  } catch (err) {
    console.error("[ProfileSync] Error processing queue:", err);
  }
}

/**
 * Initializes connection listening to automatically process queue when online.
 */
export function initProfileSync() {
  console.log("[ProfileSync] Initializing offline profile sync listener...");
  NetInfo.addEventListener(state => {
    if (state.isConnected) {
      console.log("[ProfileSync] Network connection is online. Triggering sync queue processing...");
      processSyncQueue();
    }
  });
}
