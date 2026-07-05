import React, { useState, useEffect, useContext, useRef } from 'react';
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
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppContext } from '../context/AppContext';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import Svg, { Path } from 'react-native-svg';
import customJson from '../customJson.json';

const { width, height } = Dimensions.get('window');

const AppAnnouncerModal = () => {
  const { currentUser } = useContext(AppContext);
  const isDark = currentUser?.prefDarkTheme || false;
  const themeColors = {
    bg: isDark ? "#0A0612" : "#F8FAFC",
    cardBg: isDark ? "#120C24" : "#FFFFFF",
    border: isDark ? "rgba(255, 255, 255, 0.07)" : "rgba(0, 0, 0, 0.05)",
    text: isDark ? "#F3F4F6" : "#0F172A",
    textMuted: isDark ? "#9CA3AF" : "#475569",
    textDimmed: isDark ? "#6B7280" : "#64748B",
    accent: isDark ? "#06B6D4" : "#0284C7",
    primary: isDark ? "#8B5CF6" : "#4F46E5",
    primaryGlow: isDark ? "rgba(139, 92, 246, 0.15)" : "rgba(79, 70, 229, 0.08)",
    headerBg: isDark ? "rgba(10, 6, 18, 0.85)" : "rgba(241, 245, 249, 0.95)",
  };
  const [popup, setPopup] = useState(null);
  const [visible, setVisible] = useState(false);
  const [formAnswers, setFormAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const baseurlRef = useRef('');

  const fetchLatestPopup = async () => {
    try {
      let BASE_URL = process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";
      if (Platform.OS !== "web" && BASE_URL.includes("localhost") && Constants.expoConfig?.hostUri) {
        const hostIp = Constants.expoConfig.hostUri.split(":")[0];
        BASE_URL = `http://${hostIp}:3000`;
      }
      baseurlRef.current = BASE_URL;

      const response = await fetch(`${BASE_URL}/api/admin/popups?appVersion=${customJson.version}`);
      if (!response.ok) return;

      const data = await response.json();
      if (data.success && data.popups && data.popups.length > 0) {
        const latestPopup = data.popups[0]; // First is newest due to sorting on backend
        
        // Check if user has already seen this specific popup ID
        const seenStatus = await AsyncStorage.getItem(`@seen_popup_${latestPopup.id}`);
        if (!seenStatus) {
          setPopup(latestPopup);
          setFormAnswers({});
          setSubmitted(false);
          setTimeout(() => setVisible(true), 1500); // Small delay so it pops up nicely after load
        }
      }
    } catch (error) {
      console.warn("Failed to fetch app popups:", error.message);
    }
  };

  useEffect(() => {
    fetchLatestPopup();
  }, []);

  const handleDismiss = async () => {
    if (popup?.id) {
      await AsyncStorage.setItem(`@seen_popup_${popup.id}`, 'true');
    }
    setVisible(false);
  };

  // Replace {name} placeholder with user's name or 'User' as fallback
  const interpolate = (str) => {
    if (!str) return '';
    const name = currentUser?.username || currentUser?.displayName || currentUser?.name || 'User';
    return str.replace(/\{name\}/gi, name);
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

  const handleInteractiveSubmit = async () => {
    if (!popup) return;
    setSubmitting(true);
    try {
      const BASE_URL = baseurlRef.current || process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";
      const userName = currentUser?.username || currentUser?.displayName || currentUser?.name || 'xayLiteUser';
      await fetch(`${BASE_URL}/api/popups/${popup.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName,
          appVersion: customJson.version,
          replyData: formAnswers,
        }),
      });
    } catch (e) {
      console.warn('Failed to submit reply:', e.message);
    } finally {
      setSubmitting(false);
      setSubmitted(true);
      // Mark as seen and dismiss after a moment
      setTimeout(() => handleDismiss(), 1500);
    }
  };

  if (!popup) return null;

  // Render a single interactive form field
  const renderFormField = (field, idx) => {
    const key = field.label;
    const value = formAnswers[key];

    if (field.type === 'text') {
      return (
        <View key={idx} style={styles.fieldWrapper}>
          <Text style={[styles.fieldLabel, { color: themeColors.textMuted }]}>{interpolate(field.label)}{field.required ? ' *' : ''}</Text>
          <TextInput
            style={[styles.textInput, { color: themeColors.text, borderColor: themeColors.border, backgroundColor: themeColors.bg }]}
            placeholder="Your answer..."
            placeholderTextColor={themeColors.textDimmed}
            value={value || ''}
            onChangeText={(v) => setFormAnswers(prev => ({ ...prev, [key]: v }))}
            multiline
          />
        </View>
      );
    }

    if (field.type === 'checkbox') {
      const checked = value === true;
      return (
        <TouchableOpacity key={idx} style={styles.fieldWrapper} onPress={() => setFormAnswers(prev => ({ ...prev, [key]: !checked }))} activeOpacity={0.7}>
          <View style={styles.checkRow}>
            <View style={[styles.checkBox, { borderColor: themeColors.primary, backgroundColor: checked ? themeColors.primary : 'transparent' }]}>
              {checked && <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><Path d="M20 6L9 17l-5-5" /></Svg>}
            </View>
            <Text style={[styles.checkLabel, { color: themeColors.text }]}>{interpolate(field.label)}{field.required ? ' *' : ''}</Text>
          </View>
        </TouchableOpacity>
      );
    }

    if (field.type === 'radio' && field.options?.length > 0) {
      return (
        <View key={idx} style={styles.fieldWrapper}>
          <Text style={[styles.fieldLabel, { color: themeColors.textMuted }]}>{interpolate(field.label)}{field.required ? ' *' : ''}</Text>
          {field.options.map((opt, oi) => (
            <TouchableOpacity key={oi} style={styles.checkRow} onPress={() => setFormAnswers(prev => ({ ...prev, [key]: opt }))} activeOpacity={0.7}>
              <View style={[styles.radioCircle, { borderColor: themeColors.primary }]}>
                {value === opt && <View style={[styles.radioDot, { backgroundColor: themeColors.primary }]} />}
              </View>
              <Text style={[styles.checkLabel, { color: themeColors.text }]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    if (field.type === 'select' && field.options?.length > 0) {
      return (
        <View key={idx} style={styles.fieldWrapper}>
          <Text style={[styles.fieldLabel, { color: themeColors.textMuted }]}>{interpolate(field.label)}{field.required ? ' *' : ''}</Text>
          <View style={styles.selectContainer}>
            {field.options.map((opt, oi) => (
              <TouchableOpacity
                key={oi}
                onPress={() => setFormAnswers(prev => ({ ...prev, [key]: opt }))}
                style={[
                  styles.selectOption,
                  { borderColor: value === opt ? themeColors.primary : themeColors.border,
                    backgroundColor: value === opt ? themeColors.primaryGlow : 'transparent' }
                ]}
                activeOpacity={0.7}
              >
                <Text style={[styles.selectOptionText, { color: value === opt ? themeColors.primary : themeColors.text }]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }

    return null;
  };

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
        <View style={[styles.modalContainer, { backgroundColor: themeColors.cardBg, borderColor: themeColors.border }]}>
          
          {/* Header Image */}
          {popup.imageUrl ? (
            <Image 
              source={{ uri: popup.imageUrl }} 
              style={styles.headerImage} 
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={[themeColors.primary, themeColors.accent || '#06B6D4']}
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
                  <Path d="M18 6L6 18M6 6l12 12" />
                </Svg>
              </View>
            </TouchableOpacity>
          )}

          {/* Content */}
          <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
            {popup.subtopic ? (
              <Text style={[styles.subtopic, { color: themeColors.primary }]}>{interpolate(popup.subtopic).toUpperCase()}</Text>
            ) : null}
            
            <Text style={[styles.title, { color: themeColors.text }]}>{interpolate(popup.title)}</Text>
            
            <Text style={[styles.bodyText, { color: themeColors.textMuted }]}>
              {interpolate(popup.text)}
            </Text>

            {/* Interactive Form Fields */}
            {popup.isInteractive && popup.formFields?.length > 0 && !submitted && (
              <View style={styles.formContainer}>
                {popup.formFields.map((field, idx) => renderFormField(field, idx))}
              </View>
            )}

            {/* Submitted confirmation */}
            {submitted && (
              <View style={styles.submittedBox}>
                <Text style={[styles.submittedText, { color: themeColors.primary }]}>✓ Response submitted!</Text>
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            {popup.isInteractive ? (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: themeColors.primary, borderColor: themeColors.primary, opacity: submitting ? 0.6 : 1 }]}
                onPress={handleInteractiveSubmit}
                disabled={submitting || submitted}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.actionText}>{submitted ? 'Submitted!' : (popup.submitBtnText || 'Submit')}</Text>
                )}
              </TouchableOpacity>
            ) : popup.actions && popup.actions.length > 0 ? (
              popup.actions.map((action, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.actionBtn, 
                    { backgroundColor: idx === 0 ? themeColors.primary : themeColors.cardBg, borderColor: idx === 0 ? themeColors.primary : themeColors.border }
                  ]}
                  onPress={() => handleAction(action.url)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.actionText, { color: idx === 0 ? '#FFFFFF' : themeColors.text }]}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}
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
    color: '#FFFFFF',
  },
  // Interactive Form Styles
  formContainer: {
    marginTop: 16,
    gap: 14,
  },
  fieldWrapper: {
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 44,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkLabel: {
    fontSize: 14,
    flex: 1,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  selectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  selectOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  submittedBox: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  submittedText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

export default AppAnnouncerModal;
