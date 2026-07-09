import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";

// Configure local notification handlers
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
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
export async function scheduleLocalNotification(title, body, data = {}) {
  try {
    if (Platform.OS === 'web') {
      console.log(`[Notification] ${title}: ${body}`);
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
      },
      trigger: null,
    });
  } catch (err) {
    console.warn("[NotificationService] scheduleLocalNotification failed:", err);
  }
}

/**
 * Specifically displays a notification for an incoming chat message.
 */
export async function displayMessageNotification(senderName, body, avatarUrl = "") {
  try {
    if (Platform.OS === 'web') {
      console.log(`[Message from ${senderName}] ${body}`);
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `💬 New message from ${senderName}`,
        body: body,
        data: { type: 'chat', senderName },
      },
      trigger: null,
    });
  } catch (err) {
    console.warn("[NotificationService] displayMessageNotification failed:", err);
  }
}
