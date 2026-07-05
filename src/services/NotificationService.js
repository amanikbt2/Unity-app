import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import notifee, {
  AndroidStyle,
  AndroidImportance,
} from "@notifee/react-native";

// Set up the notification handler for when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#8B5CF6",
    });
  }

  if (Device.isDevice || Platform.OS === "web") {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Failed to get push token for push notification!");
      return null;
    }

    try {
      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId: "your-project-id", // Replace with real ID if using EAS
        })
      ).data;
      console.log("Expo Push Token:", token);
    } catch (e) {
      console.log("Error getting token:", e);
    }
  } else {
    console.log("Must use physical device for Push Notifications");
  }

  return token;
}

export async function scheduleLocalNotification(title, body, trigger = null) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
    },
    trigger, // e.g. { seconds: 120 } for 2 minutes from now, or null for immediate
  });
}

export async function displayMessageNotification(
  senderName,
  messageText,
  avatarUrl = null,
) {
  if (Platform.OS === "web") return; // Notifee is not supported on web

  try {
    // Request permissions (required for iOS)
    await notifee.requestPermission();

    let channelId = "default";

    if (Platform.OS === "android") {
      // Create a channel (required for Android)
      channelId = await notifee.createChannel({
        id: "messages",
        name: "Messages",
        importance: AndroidImportance.HIGH,
      });
    }

    // Build Android notification
    const androidConfig = {
      channelId,
      smallIcon: "ic_launcher", // fallback to default app icon
      color: "#8B5CF6",
      pressAction: {
        id: "default",
      },
      // The main style for WhatsApp-like messaging layout
      style: {
        type: AndroidStyle.MESSAGING,
        person: {
          name: senderName,
          icon: avatarUrl || undefined,
        },
        messages: [
          {
            text: messageText,
            timestamp: Date.now(),
            person: {
              name: senderName,
              icon: avatarUrl || undefined,
            },
          },
        ],
        title: `${senderName} • unityApp`, // "unity AI . unityApp"
      },
    };

    // If we have an avatar URL, also use it as the largeIcon
    if (avatarUrl && Platform.OS === "android") {
      androidConfig.largeIcon = avatarUrl;
    }

    // Display a notification
    await notifee.displayNotification({
      title: senderName,
      body: messageText,
      android: androidConfig,
    });
  } catch (error) {
    console.warn("Failed to display notification:", error);
  }
}
