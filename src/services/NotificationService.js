import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";

import notifee, { AndroidImportance, AndroidCategory, EventType } from "@notifee/react-native";

let activeChatPartnerId = null;

export function setActiveChatPartnerId(id) {
  activeChatPartnerId = id;
  console.log(`[NotificationService] Active chat partner set to: ${id}`);
}

// Configure local notification handlers
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data || {};
    if (data.type === 'incoming_call') {
      console.log("[NotificationService] Intercepted incoming call push notification:", data);
      displayIncomingCallNotification(data.callerName || data.senderName, data.callId, data.callerId);
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }
    
    if (activeChatPartnerId) {
      if (data.partnerId === activeChatPartnerId || data.type === 'chat') {
        console.log(`[NotificationService] Suppressing active partner notification: ${data.partnerId || 'chat'}`);
        return {
          shouldShowAlert: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
        };
      }
    }
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    };
  },
});

// Intercept background/foreground push notifications when received
if (Platform.OS !== 'web') {
  try {
    Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data || {};
      console.log("[NotificationService] Push notification received:", data);
      if (data.type === 'incoming_call') {
        displayIncomingCallNotification(data.callerName || data.senderName, data.callId, data.callerId);
      }
    });

    Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data || {};
      const actionIdentifier = response.actionIdentifier;
      console.log("[NotificationService] Push notification action tapped:", actionIdentifier, data);

      if (data.type === 'incoming_call') {
        if (actionIdentifier === 'answer' || actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          await AsyncStorage.setItem("amani_pending_answer_call_id", data.callId || "");
          await AsyncStorage.setItem("amani_pending_answer_caller_id", data.callerId || "");
        } else if (actionIdentifier === 'reject') {
          const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://unity-3xc2.onrender.com';
          await fetch(`${API_URL}/api/calls/reject`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callId: data.callId }),
          }).catch(err => console.error("[NotificationService] Reject background call tap error:", err));
        }
      }
    });
  } catch (err) {
    console.warn("[NotificationService] Failed to attach notification listeners:", err);
  }
}

let BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://unity-3xc2.onrender.com';

// Auto-resolve localhost IP for physical devices running Expo
if (Platform.OS !== "web" && BASE_URL.includes("localhost") && Constants.expoConfig?.hostUri) {
  const hostIp = Constants.expoConfig.hostUri.split(":")[0];
  BASE_URL = `http://${hostIp}:3000`;
}

/**
 * Request permission for native Android/iOS notifications on startup.
 * Returns true if granted, false otherwise.
 */
export async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') return false;
  
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('[NotificationService] Notification permissions denied.');
      return false;
    }
    
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
    console.log('[NotificationService] Permissions and channels initialized.');
    return true;
  } catch (err) {
    console.warn('[NotificationService] Failed to initialize notifications:', err.message);
    return false;
  }
}

/**
 * Polls the backend for the latest notification payload.
 * Triggers a local notification alert if the campaign ID has changed.
 */
export async function checkForNewNotifications() {
  try {
    const lastId = await AsyncStorage.getItem("amani_last_notification_id");

    // Read user profile from AsyncStorage for targeted notifications + placeholder resolution
    let userEmail = '';
    let userProfile = {};
    try {
      const profileRaw = await AsyncStorage.getItem("amani_profile_settings");
      if (profileRaw) {
        userProfile = JSON.parse(profileRaw);
        userEmail = (userProfile.email || '').trim().toLowerCase();
      }
    } catch (_) {}

    const url = userEmail
      ? `${BASE_URL}/api/notifications?email=${encodeURIComponent(userEmail)}`
      : `${BASE_URL}/api/notifications`;

    const response = await fetch(url);
    if (!response.ok) return;

    const data = await response.json();
    const latestNotification = data.latest;
    if (!latestNotification) return;

    if (latestNotification.id !== lastId) {
      // Store new notification campaign ID
      await AsyncStorage.setItem("amani_last_notification_id", latestNotification.id);

      // Trigger native notification banner (with user profile for placeholder resolution)
      await showNativeNotification(latestNotification, userProfile);
    }
  } catch (err) {
    console.warn("[NotificationService] Polling failed:", err.message);
  }
}

/**
 * Gets the Expo push token for this device.
 * Send this to the backend via /api/register-push to enable background push.
 * Must be called after notification permissions are granted.
 */
export async function getExpoPushToken() {
  if (Platform.OS === 'web') return null;
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn('[NotificationService] No EAS projectId found in app.json. Push token unavailable.');
      return null;
    }
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log('[NotificationService] Expo push token:', tokenData.data);
    return tokenData.data;
  } catch (err) {
    console.warn('[NotificationService] Failed to get Expo push token:', err.message);
    return null;
  }
}

/**
 * Resolves magic word placeholders in a string with actual user profile values.
 * Supported: {username} or {name}, {email}, {firstname}
 */
function resolvePlaceholders(text, profile = {}) {
  if (!text) return text;
  const name = profile.name || profile.displayName || 'there';
  const firstName = name.split(' ')[0];
  const email = profile.email || '';
  return text
    .replace(/\{username\}/gi, name)
    .replace(/\{name\}/gi, name)
    .replace(/\{firstname\}/gi, firstName)
    .replace(/\{email\}/gi, email);
}

/**
 * Presents a local notification banner based on alert type
 */
async function showNativeNotification(notif, userProfile = {}) {
  if (Platform.OS === 'web') {
    alert(`[${notif.type === 'chat' ? 'Message' : 'System'}] ${notif.title || notif.senderName}: ${notif.body}`);
    return;
  }

  let title = "";
  let body = "";

  if (notif.type === 'chat') {
    title = `💬 New message from ${resolvePlaceholders(notif.senderName, userProfile)}`;
    body = resolvePlaceholders(notif.body, userProfile);
  } else {
    const iconEmoji = getSystemEmoji(notif.icon);
    title = `${iconEmoji} ${resolvePlaceholders(notif.title, userProfile)}`;
    body = resolvePlaceholders(notif.body, userProfile);
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { notifId: notif.id, type: notif.type },
    },
    trigger: null,
  });
}

function getSystemEmoji(iconType) {
  switch (iconType) {
    case 'warning': return '⚠️';
    case 'success': return '✅';
    case 'info': return 'ℹ️';
    default: return '📢';
  }
}

/**
 * Triggers a local notification alert (for timed reminders etc.).
 */
export async function scheduleLocalNotification(title, body, trigger = null, partnerId = "") {
  try {
    if (Platform.OS === 'web') {
      console.log(`[Notification] ${title}: ${body}`);
      return;
    }

    if (partnerId && activeChatPartnerId === partnerId) {
      console.log(`[NotificationService] Suppressed scheduling notification for active partner: ${partnerId}`);
      return;
    }

    let normalizedTrigger = null;
    if (trigger && trigger.seconds) {
      normalizedTrigger = {
        type: 'timeInterval',
        seconds: trigger.seconds,
        repeats: trigger.repeats || false,
      };
    } else if (trigger) {
      normalizedTrigger = trigger;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { partnerId },
      },
      trigger: normalizedTrigger,
    });
  } catch (err) {
    console.warn("[NotificationService] scheduleLocalNotification failed:", err);
  }
}

export async function displayMessageNotification(senderName, body, avatarUrl = "", partnerId = "") {
  try {
    if (Platform.OS === 'web') {
      console.log(`[Message from ${senderName}] ${body}`);
      return;
    }

    if (partnerId && activeChatPartnerId === partnerId) {
      console.log(`[NotificationService] Suppressed incoming message notification for active partner: ${partnerId}`);
      return;
    }

    await notifee.requestPermission();

    const channelId = await notifee.createChannel({
      id: 'chat-messages',
      name: 'Chat Messages',
      importance: AndroidImportance.HIGH,
    });

    await notifee.displayNotification({
      title: `💬 New message from ${senderName}`,
      body: body,
      data: { type: 'chat', senderName, partnerId },
      android: {
        channelId,
        importance: AndroidImportance.HIGH,
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
        actions: [
          {
            title: 'Reply',
            pressAction: {
              id: 'reply',
            },
            input: {
              placeholder: 'Type your message...',
            },
          },
        ],
      },
    });
  } catch (err) {
    console.warn("[NotificationService] displayMessageNotification failed:", err);
  }
}

/**
 * Rich call notification using Notifee with custom Ringtone and Answer/Reject buttons.
 */
export async function displayIncomingCallNotification(callerName, callId, callerId) {
  if (Platform.OS === 'web' || !notifee) return;

  try {
    await notifee.requestPermission();

    const channelId = await notifee.createChannel({
      id: 'incoming-call',
      name: 'Incoming Call Alerts',
      importance: AndroidImportance.HIGH,
      sound: 'ringtone',
      vibration: true,
      vibrationPattern: [300, 500, 300, 500],
    });

    const notifId = callId || `call_${Date.now()}`;

    await notifee.displayNotification({
      id: notifId,
      title: '📞 Incoming Voice Call',
      body: `${callerName || 'Someone'} is calling you...`,
      data: { type: 'incoming_call', callerId: callerId || '', callId: notifId, callerName: callerName || 'Someone' },
      android: {
        channelId,
        importance: AndroidImportance.HIGH,
        category: AndroidCategory.CALL,
        fullScreenIntent: true,
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
        actions: [
          {
            title: 'Answer',
            pressAction: {
              id: 'answer',
              launchActivity: 'default',
            },
          },
          {
            title: 'Decline',
            pressAction: {
              id: 'reject',
            },
          },
        ],
      },
      ios: {
        sound: 'ringtone.mp3',
        categoryId: 'incoming-call-category',
      },
    });
  } catch (err) {
    console.error("[NotificationService] displayIncomingCallNotification failed:", err);
  }
}

// Setup background and foreground events for call interactions
if (Platform.OS !== "web" && notifee) {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    const { notification, pressAction } = detail;
    if (type === EventType.ACTION_PRESS) {
      const activeCallId = notification.data?.callId || notification.id;
      const activeCallerId = notification.data?.callerId || "";
      if (pressAction.id === 'answer' || pressAction.id === 'default') {
        console.log('[NotificationService] User answered background call:', activeCallId);
        await AsyncStorage.setItem("amani_pending_answer_call_id", activeCallId);
        await AsyncStorage.setItem("amani_pending_answer_caller_id", activeCallerId);
      } else if (pressAction.id === 'reject') {
        console.log('[NotificationService] User rejected background call:', activeCallId);
        const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://unity-3xc2.onrender.com';
        await fetch(`${API_URL}/api/calls/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callId: activeCallId }),
        }).catch(err => console.error("[NotificationService] Reject background call failed:", err));
      } else if (pressAction.id === 'reply') {
        const replyText = detail.input;
        const partnerId = notification.data?.partnerId;
        const senderName = notification.data?.senderName || "User";
        if (replyText && partnerId) {
          console.log(`[NotificationService] Quick replying in background:`, replyText);
          const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://unity-3xc2.onrender.com';
          await fetch(`${API_URL}/api/push-message`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipientId: partnerId,
              senderName: senderName,
              messageText: replyText,
              type: 'chat'
            }),
          }).catch(err => console.error("[NotificationService] Background quick reply failed:", err));
        }
      }
      await notifee.cancelNotification(notification.id);
    }
  });

  notifee.onForegroundEvent(async ({ type, detail }) => {
    const { notification, pressAction } = detail;
    if (type === EventType.ACTION_PRESS) {
      const activeCallId = notification.data?.callId || notification.id;
      const activeCallerId = notification.data?.callerId || "";
      if (pressAction.id === 'answer' || pressAction.id === 'default') {
        console.log('[NotificationService] User answered foreground call:', activeCallId);
        await AsyncStorage.setItem("amani_pending_answer_call_id", activeCallId);
        await AsyncStorage.setItem("amani_pending_answer_caller_id", activeCallerId);
      } else if (pressAction.id === 'reject') {
        console.log('[NotificationService] User rejected foreground call:', activeCallId);
        const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://unity-3xc2.onrender.com';
        await fetch(`${API_URL}/api/calls/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callId: activeCallId }),
        }).catch(err => console.error("[NotificationService] Reject foreground call failed:", err));
      } else if (pressAction.id === 'reply') {
        const replyText = detail.input;
        const partnerId = notification.data?.partnerId;
        const senderName = notification.data?.senderName || "User";
        if (replyText && partnerId) {
          console.log(`[NotificationService] Quick replying in foreground:`, replyText);
          const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://unity-3xc2.onrender.com';
          await fetch(`${API_URL}/api/push-message`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipientId: partnerId,
              senderName: senderName,
              messageText: replyText,
              type: 'chat'
            }),
          }).catch(err => console.error("[NotificationService] Foreground quick reply failed:", err));
        }
      }
      await notifee.cancelNotification(notification.id);
    }
  });
}
