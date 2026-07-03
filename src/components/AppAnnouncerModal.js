import React, { useState, useEffect, useContext } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Linking,
  ScrollView,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppContext } from '../context/AppContext';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import Svg, { X } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

const AppAnnouncerModal = () => {
  const { isDark, colors } = useContext(AppContext);
  const [popup, setPopup] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    fetchLatestPopup();
  }, []);

  const fetchLatestPopup = async () => {
    try {
      let BASE_URL = process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";
      if (Platform.OS !== "web" && BASE_URL.includes("localhost") && Constants.expoConfig?.hostUri) {
        const hostIp = Constants.expoConfig.hostUri.split(":")[0];
        BASE_URL = `http://${hostIp}:3000`;
      }

      const response = await fetch(`${BASE_URL}/api/admin/popups`);
      if (!response.ok) return;

      const data = await response.json();
      if (data.success && data.popups && data.popups.length > 0) {
        const latestPopup = data.popups[0]; // First is newest due to sorting on backend
        
        // Check if user has already seen this specific popup ID
        const seenStatus = await AsyncStorage.getItem(`@seen_popup_${latestPopup.id}`);
        if (!seenStatus) {
          setPopup(latestPopup);
          setTimeout(() => setVisible(true), 1500); // Small delay so it pops up nicely after load
        }
      }
    } catch (error) {
      console.warn("Failed to fetch app popups:", error.message);
    }
  };

  const handleDismiss = async () => {
    if (popup?.id) {
      await AsyncStorage.setItem(`@seen_popup_${popup.id}`, 'true');
    }
    setVisible(false);
  };

  const handleAction = async (url) => {
    if (url) {
      try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        }
      } catch (err) {
        console.error("Failed to open URL:", err);
      }
    }
    // Dismiss after action
    handleDismiss();
  };

  if (!popup) return null;

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={() => {
        if (!popup.isImportant) handleDismiss();
      }}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          
          {/* Header Image */}
          {popup.imageUrl ? (
            <Image 
              source={{ uri: popup.imageUrl }} 
              style={styles.headerImage} 
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={[colors.primary, colors.accent || '#06B6D4']}
              style={styles.gradientHeader}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          )}

          {/* Close Button (Hidden if isImportant) */}
          {!popup.isImportant && (
            <TouchableOpacity 
              style={styles.closeBtn} 
              onPress={handleDismiss}
              activeOpacity={0.7}
            >
              <View style={[styles.closeCircle, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <X />
                </Svg>
              </View>
            </TouchableOpacity>
          )}

          {/* Content */}
          <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
            {popup.subtopic ? (
              <Text style={[styles.subtopic, { color: colors.primary }]}>{popup.subtopic.toUpperCase()}</Text>
            ) : null}
            
            <Text style={[styles.title, { color: colors.text }]}>{popup.title}</Text>
            
            <Text style={[styles.bodyText, { color: colors.textMuted }]}>
              {popup.text}
            </Text>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            {popup.actions && popup.actions.length > 0 ? (
              popup.actions.map((action, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.actionBtn, 
                    { backgroundColor: idx === 0 ? colors.primary : colors.cardBg, borderColor: idx === 0 ? colors.primary : colors.border }
                  ]}
                  onPress={() => handleAction(action.url)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.actionText, { color: idx === 0 ? '#FFFFFF' : colors.text }]}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={handleDismiss}
                activeOpacity={0.8}
              >
                <Text style={styles.actionText}>Got it!</Text>
              </TouchableOpacity>
            )}
          </View>
          
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    maxHeight: height * 0.8,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  headerImage: {
    width: '100%',
    height: 180,
  },
  gradientHeader: {
    width: '100%',
    height: 100,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
  },
  closeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    padding: 24,
    maxHeight: 300,
  },
  subtopic: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'sans-serif-medium',
  },
  bodyText: {
    fontSize: 16,
    lineHeight: 24,
  },
  actionsContainer: {
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  actionBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '700',
  }
});

export default AppAnnouncerModal;
