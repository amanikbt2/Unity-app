import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearAllAppData } from '../services/StorageService';
import { Image } from 'react-native';

export const AppContext = createContext();

const DEFAULT_USER = {
  uid: 'UID-000000',
  name: 'Amani User',
  avatar: (Image.resolveAssetSource && Image.resolveAssetSource(require('../../assets/slot1.jpg'))?.uri) || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
  avatarSlots: [
    (Image.resolveAssetSource && Image.resolveAssetSource(require('../../assets/slot1.jpg'))?.uri) || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
    (Image.resolveAssetSource && Image.resolveAssetSource(require('../../assets/slot2.jpg'))?.uri) || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80',
    (Image.resolveAssetSource && Image.resolveAssetSource(require('../../assets/slot3.jpg'))?.uri) || 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&h=150&q=80',
    (Image.resolveAssetSource && Image.resolveAssetSource(require('../../assets/slot4.jpg'))?.uri) || 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=150&h=150&q=80',
  ],
  activeAvatarSlot: 0,
  nativeLang: 'en',
  secondaryLangs: ['es', 'ja'],
  micDevice: 'default',
  prefDarkTheme: false,
  prefAutoTrans: true,
  prefHaptics: true,
  prefVad: false,
  prefShowTranscripts: false,
  micTested: false,
  isRealUser: false,
  email: '',
  phone: '',
  unityAILang: 'es'
};

const LANGS = {
  en: { name: 'English', flag: '🇺🇸', country: 'United States' },
  es: { name: 'Spanish', flag: '🇪🇸', country: 'Spain' },
  fr: { name: 'French', flag: '🇫🇷', country: 'France' },
  sw: { name: 'Swahili', flag: '🇰🇪', country: 'Kenya' },
  ja: { name: 'Japanese', flag: '🇯🇵', country: 'Japan' },
  de: { name: 'German', flag: '🇩🇪', country: 'Germany' },
  zh: { name: 'Chinese', flag: '🇨🇳', country: 'China' },
  ar: { name: 'Arabic', flag: '🇸🇦', country: 'Saudi Arabia' },
  it: { name: 'Italian', flag: '🇮🇹', country: 'Italy' },
  pt: { name: 'Portuguese', flag: '🇧🇷', country: 'Brazil' },
  ru: { name: 'Russian', flag: '🇷🇺', country: 'Russia' },
  ko: { name: 'Korean', flag: '🇰🇷', country: 'South Korea' },
  hi: { name: 'Hindi', flag: '🇮🇳', country: 'India' },
  tr: { name: 'Turkish', flag: '🇹🇷', country: 'Turkey' },
  nl: { name: 'Dutch', flag: '🇳🇱', country: 'Netherlands' },
  pl: { name: 'Polish', flag: '🇵🇱', country: 'Poland' },
  vi: { name: 'Vietnamese', flag: '🇻🇳', country: 'Vietnam' },
  th: { name: 'Thai', flag: '🇹🇭', country: 'Thailand' },
  el: { name: 'Greek', flag: '🇬🇷', country: 'Greece' },
  he: { name: 'Hebrew', flag: '🇮🇱', country: 'Israel' }
};

const FLAG_MAP = {
  '🇺🇸': { name: 'English', country: 'United States' },
  '🇪🇸': { name: 'Spanish', country: 'Spain' },
  '🇯🇵': { name: 'Japanese', country: 'Japan' },
  '🇰🇪': { name: 'Swahili', country: 'Kenya' },
  '🇫🇷': { name: 'French', country: 'France' },
  '🇩🇪': { name: 'German', country: 'Germany' },
  '🇨🇳': { name: 'Chinese', country: 'China' },
  '🇸🇦': { name: 'Arabic', country: 'Saudi Arabia' },
  '🇮🇹': { name: 'Italian', country: 'Italy' },
  '🇧🇷': { name: 'Portuguese', country: 'Brazil' },
  '🇷🇺': { name: 'Russian', country: 'Russia' },
  '🇰🇷': { name: 'Korean', country: 'South Korea' },
  '🇮🇳': { name: 'Hindi', country: 'India' },
  '🇹🇷': { name: 'Turkish', country: 'Turkey' },
  '🇳🇱': { name: 'Dutch', country: 'Netherlands' },
  '🇵🇱': { name: 'Polish', country: 'Poland' },
  '🇻🇳': { name: 'Vietnamese', country: 'Vietnam' },
  '🇹🇭': { name: 'Thai', country: 'Thailand' },
  '🇬🇷': { name: 'Greek', country: 'Greece' },
  '🇮🇱': { name: 'Hebrew', country: 'Israel' }
};

const generateUid = () => 'UID-' + Math.random().toString(36).slice(2, 8).toUpperCase();

export const AppProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(DEFAULT_USER);
  const [savedAccounts, setSavedAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem('amani_profile_settings');
      if (stored) {
        setCurrentUser({ ...DEFAULT_USER, ...JSON.parse(stored) });
      }
      const accounts = await AsyncStorage.getItem('amani_saved_accounts');
      if (accounts) {
        setSavedAccounts(JSON.parse(accounts));
      }
    } catch (e) {
      console.error('Error loading config', e);
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
        const { registerForPushNotificationsAsync } = require('../services/NotificationService');
        const token = await registerForPushNotificationsAsync();
        if (token) {
          updateSettings({ expoPushToken: token });
          try {
            const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";
          await fetch(`${API_URL}/api/register-push`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userKey: 'UID-000000', token }) // Or use currentUser.uid if available inside the scope
            });
          } catch (err) {
            console.error('Failed to register token with backend', err);
          }
        }
      } catch (e) {
        console.error('Push notification setup error:', e);
      }
    };
    initNotifications();

    return () => clearTimeout(timer);
  }, []);

  const updateSettings = async (newSettings) => {
    try {
      const updated = { ...DEFAULT_USER, ...currentUser, ...newSettings, uid: currentUser.uid || DEFAULT_USER.uid || generateUid() };
      setCurrentUser(updated);
      await AsyncStorage.setItem('amani_profile_settings', JSON.stringify(updated));
      
      // If it's a real user, ensure they are in the saved accounts list
      if (updated.isRealUser && updated.email) {
        setSavedAccounts((prevAccounts) => {
          const filtered = prevAccounts.filter((acc) => acc.email !== updated.email);
          const newAccounts = [updated, ...filtered];
          AsyncStorage.setItem('amani_saved_accounts', JSON.stringify(newAccounts)).catch(console.error);
          return newAccounts;
        });
      }
    } catch (e) {
      console.error('Error saving config', e);
    }
  };

  const logoutUser = async () => {
    try {
      // Keep the user in savedAccounts (already handled during updateSettings)
      // Just clear the current active session
      setCurrentUser({ ...DEFAULT_USER, uid: DEFAULT_USER.uid });
      await AsyncStorage.setItem('amani_profile_settings', JSON.stringify(DEFAULT_USER));
    } catch (e) {
      console.error('Error logging out user', e);
    }
  };

  const loginAsSavedProfile = async (profile) => {
    try {
      const mergedProfile = { ...DEFAULT_USER, ...profile, uid: profile.uid || profile.id || profile.email || generateUid() };
      setCurrentUser(mergedProfile);
      await AsyncStorage.setItem('amani_profile_settings', JSON.stringify(mergedProfile));
      
      // Bring this account to the front of the list to indicate most recent
      setSavedAccounts((prevAccounts) => {
        const filtered = prevAccounts.filter((acc) => acc.email !== mergedProfile.email);
        const newAccounts = [mergedProfile, ...filtered];
        AsyncStorage.setItem('amani_saved_accounts', JSON.stringify(newAccounts)).catch(console.error);
        return newAccounts;
      });
    } catch (e) {
      console.error('Error fast-logging in', e);
    }
  };

  const deleteAccountAndResetApp = async () => {
    try {
      await clearAllAppData();
    } catch (e) {
      console.error('Error clearing app data', e);
    } finally {
      setCurrentUser({ ...DEFAULT_USER, uid: DEFAULT_USER.uid });
      setSavedAccounts([]);
      setLoading(false);
    }
  };

  const getLangDetails = (langCode) => {
    return LANGS[langCode] || { name: langCode, flag: '🌍', country: '' };
  };

  const getLangDetailsFromFlag = (flag) => {
    return FLAG_MAP[flag] || { name: 'Unknown', country: '' };
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
        LANGS
      }}
    >
      {children}
    </AppContext.Provider>
  );
};






