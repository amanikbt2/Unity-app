import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AppContext = createContext();

const DEFAULT_USER = {
  name: 'Amani User',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
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
  email: ''
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
    return () => clearTimeout(timer);
  }, []);

  const updateSettings = async (newSettings) => {
    try {
      const updated = { ...DEFAULT_USER, ...currentUser, ...newSettings };
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
      setCurrentUser(DEFAULT_USER);
      await AsyncStorage.setItem('amani_profile_settings', JSON.stringify(DEFAULT_USER));
    } catch (e) {
      console.error('Error logging out user', e);
    }
  };

  const loginAsSavedProfile = async (profile) => {
    try {
      const mergedProfile = { ...DEFAULT_USER, ...profile };
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
