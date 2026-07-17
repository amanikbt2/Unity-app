import "react-native-gesture-handler";
import React, { useContext, useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  View,
  StyleSheet,
  Platform,
  Modal,
  Text,
  TouchableOpacity,
  Linking,
} from "react-native";

import { AppProvider, AppContext } from "./src/context/AppContext";
import AuthScreen from "./src/screens/AuthScreen";
import HomeScreen from "./src/screens/HomeScreen";
import ConversationScreen from "./src/screens/ConversationScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import AppAnnouncerModal from "./src/components/AppAnnouncerModal";
import { initGlobalErrorHandler } from "./src/services/LogService";
import { initProfileSync } from "./src/services/ProfileSyncService";
import { trackEvent } from "./src/utils/Analytics";
import { registerForPushNotificationsAsync, getExpoPushToken } from "./src/services/NotificationService";

// Start catching uncaught app errors as early as possible
initGlobalErrorHandler();

// Start monitoring internet connectivity to sync pending profile changes
initProfileSync();

const Stack = createNativeStackNavigator();

const AppContent = () => {
  const { currentUser, loading, updateSettings } = useContext(AppContext);

  useEffect(() => {
    async function initPush() {
      const granted = await registerForPushNotificationsAsync();
      if (!granted) return;
      // Get this device's permanent Expo push token and save it to the backend.
      // The backend stores it in MongoDB so push works even when the app is closed.
      const token = await getExpoPushToken();
      if (token) {
        // Store token on the user profile — AppContext will forward it to /api/register-push
        updateSettings({ expoPushToken: token });
      }
    }
    initPush();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  const initialRoute =
    Platform.OS === "web" || currentUser?.isRealUser ? "Home" : "Auth";

  return (
    <SafeAreaProvider>
      <StatusBar style={currentUser?.prefDarkTheme ? "light" : "dark"} />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="Auth" component={AuthScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Conversation" component={ConversationScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
        </Stack.Navigator>
      </NavigationContainer>
      
      {/* Global Admin Popup Announcer */}
      <AppAnnouncerModal />

      {/* Web-only App download promoter (triggers every 2 mins) */}
      <WebPromoModal />
    </SafeAreaProvider>
  );
};

const WebPromoModal = () => {
  if (Platform.OS !== "web") return null;

  const { currentUser } = useContext(AppContext);

  // Do not show the demo popup for Admin or Dev accounts
  const isAdminOrDev =
    currentUser?.email === "admin@gmail.com" ||
    currentUser?.email === "dev@gmail.com" ||
    currentUser?.email === "dev@mail.com" ||
    currentUser?.name === "Admin" ||
    currentUser?.name === "Developer";

  if (isAdminOrDev) return null;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show first time after 30 seconds
    const initialTimer = setTimeout(() => {
      setVisible(true);
      trackEvent("(web) promo_popup_shown", currentUser);
    }, 30000);

    // Show every 40 seconds (40,000ms)
    const intervalTimer = setInterval(() => {
      setVisible(true);
      trackEvent("(web) promo_popup_shown", currentUser);
    }, 40000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, [currentUser]);

  const handleDownload = () => {
    trackEvent("(web) promo_download_click", currentUser);
    Linking.openURL("https://elitestore.keysire.com/app/com.amanikbt1.xaylite");
    setVisible(false);
  };

  const handleClose = () => {
    trackEvent("(web) promo_close_click", currentUser);
    setVisible(false);
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={webModalStyles.overlay}>
        <View style={webModalStyles.container}>
          <Text style={webModalStyles.title}>⚠️ You're Using a Demo</Text>
          <Text style={webModalStyles.message}>
            You're currently using example images and a virtual account. Install the app for a real account and full functionality!
          </Text>
          
          <TouchableOpacity style={webModalStyles.button} onPress={handleDownload} activeOpacity={0.8}>
            <Text style={webModalStyles.buttonText}>Install the App</Text>
          </TouchableOpacity>

          <TouchableOpacity style={webModalStyles.closeButton} onPress={handleClose} activeOpacity={0.7}>
            <Text style={webModalStyles.closeButtonText}>Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
  },
});

const webModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    backgroundColor: "#1E293B",
    padding: 24,
    borderRadius: 20,
    width: "90%",
    maxWidth: 400,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  title: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    color: "#94A3B8",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#4F46E5",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginBottom: 10,
  },
  buttonText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 15,
  },
  closeButton: {
    paddingVertical: 8,
    width: "100%",
    alignItems: "center",
  },
  closeButtonText: {
    color: "#64748B",
    fontSize: 14,
  },
});
