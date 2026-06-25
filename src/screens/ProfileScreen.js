import React, { useContext, useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Switch,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Line } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing
} from 'react-native-reanimated';
import { AppContext } from '../context/AppContext';

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&h=150&q=80',
  'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=150&h=150&q=80'
];

export default function ProfileScreen({ navigation }) {
  const { currentUser, updateSettings, LANGS } = useContext(AppContext);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'idle'
  const [isMicTesting, setIsMicTesting] = useState(false);
  const [name, setName] = useState(currentUser.name);

  // Microphone wave bar values
  const bar1Scale = useSharedValue(1);
  const bar2Scale = useSharedValue(1);
  const bar3Scale = useSharedValue(1);
  const bar4Scale = useSharedValue(1);
  const bar5Scale = useSharedValue(1);

  // Initialize micro test animation loop
  useEffect(() => {
    if (isMicTesting) {
      const timingOptions = { duration: 400, easing: Easing.ease };
      bar1Scale.value = withRepeat(withSequence(withTiming(3.0, timingOptions), withTiming(1.0, timingOptions)), -1, true);
      bar2Scale.value = withRepeat(withSequence(withTiming(3.6, timingOptions), withTiming(1.0, timingOptions)), -1, true);
      bar3Scale.value = withRepeat(withSequence(withTiming(2.0, timingOptions), withTiming(1.0, timingOptions)), -1, true);
      bar4Scale.value = withRepeat(withSequence(withTiming(3.3, timingOptions), withTiming(1.0, timingOptions)), -1, true);
      bar5Scale.value = withRepeat(withSequence(withTiming(1.8, timingOptions), withTiming(1.0, timingOptions)), -1, true);
    } else {
      bar1Scale.value = withTiming(1.0);
      bar2Scale.value = withTiming(1.0);
      bar3Scale.value = withTiming(1.0);
      bar4Scale.value = withTiming(1.0);
      bar5Scale.value = withTiming(1.0);
    }
  }, [isMicTesting]);

  const animatedBar1 = useAnimatedStyle(() => ({ transform: [{ scaleY: bar1Scale.value }] }));
  const animatedBar2 = useAnimatedStyle(() => ({ transform: [{ scaleY: bar2Scale.value }] }));
  const animatedBar3 = useAnimatedStyle(() => ({ transform: [{ scaleY: bar3Scale.value }] }));
  const animatedBar4 = useAnimatedStyle(() => ({ transform: [{ scaleY: bar4Scale.value }] }));
  const animatedBar5 = useAnimatedStyle(() => ({ transform: [{ scaleY: bar5Scale.value }] }));

  // Auto-saving configuration
  const handleAutoSave = (newSettings) => {
    setSaveStatus('saving');
    updateSettings(newSettings);
    setTimeout(() => {
      setSaveStatus('saved');
    }, 800);
  };

  const handleNameChange = (val) => {
    setName(val);
    handleAutoSave({ name: val });
  };

  const selectAvatar = (url) => {
    handleAutoSave({ avatar: url });
  };

  const selectNativeLang = (code) => {
    handleAutoSave({ nativeLang: code });
  };

  const toggleSecondaryLang = (code) => {
    const list = [...currentUser.secondaryLangs];
    const index = list.indexOf(code);
    if (index > -1) {
      list.splice(index, 1);
    } else {
      list.push(code);
    }
    handleAutoSave({ secondaryLangs: list });
  };

  const selectMic = (device) => {
    handleAutoSave({ micDevice: device });
  };

  const handleTogglePref = (key) => {
    handleAutoSave({ [key]: !currentUser[key] });
  };

  const toggleMicTest = () => {
    if (isMicTesting) {
      setIsMicTesting(false);
    } else {
      setIsMicTesting(true);
      handleAutoSave({ micTested: true });
      setTimeout(() => {
        setIsMicTesting(false);
      }, 4000); // Stop automatically after 4s
    }
  };

  const isDark = currentUser.prefDarkTheme;
  const colors = {
    bg: isDark ? '#0A0612' : '#F8FAFC',
    cardBg: isDark ? '#120C24' : '#FFFFFF',
    border: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.05)',
    text: isDark ? '#F3F4F6' : '#0F172A',
    textMuted: isDark ? '#9CA3AF' : '#475569',
    textDimmed: isDark ? '#6B7280' : '#64748B',
    primary: isDark ? '#8B5CF6' : '#4F46E5',
    primaryGlow: isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(79, 70, 229, 0.08)',
    accent: isDark ? '#06B6D4' : '#0284C7',
    success: isDark ? '#10B981' : '#16A34A',
    danger: isDark ? '#EF4444' : '#E11D48',
    warning: isDark ? '#F59E0B' : '#D97706'
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header bar with auto save indicators */}
      <SafeAreaView
        style={[
          styles.headerSafeArea,
          { backgroundColor: colors.cardBg, borderBottomWidth: 1, borderBottomColor: colors.border }
        ]}
        edges={['top', 'left', 'right']}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.closeBtn}>
            <Text style={[styles.closeBtnText, { color: colors.text }]}>&times;</Text>
          </TouchableOpacity>

          <Text style={[styles.title, { color: colors.text }]}>Profile Settings</Text>

          {/* Autosave pill notification */}
          <View
            style={[
              styles.saveIndicator,
              saveStatus === 'saving'
                ? { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.25)' }
                : { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.25)' }
            ]}
          >
            <View style={[styles.saveDot, { backgroundColor: saveStatus === 'saving' ? colors.warning : colors.success }]} />
            <Text style={[styles.saveText, { color: saveStatus === 'saving' ? colors.warning : colors.success }]}>
              {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Avatar presets selector */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatarPreviewContainer, { backgroundColor: colors.primary }]}>
            <Image source={{ uri: currentUser.avatar }} style={[styles.avatarPreview, { borderColor: colors.cardBg }]} />
          </View>
          <View style={styles.presetsWrapper}>
            {AVATAR_PRESETS.map((preset, idx) => {
              const isSelected = currentUser.avatar === preset;
              return (
                <TouchableOpacity key={idx} onPress={() => selectAvatar(preset)} activeOpacity={0.7}>
                  <Image
                    source={{ uri: preset }}
                    style={[
                      styles.presetItem,
                      isSelected ? { borderColor: colors.primary, transform: [{ scale: 1.08 }] } : { borderColor: 'transparent' }
                    ]}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Display Name</Text>
          <TextInput
            style={[styles.inputField, { backgroundColor: colors.cardBg, color: colors.text, borderColor: colors.border }]}
            placeholder="Enter display name"
            placeholderTextColor={colors.textDimmed}
            value={name}
            onChangeText={handleNameChange}
          />
        </View>

        {/* Native language picker dropdown list */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Native Language</Text>
          <View style={styles.langPills}>
            {Object.keys(LANGS).map((code) => {
              const lang = LANGS[code];
              const isSelected = currentUser.nativeLang === code;
              return (
                <TouchableOpacity
                  key={code}
                  style={[
                    styles.pillItem,
                    isSelected
                      ? { backgroundColor: colors.primaryGlow, borderColor: colors.primary }
                      : { backgroundColor: colors.cardBg, borderColor: colors.border }
                  ]}
                  onPress={() => selectNativeLang(code)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pillText, isSelected ? { color: colors.primary, fontWeight: '600' } : { color: colors.textMuted }]}>
                    {lang.flag} {lang.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Secondary target languages checkbox checklist */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Secondary Languages (To Translate)</Text>
          <View style={styles.langPills}>
            {Object.keys(LANGS).map((code) => {
              const lang = LANGS[code];
              const isChecked = currentUser.secondaryLangs.includes(code);
              return (
                <TouchableOpacity
                  key={code}
                  style={[
                    styles.pillItem,
                    isChecked
                      ? { backgroundColor: colors.primaryGlow, borderColor: colors.primary }
                      : { backgroundColor: colors.cardBg, borderColor: colors.border }
                  ]}
                  onPress={() => toggleSecondaryLang(code)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pillText, isChecked ? { color: colors.primary, fontWeight: '600' } : { color: colors.textMuted }]}>
                    {isChecked ? '✓ ' : ''}{lang.flag} {lang.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Microphone Setup */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Voice & Microphone Setup</Text>
          <View style={styles.micOptions}>
            {['default', 'headset', 'internal'].map((device) => {
              const isSelected = currentUser.micDevice === device;
              const label = device === 'default' ? 'Default Microphone' : device === 'headset' ? 'Bluetooth Headset' : 'Built-in Stereo';
              return (
                <TouchableOpacity
                  key={device}
                  style={[
                    styles.micOptionBtn,
                    isSelected
                      ? { backgroundColor: colors.primaryGlow, borderColor: colors.primary }
                      : { backgroundColor: colors.cardBg, borderColor: colors.border }
                  ]}
                  onPress={() => selectMic(device)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.micOptionText, isSelected ? { color: colors.primary, fontWeight: '600' } : { color: colors.textMuted }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Test mic with Reanimated wave bars */}
          <View style={styles.micTestRow}>
            <TouchableOpacity
              style={[
                styles.testMicBtn,
                isMicTesting
                  ? { backgroundColor: colors.danger }
                  : { backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1 }
              ]}
              onPress={toggleMicTest}
              activeOpacity={0.75}
            >
              <Text style={[styles.testMicText, isMicTesting ? { color: 'white' } : { color: colors.textMuted }]}>
                {isMicTesting ? 'Stop Testing' : 'Test Microphone'}
              </Text>
            </TouchableOpacity>

            {isMicTesting && (
              <View style={styles.waveBarContainer}>
                <Animated.View style={[styles.waveBar, { backgroundColor: colors.accent }, animatedBar1]} />
                <Animated.View style={[styles.waveBar, { backgroundColor: colors.accent }, animatedBar2]} />
                <Animated.View style={[styles.waveBar, { backgroundColor: colors.accent }, animatedBar3]} />
                <Animated.View style={[styles.waveBar, { backgroundColor: colors.accent }, animatedBar4]} />
                <Animated.View style={[styles.waveBar, { backgroundColor: colors.accent }, animatedBar5]} />
              </View>
            )}
          </View>
        </View>

        {/* Preferences / Toggles list */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Preferences</Text>
          <View style={[styles.toggleList, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <View style={[styles.toggleItem, { borderBottomColor: colors.border }]}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>Dark Theme Mode</Text>
              <Switch
                value={currentUser.prefDarkTheme}
                onValueChange={() => handleTogglePref('prefDarkTheme')}
                trackColor={{ false: 'rgba(0,0,0,0.1)', true: colors.primary }}
              />
            </View>

            <View style={[styles.toggleItem, { borderBottomColor: colors.border }]}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>Auto-translate Incoming Voice</Text>
              <Switch
                value={currentUser.prefAutoTrans}
                onValueChange={() => handleTogglePref('prefAutoTrans')}
                trackColor={{ false: 'rgba(0,0,0,0.1)', true: colors.primary }}
              />
            </View>

            <View style={[styles.toggleItem, { borderBottomColor: colors.border }]}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>Haptic Feedback on Mic Activation</Text>
              <Switch
                value={currentUser.prefHaptics}
                onValueChange={() => handleTogglePref('prefHaptics')}
                trackColor={{ false: 'rgba(0,0,0,0.1)', true: colors.primary }}
              />
            </View>

            <View style={[styles.toggleItem, { borderBottomColor: colors.border }]}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>Voice Activation Detection (VAD)</Text>
              <Switch
                value={currentUser.prefVad}
                onValueChange={() => handleTogglePref('prefVad')}
                trackColor={{ false: 'rgba(0,0,0,0.1)', true: colors.primary }}
              />
            </View>

            <View style={styles.toggleItem}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>Enable Chat Text Transcripts</Text>
              <Switch
                value={currentUser.prefShowTranscripts}
                onValueChange={() => handleTogglePref('prefShowTranscripts')}
                trackColor={{ false: 'rgba(0,0,0,0.1)', true: colors.primary }}
              />
            </View>
          </View>
        </View>

        <Text style={[styles.footerText, { color: colors.success }]}>
          All changes are saved automatically
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  headerSafeArea: {
    width: '100%'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  closeBtn: {
    padding: 4
  },
  closeBtnText: {
    fontSize: 28,
    lineHeight: 28
  },
  title: {
    fontSize: 18,
    fontWeight: '700'
  },
  saveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1
  },
  saveDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  saveText: {
    fontSize: 11,
    fontWeight: '600'
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 48
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24
  },
  avatarPreviewContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    padding: 3,
    marginBottom: 16
  },
  avatarPreview: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 42,
    borderWidth: 3
  },
  presetsWrapper: {
    flexDirection: 'row',
    gap: 12
  },
  presetItem: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2
  },
  formGroup: {
    marginBottom: 24,
    gap: 8
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  inputField: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15
  },
  langPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  pillItem: {
    borderWidth: 1,
    borderRadius: 30,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500'
  },
  micOptions: {
    gap: 8
  },
  micOptionBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16
  },
  micOptionText: {
    fontSize: 14
  },
  micTestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 4
  },
  testMicBtn: {
    height: 38,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center'
  },
  testMicText: {
    fontSize: 13,
    fontWeight: '600'
  },
  waveBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 24
  },
  waveBar: {
    width: 3,
    height: 6,
    borderRadius: 2
  },
  toggleList: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    overflow: 'hidden'
  },
  toggleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500'
  },
  footerText: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8
  }
});
