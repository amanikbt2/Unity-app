import { AppState } from "react-native";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";

// In-memory presence cache mapping uid -> { isOnline: boolean, lastActive: number }
const presenceCache = new Map();

/**
 * Send a sharp, lightweight, non-blocking presence ping (heartbeat).
 * Uses AbortController with a short 2500ms timeout to ensure zero UI delay.
 */
export const sendPresenceSignal = (uid, isOnline = true) => {
  if (!uid || uid === "unity_ai") return;

  // Optimistically update local cache immediately
  presenceCache.set(uid, {
    isOnline: !!isOnline,
    lastActive: Date.now(),
  });

  try {
    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), 2500)
      : null;

    fetch(`${API_URL}/api/users/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, isOnline: !!isOnline, timestamp: Date.now() }),
      signal: controller ? controller.signal : undefined,
    })
      .then((res) => {
        if (timeoutId) clearTimeout(timeoutId);
        return res.json().catch(() => ({}));
      })
      .then((data) => {
        if (data && typeof data.isOnline === "boolean") {
          presenceCache.set(uid, {
            isOnline: data.isOnline,
            lastActive: data.lastActive
              ? new Date(data.lastActive).getTime()
              : Date.now(),
          });
        }
      })
      .catch(() => {
        if (timeoutId) clearTimeout(timeoutId);
      });
  } catch (_err) {
    // Non-blocking fire and forget
  }
};

/**
 * Update presence in cache when received from API responses (e.g. contacts list or chat room data)
 */
export const updatePresenceCache = (uid, isOnline, lastActive) => {
  if (!uid) return;
  presenceCache.set(uid, {
    isOnline: !!isOnline,
    lastActive: lastActive ? new Date(lastActive).getTime() : Date.now(),
  });
};

/**
 * Accurately check if a user or contact is online.
 * Rules:
 * 1. Self ('isMe') or 'unity_ai' -> ALWAYS online.
 * 2. If present in presenceCache within 2-minute threshold (120,000ms):
 *    returns cache.isOnline && (Date.now() - cache.lastActive <= 120000).
 * 3. If contact object has `lastActive`:
 *    returns (Date.now() - new Date(contact.lastActive).getTime() <= 120000) && contact.isOnline !== false.
 * 4. If contact object has explicit boolean `isOnline`:
 *    If false -> returns false.
 *    If true and has recent lastActive timestamp -> returns true if <= 120000ms.
 * 5. Bio status text ("Online", "available", etc.) is NOT treated as online indicator.
 */
export const checkIsUserOnline = (userOrContact) => {
  if (!userOrContact) return false;

  const id = userOrContact.uid || userOrContact.id;
  if (userOrContact.isMe || id === "unity_ai" || id === "Me") return true;

  // Check in-memory cache first
  if (id && presenceCache.has(id)) {
    const cached = presenceCache.get(id);
    const isRecent = Date.now() - cached.lastActive <= 120000; // 2 min threshold
    return cached.isOnline && isRecent;
  }

  // Check lastActive timestamp if present on contact
  if (userOrContact.lastActive) {
    const lastActiveTs = new Date(userOrContact.lastActive).getTime();
    if (!isNaN(lastActiveTs)) {
      const isRecent = Date.now() - lastActiveTs <= 120000; // 2 min threshold
      return isRecent && userOrContact.isOnline !== false;
    }
  }

  // Explicit boolean isOnline without lastActive timestamp
  if (userOrContact.isOnline === false) return false;

  // If isOnline is true but has lastVerifiedOnline or lastActive
  if (userOrContact.isOnline === true && userOrContact.lastVerifiedOnline) {
    const elapsed =
      Date.now() - new Date(userOrContact.lastVerifiedOnline).getTime();
    return elapsed <= 120000;
  }

  return false;
};

/**
 * Initialize sharp, lightweight presence tracker for active user:
 * - Sends immediate ping when app starts or switches to foreground ('active')
 * - Sends offline ping when app switches to background or inactive
 * - Sends periodic heartbeat ping every 25 seconds while app is active
 */
export const setupPresenceTracker = (uid) => {
  if (!uid) return () => {};

  // Send initial active ping
  sendPresenceSignal(uid, true);

  // Send heartbeat every 25 seconds
  const intervalId = setInterval(() => {
    if (AppState.currentState === "active") {
      sendPresenceSignal(uid, true);
    }
  }, 25000);

  // AppState change listener
  const subscription = AppState.addEventListener("change", (nextAppState) => {
    if (nextAppState === "active") {
      sendPresenceSignal(uid, true);
    } else if (nextAppState === "background" || nextAppState === "inactive") {
      sendPresenceSignal(uid, false);
    }
  });

  return () => {
    clearInterval(intervalId);
    if (subscription && typeof subscription.remove === "function") {
      subscription.remove();
    }
    // Send final offline ping on unmount/logout
    sendPresenceSignal(uid, false);
  };
};
