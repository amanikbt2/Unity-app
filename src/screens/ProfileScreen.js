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
  ActivityIndicator,
  Modal,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Line } from 'react-native-svg';
import { AppContext } from '../context/AppContext';

const { width, height } = Dimensions.get('window');

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&h=150&q=80',
  'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=150&h=150&q=80'
];

export default function ProfileScreen({ navigation }) {
  const { currentUser, updateSettings, LANGS } = useContext(AppContext);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'idle'
  const [name, setName] = useState(currentUser.name);

  // Modal Visibility states
  const [isNativeLangModalVisible, setIsNativeLangModalVisible] = useState(false);
  const [isSecondaryLangModalVisible, setIsSecondaryLangModalVisible] = useState(false);
  const [isTrainingModalVisible, setIsTrainingModalVisible] = useState(false);
  const [isTestingModalVisible, setIsTestingModalVisible] = useState(false);

  // Voice AI Training state
  const [trainingStep, setTrainingStep] = useState(0);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  // Voice AI Testing state
  const [playingLang, setPlayingLang] = useState(null);
  const [playProgress, setPlayProgress] = useState(0);

  // Microphone level test state
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  const trainingSentences = [
    "The quick brown fox jumps over the lazy dog.",
    "Unity translates my voice instantly to any language in real-time.",
    "Global communication is now seamless and natural for everyone."
  ];

  // Fluctuating volume meter logic (horizontal boxed progress bar)
  useEffect(() => {
    let interval;
    if (isTestingMic) {
      interval = setInterval(() => {
        const raw = Math.random();
        let level;
        if (raw < 0.2) level = Math.floor(Math.random() * 4); // 0 to 3
        else if (raw < 0.8) level = Math.floor(Math.random() * 8) + 4; // 4 to 11
        else level = Math.floor(Math.random() * 5) + 12; // 12 to 16
        setMicLevel(level);
      }, 100);
    } else {
      setMicLevel(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTestingMic]);

  // Simulated recording/training progress increments
  useEffect(() => {
    let timer;
    if (isRecording) {
      timer = setInterval(() => {
        setTrainingProgress((prev) => {
          if (prev >= 100) {
            clearInterval(timer);
            setIsRecording(false);
            // Completed current sentence, transition to next
            setTimeout(() => {
              if (trainingStep < trainingSentences.length - 1) {
                setTrainingStep((s) => s + 1);
                setTrainingProgress(0);
              } else {
                setTrainingProgress(100);
                handleAutoSave({ voiceAITrained: true });
              }
            }, 600);
            return 100;
          }
          return prev + 5; // Takes 2 seconds
        });
      }, 100);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording, trainingStep]);

  // Simulated test playback progress
  useEffect(() => {
    let timer;
    if (playingLang) {
      timer = setInterval(() => {
        setPlayProgress((prev) => {
          if (prev >= 100) {
            clearInterval(timer);
            setPlayingLang(null);
            setPlayProgress(0);
            return 100;
          }
          return prev + 10; // Takes 3 seconds
        });
      }, 300);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [playingLang]);

  const startRecording = () => {
    if (trainingProgress >= 100) return;
    setIsRecording(true);
  };

  const stopRecording = () => {
    setIsRecording(false);
  };

  const handlePlayVoice = (langCode) => {
    if (playingLang) return; // already playing
    setPlayingLang(langCode);
    setPlayProgress(0);
  };

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
    handleAutoSave({ nativeLang: code, nativeLangSelected: true });
    setIsNativeLangModalVisible(false);
  };

  const toggleSecondaryLang = (code) => {
    const list = [...currentUser.secondaryLangs];
    const index = list.indexOf(code);
    if (index > -1) {
      list.splice(index, 1);
    } else {
      list.push(code);
    }
    handleAutoSave({ secondaryLangs: list, secondaryLangsSelected: true });
  };

  const handleTogglePref = (key) => {
    handleAutoSave({ [key]: !currentUser[key] });
  };

  const toggleMicTest = () => {
    if (isTestingMic) {
      setIsTestingMic(false);
    } else {
      setIsTestingMic(true);
      handleAutoSave({ micTested: true });
      setTimeout(() => {
        setIsTestingMic(false);
      }, 8000); // Test for 8s then automatically stop
    }
  };

  const getNativePills = () => {
    const list = Object.keys(LANGS).slice(0, 4);
    if (currentUser.nativeLang && !list.includes(currentUser.nativeLang)) {
      list.push(currentUser.nativeLang);
    }
    return list;
  };

  const getSecondaryPills = () => {
    const list = Object.keys(LANGS).slice(0, 4);
    currentUser.secondaryLangs.forEach((lang) => {
      if (!list.includes(lang)) {
        list.push(lang);
      }
    });
    return list;
  };

  const startVoiceTraining = () => {
    setTrainingStep(0);
    setTrainingProgress(0);
    setIsRecording(false);
    setIsTrainingModalVisible(true);
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

  // horizontal boxed progress level meter
  const renderMicLevelMeter = () => {
    const totalBoxes = 16;
    const boxes = [];
    for (let i = 1; i <= totalBoxes; i++) {
      const isLit = isTestingMic && i <= micLevel;
      let boxColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
      if (isLit) {
        if (i <= 10) {
          boxColor = colors.success; // green
        } else if (i <= 14) {
          boxColor = colors.warning; // orange
        } else {
          boxColor = colors.danger; // red
        }
      }
      boxes.push(
        <View
          key={i}
          style={[
            styles.micLevelBox,
            { backgroundColor: boxColor }
          ]}
        />
      );
    }
    return (
      <View style={styles.micLevelMeterContainer}>
        {boxes}
      </View>
    );
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

        {/* Native language picker (Show 4 + Show All) */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Native Language</Text>
          <View style={styles.langPills}>
            {getNativePills().map((code) => {
              const lang = LANGS[code];
              if (!lang) return null;
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
            <TouchableOpacity
              style={[styles.pillItem, { backgroundColor: colors.cardBg, borderColor: colors.primary, borderStyle: 'dashed' }]}
              onPress={() => setIsNativeLangModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, { color: colors.primary, fontWeight: '600' }]}>
                + Show All
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Train Voice AI Section (Placed below Native Language) */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Voice AI Profile</Text>
          <View style={[styles.voiceAICard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <View style={styles.voiceAIRow}>
              <TouchableOpacity
                style={[
                  styles.voiceAIBtn,
                  currentUser.voiceAITrained
                    ? { backgroundColor: colors.success + '20', borderColor: colors.success, borderWidth: 1 }
                    : { backgroundColor: colors.primary }
                ]}
                onPress={startVoiceTraining}
                activeOpacity={0.8}
              >
                {currentUser.voiceAITrained && (
                  <Text style={[styles.voiceAITicketText, { color: colors.success, fontSize: 16 }]}>✓ </Text>
                )}
                <Text style={[styles.voiceAIBtnText, currentUser.voiceAITrained ? { color: colors.success } : { color: 'white' }]}>
                  {currentUser.voiceAITrained ? 'Retrain Voice AI' : 'Train Your Voice AI'}
                </Text>
              </TouchableOpacity>

              {currentUser.voiceAITrained && (
                <TouchableOpacity
                  style={[styles.voiceAIBtn, { backgroundColor: colors.accent }]}
                  onPress={() => setIsTestingModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.voiceAIBtnText}>Test Your AI</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={[styles.voiceAIDesc, { color: colors.textMuted }]}>
              {currentUser.voiceAITrained
                ? 'Your speech model is active! Translate spoken audio using your own cloned voice.'
                : 'Clone your voice to speak translations in your own vocal print instead of robotic TTS.'}
            </Text>
          </View>
        </View>

        {/* Secondary target languages selection (Show 4 + Show All) */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Secondary Languages (To Translate)</Text>
          <View style={styles.langPills}>
            {getSecondaryPills().map((code) => {
              const lang = LANGS[code];
              if (!lang) return null;
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
            <TouchableOpacity
              style={[styles.pillItem, { backgroundColor: colors.cardBg, borderColor: colors.primary, borderStyle: 'dashed' }]}
              onPress={() => setIsSecondaryLangModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, { color: colors.primary, fontWeight: '600' }]}>
                + Show All
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Test Microphone with Horizontal Level Meter */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Microphone Test</Text>
          <View style={[styles.micTestCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <View style={styles.micTestControls}>
              <TouchableOpacity
                style={[
                  styles.testMicBtn,
                  isTestingMic
                    ? { backgroundColor: colors.danger }
                    : { backgroundColor: colors.primary }
                ]}
                onPress={toggleMicTest}
                activeOpacity={0.75}
              >
                <Text style={styles.testMicText}>
                  {isTestingMic ? 'Stop Test' : 'Test Microphone'}
                </Text>
              </TouchableOpacity>

              {/* Bouncing Level Meter */}
              {renderMicLevelMeter()}
            </View>
            <Text style={[styles.micTestDesc, { color: colors.textMuted }]}>
              {isTestingMic ? 'Speak normally to monitor level indicator activity.' : 'Tap to ensure device microphone receives audio input correctly.'}
            </Text>
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

      {/* ================= MODALS ================= */}

      {/* Modal 1: Native Language Selection (Popup of 20) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isNativeLangModalVisible}
        onRequestClose={() => setIsNativeLangModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Native Language</Text>
              <TouchableOpacity
                onPress={() => setIsNativeLangModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={[styles.modalCloseText, { color: colors.text }]}>&times;</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.modalGrid}>
                {Object.keys(LANGS).map((code) => {
                  const lang = LANGS[code];
                  const isSelected = currentUser.nativeLang === code;
                  return (
                    <TouchableOpacity
                      key={code}
                      style={[
                        styles.modalGridItem,
                        { borderColor: colors.border },
                        isSelected && { backgroundColor: colors.primaryGlow, borderColor: colors.primary }
                      ]}
                      onPress={() => selectNativeLang(code)}
                    >
                      <Text style={styles.modalGridItemFlag}>{lang.flag}</Text>
                      <Text style={[styles.modalGridItemText, { color: colors.text }, isSelected && { fontWeight: '700', color: colors.primary }]} numberOfLines={1}>
                        {lang.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal 2: Secondary Languages Selection (Popup of 20) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isSecondaryLangModalVisible}
        onRequestClose={() => setIsSecondaryLangModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Target Languages</Text>
              <TouchableOpacity
                onPress={() => setIsSecondaryLangModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={[styles.modalCloseText, { color: colors.text }]}>&times;</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.modalGrid}>
                {Object.keys(LANGS).map((code) => {
                  const lang = LANGS[code];
                  const isChecked = currentUser.secondaryLangs.includes(code);
                  return (
                    <TouchableOpacity
                      key={code}
                      style={[
                        styles.modalGridItem,
                        { borderColor: colors.border },
                        isChecked && { backgroundColor: colors.primaryGlow, borderColor: colors.primary }
                      ]}
                      onPress={() => toggleSecondaryLang(code)}
                    >
                      <View style={styles.checkboxContainer}>
                        <Text style={styles.modalGridItemFlag}>{lang.flag}</Text>
                        {isChecked && (
                          <View style={[styles.checkboxBadge, { backgroundColor: colors.primary }]}>
                            <Text style={styles.checkboxBadgeText}>✓</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.modalGridItemText, { color: colors.text }, isChecked && { fontWeight: '700', color: colors.primary }]} numberOfLines={1}>
                        {lang.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalDoneBtn, { backgroundColor: colors.primary }]}
              onPress={() => setIsSecondaryLangModalVisible(false)}
            >
              <Text style={styles.modalDoneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal 3: Voice AI Training Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isTrainingModalVisible}
        onRequestClose={() => setIsTrainingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBg, maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Voice AI Training</Text>
              <TouchableOpacity
                onPress={() => setIsTrainingModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={[styles.modalCloseText, { color: colors.text }]}>&times;</Text>
              </TouchableOpacity>
            </View>

            {trainingProgress < 100 || trainingStep < trainingSentences.length - 1 ? (
              <View style={styles.trainingBody}>
                <Text style={[styles.trainingSub, { color: colors.textMuted }]}>
                  Sentence {trainingStep + 1} of {trainingSentences.length}
                </Text>
                
                {/* Sentence Reading Card */}
                <View style={[styles.sentenceCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                  <Text style={[styles.sentenceText, { color: colors.text }]}>
                    "{trainingSentences[trainingStep]}"
                  </Text>
                </View>

                {/* Progress Bar */}
                <View style={styles.trainingProgressWrapper}>
                  <View style={styles.progressHeader}>
                    <Text style={[styles.progressLabel, { color: colors.textMuted }]}>Recording Speech</Text>
                    <Text style={[styles.progressPct, { color: colors.primary }]}>{trainingProgress}%</Text>
                  </View>
                  <View style={[styles.progressBarBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                    <View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: `${trainingProgress}%` }]} />
                  </View>
                </View>

                {/* Hold to Speak CTA Button */}
                <View style={styles.recordActionContainer}>
                  <TouchableOpacity
                    style={[
                      styles.recordHoldBtn,
                      { backgroundColor: colors.primary },
                      isRecording && { backgroundColor: colors.danger, transform: [{ scale: 1.05 }] }
                    ]}
                    onPressIn={startRecording}
                    onPressOut={stopRecording}
                    activeOpacity={0.85}
                  >
                    <Svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2.5"
                    >
                      <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <Line x1="12" x2="12" y1="19" y2="22" />
                    </Svg>
                  </TouchableOpacity>
                  <Text style={[styles.recordHint, { color: colors.textDimmed }]}>
                    {isRecording ? 'Release to pause' : 'Press and hold to read aloud'}
                  </Text>
                </View>
              </View>
            ) : (
              // Success Screen when complete
              <View style={styles.successBody}>
                <View style={[styles.successIconOuter, { backgroundColor: colors.success + '20' }]}>
                  <Text style={[styles.successIconText, { color: colors.success }]}>✓</Text>
                </View>
                <Text style={[styles.successTitle, { color: colors.text }]}>Voice Training Complete!</Text>
                <Text style={[styles.successDesc, { color: colors.textMuted }]}>
                  Your voice clone is fully trained and ready to translate.
                </Text>
                <TouchableOpacity
                  style={[styles.successDoneBtn, { backgroundColor: colors.success }]}
                  onPress={() => setIsTrainingModalVisible(false)}
                >
                  <Text style={styles.successDoneText}>Finish</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal 4: Test Your AI Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isTestingModalVisible}
        onRequestClose={() => setIsTestingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBg, maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Test Voice Clone</Text>
              <TouchableOpacity
                onPress={() => setIsTestingModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={[styles.modalCloseText, { color: colors.text }]}>&times;</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.testIntro, { color: colors.textMuted }]}>
              Hear how your voice sounds in other languages! Tap play next to any target translation.
            </Text>

            <ScrollView contentContainerStyle={styles.testList} showsVerticalScrollIndicator={false}>
              {[
                { code: 'zh', name: 'Chinese', flag: '🇨🇳', phrase: '你好，很高兴今天能和你说话！' },
                { code: 'ar', name: 'Arabic', flag: '🇸🇦', phrase: 'مرحباً، من الرائع التحدث إليك اليوم!' },
                { code: 'es', name: 'Spanish', flag: '🇪🇸', phrase: 'Hola, es genial hablar contigo hoy!' },
                { code: 'fr', name: 'French', flag: '🇫🇷', phrase: 'Bonjour, c\'est génial de vous parler aujourd\'hui !' },
                { code: 'ja', name: 'Japanese', flag: '🇯🇵', phrase: 'こんにちは、今日はお話しできて光栄です！' },
                { code: 'sw', name: 'Swahili', flag: '🇰🇪', phrase: 'Habari, ni vyema kuzungumza nawe leo!' }
              ].map((item) => {
                const isPlaying = playingLang === item.code;
                return (
                  <View
                    key={item.code}
                    style={[
                      styles.testItemCard,
                      { backgroundColor: colors.bg, borderColor: colors.border },
                      isPlaying && { borderColor: colors.primary }
                    ]}
                  >
                    <View style={styles.testItemHeader}>
                      <View style={styles.testItemLang}>
                        <Text style={styles.testItemFlag}>{item.flag}</Text>
                        <Text style={[styles.testItemName, { color: colors.text }]}>{item.name}</Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.testPlayBtn,
                          { backgroundColor: isPlaying ? colors.danger : colors.primary }
                        ]}
                        onPress={() => handlePlayVoice(item.code)}
                        disabled={playingLang !== null && !isPlaying}
                      >
                        {isPlaying ? (
                          // Stop / Pause icon
                          <Svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                            <Path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                          </Svg>
                        ) : (
                          // Play icon
                          <Svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                            <Path d="M8 5v14l11-7z" />
                          </Svg>
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Speech Text and Waveform visualizer */}
                    <View style={styles.testItemContent}>
                      <Text style={[styles.testItemPhrase, { color: colors.textDimmed }]}>
                        {item.phrase}
                      </Text>
                      
                      {isPlaying && (
                        <View style={styles.visualizerRow}>
                          {[...Array(12)].map((_, i) => {
                            // Generate heights for animated pulse feel
                            const randomHeight = Math.floor(Math.sin((playProgress + i * 2) * 0.5) * 10) + 16;
                            return (
                              <View
                                key={i}
                                style={[
                                  styles.visualizerBar,
                                  { backgroundColor: colors.accent, height: randomHeight }
                                ]}
                              />
                            );
                          })}
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  voiceAICard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12
  },
  voiceAIRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  voiceAIBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row'
  },
  voiceAIBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white'
  },
  voiceAITicketText: {
    fontWeight: '700'
  },
  voiceAIDesc: {
    fontSize: 12,
    lineHeight: 16
  },
  micTestCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12
  },
  micTestControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  testMicBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  testMicText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600'
  },
  micLevelMeterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start',
    paddingLeft: 8
  },
  micLevelBox: {
    width: 7,
    height: 16,
    borderRadius: 1.5,
    marginRight: 3
  },
  micTestDesc: {
    fontSize: 12,
    lineHeight: 16
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
  },

  // Modals Styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 6, 18, 0.65)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700'
  },
  modalCloseBtn: {
    padding: 4
  },
  modalCloseText: {
    fontSize: 28,
    lineHeight: 28
  },
  modalScroll: {
    paddingBottom: 12
  },
  modalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between'
  },
  modalGridItem: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6
  },
  modalGridItemFlag: {
    fontSize: 22
  },
  modalGridItemText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1
  },
  checkboxContainer: {
    position: 'relative'
  },
  checkboxBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkboxBadgeText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '700'
  },
  modalDoneBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 16
  },
  modalDoneBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600'
  },

  // Voice Training Modal styles
  trainingBody: {
    gap: 18,
    alignItems: 'center'
  },
  trainingSub: {
    fontSize: 13,
    fontWeight: '600'
  },
  sentenceCard: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 100,
    justifyContent: 'center',
    alignItems: 'center'
  },
  sentenceText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 24
  },
  trainingProgressWrapper: {
    width: '100%',
    gap: 6
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '500'
  },
  progressPct: {
    fontSize: 13,
    fontWeight: '700'
  },
  progressBarBg: {
    width: '100%',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5
  },
  recordActionContainer: {
    alignItems: 'center',
    gap: 10,
    marginTop: 10
  },
  recordHoldBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  recordHint: {
    fontSize: 12,
    fontWeight: '500'
  },
  successBody: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 16
  },
  successIconOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center'
  },
  successIconText: {
    fontSize: 32,
    fontWeight: '700'
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700'
  },
  successDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20
  },
  successDoneBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8
  },
  successDoneText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600'
  },

  // Test Clone Modal styles
  testIntro: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16
  },
  testList: {
    gap: 12,
    paddingBottom: 16
  },
  testItemCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 10
  },
  testItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  testItemLang: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  testItemFlag: {
    fontSize: 22
  },
  testItemName: {
    fontSize: 14,
    fontWeight: '600'
  },
  testPlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  testItemContent: {
    gap: 8
  },
  testItemPhrase: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic'
  },
  visualizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 28,
    marginTop: 6
  },
  visualizerBar: {
    width: 3,
    borderRadius: 1.5,
    minHeight: 4
  }
});
