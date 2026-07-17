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
      displayIncomingCallNotification(data.callerName, data.callId, data.callerId);
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

let BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://unity-3xc2.onrender.com';

// Auto-resolve localhost IP for physical devices running Expo
if (Platform.OS !== "web" && BASE_URL.includes("localhost") && Constants.expoConfig?.hostUri) {
  const hostIp = Constants.expoConfig.hostUri.split(":")[0];
  BASE_URL = `http://${hostIp}:3000`;
}

/**
 * Request permission for native Android/iOS notifications on startup
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
    const response = await fetch(`${BASE_URL}/api/notifications`);
    if (!response.ok) return;
    
    const data = await response.json();
    const latestNotification = data.latest;
    if (!latestNotification) return;
    
    if (latestNotification.id !== lastId) {
      // Store new notification campaign ID
      await AsyncStorage.setItem("amani_last_notification_id", latestNotification.id);
      
      // Trigger native notification banner
      await showNativeNotification(latestNotification);
    }
  } catch (err) {
    console.warn("[NotificationService] Polling failed:", err.message);
  }
}

/**
 * Presents a local notification banner based on alert type
 */
async function showNativeNotification(notif) {
  if (Platform.OS === 'web') {
    alert(`[${notif.type === 'chat' ? 'Message' : 'System'}] ${notif.title || notif.senderName}: ${notif.body}`);
    return;
  }

  let title = "";
  let body = "";
  
  if (notif.type === 'chat') {
    title = `💬 New message from ${notif.senderName}`;
    body = notif.body;
  } else {
    const iconEmoji = getSystemEmoji(notif.icon);
    title = `${iconEmoji} ${notif.title}`;
    body = notif.body;
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
 * Triggers a local notification alert.
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

/**
 * Specifically displays a notification for an incoming chat message.
 */
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

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `💬 New message from ${senderName}`,
        body: body,
        data: { type: 'chat', senderName, partnerId },
      },
      trigger: null,
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
      sound: 'ringtone', // Custom sound file android/app/src/main/res/raw/ringtone.mp3
      vibration: true,
      vibrationPattern: [300, 500, 300, 500],
    });

    await notifee.displayNotification({
      id: callId,
      title: '📞 Incoming Voice Call',
      body: `${callerName || 'Someone'} is calling you...`,
      data: { callerId, callId },
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
            title: 'Reject',
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
      if (pressAction.id === 'answer') {
        console.log('[NotificationService] User answered background call:', notification.id);
        await AsyncStorage.setItem("amani_pending_answer_call_id", notification.id);
        await AsyncStorage.setItem("amani_pending_answer_caller_id", notification.data?.callerId || "");
      } else if (pressAction.id === 'reject') {
        console.log('[NotificationService] User rejected background call:', notification.id);
        const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://unity-3xc2.onrender.com';
        await fetch(`${API_URL}/api/calls/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callId: notification.id }),
        }).catch(err => console.error("[NotificationService] Reject background call failed:", err));
      }
      await notifee.cancelNotification(notification.id);
    }
  });

  notifee.onForegroundEvent(async ({ type, detail }) => {
    const { notification, pressAction } = detail;
    if (type === EventType.ACTION_PRESS) {
      if (pressAction.id === 'answer') {
        console.log('[NotificationService] User answered foreground call:', notification.id);
        await AsyncStorage.setItem("amani_pending_answer_call_id", notification.id);
        await AsyncStorage.setItem("amani_pending_answer_caller_id", notification.data?.callerId || "");
      } else if (pressAction.id === 'reject') {
        console.log('[NotificationService] User rejected foreground call:', notification.id);
        const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://unity-3xc2.onrender.com';
        await fetch(`${API_URL}/api/calls/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callId: notification.id }),
        }).catch(err => console.error("[NotificationService] Reject foreground call failed:", err));
      }
      await notifee.cancelNotification(notification.id);
    }
  });
}
