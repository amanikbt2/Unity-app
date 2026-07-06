import { Platform } from 'react-native';
import Constants from 'expo-constants';

let BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://unity-3xc2.onrender.com';

// Auto-resolve localhost to the developer's machine IP for physical devices via Expo
if (Platform.OS !== "web" && BASE_URL.includes("localhost") && Constants.expoConfig?.hostUri) {
  const hostIp = Constants.expoConfig.hostUri.split(":")[0];
  BASE_URL = `http://${hostIp}:3000`;
  console.log("[LogService] Auto-resolved localhost to:", BASE_URL);
}

const APP_VERSION =
  Constants.expoConfig?.version ||
  Constants.manifest?.version ||
  'unknown';

const PLATFORM = Platform.OS; // 'android' | 'ios' | 'web'

/**
 * Sends a structured activity log to the backend.
 * Fails silently so it never breaks the user experience.
 *
 * @param {string} event      - Event name, e.g. 'app_open', 'login_click', 'login_success', 'login_fail'
 * @param {object} [extras]   - Optional extra fields
 */
export async function logEvent(event, extras = {}) {
  try {
    const payload = {
      event,
      platform: PLATFORM,
      appVersion: APP_VERSION,
      method: extras.method || '',
      userLabel: extras.userLabel || 'guest',
      email: extras.email || '',
      error: extras.error || '',
      meta: extras.meta || {},
    };

    // Fire-and-forget — don't await in hot paths
    fetch(`${BASE_URL}/api/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {}); // swallow network errors silently
  } catch (_) {
    // Never throw
  }
}

// ─── Convenience helpers ───────────────────────────────────────────────────

/** Called once when the app mounts. */
export function logAppOpen(userName = null) {
  logEvent('app_open', {
    userLabel: userName || 'guest',
  });
}

/** Called when user taps a login button. */
export function logLoginClick(method) {
  logEvent('login_click', { method });
}

/** Called when login succeeds. */
export function logLoginSuccess(method, name, email) {
  logEvent('login_success', {
    method,
    userLabel: name || 'user',
    email: email || '',
  });
}

/** Called when login fails. */
export function logLoginFail(method, errorMessage) {
  logEvent('login_fail', {
    method,
    error: String(errorMessage).slice(0, 300), // cap length
  });
}

/**
 * Registers global handlers to catch uncaught JavaScript exceptions
 * and unhandled Promise rejections, logging them to the server.
 */
export function initGlobalErrorHandler() {
  if (global.ErrorUtils) {
    const originalHandler = global.ErrorUtils.getGlobalHandler();
    global.ErrorUtils.setGlobalHandler((error, isFatal) => {
      // Send log to server
      logEvent('app_error', {
        error: error?.message || String(error),
        meta: {
          isFatal,
          stack: error?.stack,
        },
      });

      // Delegate back to standard RN error handler
      if (originalHandler) {
        originalHandler(error, isFatal);
      }
    });
  }

  // Intercept unhandled promise rejections
  const rejectionTracking = require('promise/setimmediate/rejection-tracking');
  rejectionTracking.enable({
    allRejections: true,
    onUnhandled: (id, error) => {
      logEvent('unhandled_rejection', {
        error: error?.message || String(error),
        meta: {
          id,
          stack: error?.stack,
        },
      });
    },
  });
  console.log('[LogService] Global error and rejection handlers initialized.');
}

