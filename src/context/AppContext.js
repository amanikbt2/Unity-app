import React, { createContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearAllAppData } from "../services/StorageService";
import { Image } from "react-native";
import { queueProfileSync } from "../services/ProfileSyncService";

export const AppContext = createContext();

const getAssetUri = (asset) =>
  Image.resolveAssetSource ? Image.resolveAssetSource(asset).uri : asset;

const DEFAULT_AVATARS_LIST = [
  require("../../assets/default-avatar-1.jpg"),
  require("../../assets/default-avatar-2.jpg"),
  require("../../assets/default-avatar-3.jpg"),
];

const randomAvatarReq = DEFAULT_AVATARS_LIST[Math.floor(Math.random() * DEFAULT_AVATARS_LIST.length)];

const DEFAULT_USER = {
  uid: "UID-000000",
  name: "Amani User",
  avatar: getAssetUri(randomAvatarReq),
  avatarSlots: [
    getAssetUri(DEFAULT_AVATARS_LIST[0]),
    getAssetUri(DEFAULT_AVATARS_LIST[1]),
    getAssetUri(DEFAULT_AVATARS_LIST[2]),
    getAssetUri(DEFAULT_AVATARS_LIST[0]),
  ],
  activeAvatarSlot: 0,
  nativeLang: "en",
  secondaryLangs: ["es", "ja"],
  micDevice: "default",
  prefDarkTheme: false,
  prefAutoTrans: true,
  prefHaptics: true,
  prefVad: false,
  prefShowTranscripts: false,
  micTested: false,
  isRealUser: false,
  email: "",
  phone: "",
  gender: "",
  unityAILang: "es",
};

const LANGS = {
  en: { name: "English", flag: "🇺🇸", country: "United States" },
  es: { name: "Spanish", flag: "🇪🇸", country: "Spain" },
  fr: { name: "French", flag: "🇫🇷", country: "France" },
  sw: { name: "Swahili", flag: "🇰🇪", country: "Kenya" },
  ja: { name: "Japanese", flag: "🇯🇵", country: "Japan" },
  de: { name: "German", flag: "🇩🇪", country: "Germany" },
  zh: { name: "Chinese", flag: "🇨🇳", country: "China" },
  ar: { name: "Arabic", flag: "🇸🇦", country: "Saudi Arabia" },
  it: { name: "Italian", flag: "🇮🇹", country: "Italy" },
  pt: { name: "Portuguese", flag: "🇧🇷", country: "Brazil" },
  ru: { name: "Russian", flag: "🇷🇺", country: "Russia" },
  ko: { name: "Korean", flag: "🇰🇷", country: "South Korea" },
  hi: { name: "Hindi", flag: "🇮🇳", country: "India" },
  tr: { name: "Turkish", flag: "🇹🇷", country: "Turkey" },
  nl: { name: "Dutch", flag: "🇳🇱", country: "Netherlands" },
  pl: { name: "Polish", flag: "🇵🇱", country: "Poland" },
  vi: { name: "Vietnamese", flag: "🇻🇳", country: "Vietnam" },
  th: { name: "Thai", flag: "🇹🇭", country: "Thailand" },
  el: { name: "Greek", flag: "🇬🇷", country: "Greece" },
  he: { name: "Hebrew", flag: "🇮🇱", country: "Israel" },
};

const FLAG_MAP = {
  "🇺🇸": { name: "English", country: "United States" },
  "🇪🇸": { name: "Spanish", country: "Spain" },
  "🇯🇵": { name: "Japanese", country: "Japan" },
  "🇰🇪": { name: "Swahili", country: "Kenya" },
  "🇫🇷": { name: "French", country: "France" },
  "🇩🇪": { name: "German", country: "Germany" },
  "🇨🇳": { name: "Chinese", country: "China" },
  "🇸🇦": { name: "Arabic", country: "Saudi Arabia" },
  "🇮🇹": { name: "Italian", country: "Italy" },
  "🇧🇷": { name: "Portuguese", country: "Brazil" },
  "🇷🇺": { name: "Russian", country: "Russia" },
  "🇰🇷": { name: "Korean", country: "South Korea" },
  "🇮🇳": { name: "Hindi", country: "India" },
  "🇹🇷": { name: "Turkish", country: "Turkey" },
  "🇳🇱": { name: "Dutch", country: "Netherlands" },
  "🇵🇱": { name: "Polish", country: "Poland" },
  "🇻🇳": { name: "Vietnamese", country: "Vietnam" },
  "🇹🇭": { name: "Thai", country: "Thailand" },
  "🇬🇷": { name: "Greek", country: "Greece" },
  "🇮🇱": { name: "Hebrew", country: "Israel" },
};

const generateUid = () =>
  "UID-" + Math.random().toString(36).slice(2, 8).toUpperCase();

export const AppProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(DEFAULT_USER);
  const [savedAccounts, setSavedAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem("amani_profile_settings");
      if (stored) {
        setCurrentUser({ ...DEFAULT_USER, ...JSON.parse(stored) });
      }
      const accounts = await AsyncStorage.getItem("amani_saved_accounts");
      if (accounts) {
        setSavedAccounts(JSON.parse(accounts));
      }
    } catch (e) {
      console.error("Error loading config", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSettings();
    }, 0);

    const initNotifications = async () => {
      try {
        const {
          registerForPushNotificationsAsync,
        } = require("../services/NotificationService");
        const token = await registerForPushNotificationsAsync();
        if (token) {
          // updateSettings is declared above (moved) so it's safe to call here
          updateSettings({ expoPushToken: token });
          try {
            const API_URL =
              process.env.EXPO_PUBLIC_API_URL ||
              "https://unity-3xc2.onrender.com";
            await fetch(`${API_URL}/api/register-push`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userKey: "UID-000000", token }),
            });
          } catch (err) {
            console.error("Failed to register token with backend", err);
          }
        }
      } catch (e) {
        console.error("Push notification setup error:", e);
      }
    };
    initNotifications();

    return () => clearTimeout(timer);
  }, []);

  const updateSettings = async (newSettings) => {
    try {
      const updated = {
        ...DEFAULT_USER,
        ...currentUser,
        ...newSettings,
        uid: currentUser.uid || DEFAULT_USER.uid || generateUid(),
      };
      setCurrentUser(updated);
      await AsyncStorage.setItem(
        "amani_profile_settings",
        JSON.stringify(updated),
      );

      // If it's a real user, ensure they are in the saved accounts list
      if (updated.isRealUser && updated.email) {
        setSavedAccounts((prevAccounts) => {
          const filtered = prevAccounts.filter(
            (acc) => acc.email !== updated.email,
          );
          const newAccounts = [updated, ...filtered];
          AsyncStorage.setItem(
            "amani_saved_accounts",
            JSON.stringify(newAccounts),
          ).catch(console.error);
          return newAccounts;
        });
      }

      // Sync profile details to the cloud globally
      if (updated.isRealUser) {
        const langCode = updated.nativeLang || "en";
        const details = getLangDetails(langCode);
        const flag = details.flag || "🇺🇸";
        const langName = details.name || "English";

        const profileData = {
          uid: updated.uid,
          name: updated.name,
          avatar: updated.avatar,
          flag: flag,
          langName: langName,
          bio: updated.bio || "Available on Unity",
          email: updated.email || "guest",
          activeAvatarSlot: updated.activeAvatarSlot || 0,
        };

        queueProfileSync("save", profileData).catch((err) =>
          console.warn("[AppContext] Profile sync queue failed:", err),
        );
      }
    } catch (e) {
      console.error("Error saving config", e);
    }
  };

  const logoutUser = async () => {
    try {
      // Keep the user in savedAccounts (already handled during updateSettings)
      // Just clear the current active session
      setCurrentUser({ ...DEFAULT_USER, uid: DEFAULT_USER.uid });
      await AsyncStorage.setItem(
        "amani_profile_settings",
        JSON.stringify(DEFAULT_USER),
      );
    } catch (e) {
      console.error("Error logging out user", e);
    }
  };

  const loginAsSavedProfile = async (profile) => {
    try {
      const mergedProfile = {
        ...DEFAULT_USER,
        ...profile,
        uid: profile.uid || profile.id || profile.email || generateUid(),
      };
      setCurrentUser(mergedProfile);
      await AsyncStorage.setItem(
        "amani_profile_settings",
        JSON.stringify(mergedProfile),
      );

      // Bring this account to the front of the list to indicate most recent
      setSavedAccounts((prevAccounts) => {
        const filtered = prevAccounts.filter(
          (acc) => acc.email !== mergedProfile.email,
        );
        const newAccounts = [mergedProfile, ...filtered];
        AsyncStorage.setItem(
          "amani_saved_accounts",
          JSON.stringify(newAccounts),
        ).catch(console.error);
        return newAccounts;
      });
    } catch (e) {
      console.error("Error fast-logging in", e);
    }
  };

  const deleteAccountAndResetApp = async () => {
    try {
      const userUid = currentUser?.uid;
      if (userUid && currentUser?.isRealUser) {
        queueProfileSync("delete", { uid: userUid }).catch((err) =>
          console.warn("[AppContext] Global profile deletion queue failed:", err),
        );
      }
      await clearAllAppData();
    } catch (e) {
      console.error("Error clearing app data", e);
    } finally {
      setCurrentUser({ ...DEFAULT_USER, uid: DEFAULT_USER.uid });
      setSavedAccounts([]);
      setLoading(false);
    }
  };

  const getLangDetails = (langCode) => {
    return LANGS[langCode] || { name: langCode, flag: "🌍", country: "" };
  };

  const getLangDetailsFromFlag = (flag) => {
    return FLAG_MAP[flag] || { name: "Unknown", country: "" };
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        updateSettings,
        logoutUser,
        loginAsSavedProfile,
        deleteAccountAndResetApp,
        savedAccounts,
        getLangDetails,
        getLangDetailsFromFlag,
        loading,
        DEFAULT_USER,
        LANGS,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
