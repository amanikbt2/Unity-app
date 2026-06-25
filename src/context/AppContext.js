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
  micTested: false
};

const LANGS = {
  en: { name: 'English', flag: '🇺🇸', country: 'United States' },
  es: { name: 'Spanish', flag: '🇪🇸', country: 'Spain' },
  fr: { name: 'French', flag: '🇫🇷', country: 'France' },
  sw: { name: 'Swahili', flag: '🇰🇪', country: 'Kenya' },
  ja: { name: 'Japanese', flag: '🇯🇵', country: 'Japan' },
  de: { name: 'German', flag: '🇩🇪', country: 'Germany' },
  zh: { name: 'Chinese', flag: '🇨🇳', country: 'China' }
};

const FLAG_MAP = {
  '🇺🇸': { name: 'English', country: 'United States' },
  '🇪🇸': { name: 'Spanish', country: 'Spain' },
  '🇯🇵': { name: 'Japanese', country: 'Japan' },
  '🇰🇪': { name: 'Swahili', country: 'Kenya' },
  '🇫🇷': { name: 'French', country: 'France' },
  '🇩🇪': { name: 'German', country: 'Germany' },
  '🇨🇳': { name: 'Chinese', country: 'China' }
};

export const AppProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(DEFAULT_USER);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem('amani_profile_settings');
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Error loading config', e);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      const updated = { ...currentUser, ...newSettings };
      setCurrentUser(updated);
      await AsyncStorage.setItem('amani_profile_settings', JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving config', e);
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
