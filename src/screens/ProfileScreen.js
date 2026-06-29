import React, { useContext, useState, useEffect, useRef } from "react";
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
  Dimensions,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Line, Circle, Rect, Polyline } from "react-native-svg";
import { AppContext } from "../context/AppContext";
import UserProfilePopup from "../components/UserProfilePopup";
import {
  getStorageStats,
  runSmartStorageCleanup,
  clearLocalMediaCache,
  triggerCloudBackup,
} from "../services/StorageService";
import { clearDatabase } from "../services/DatabaseService";
import * as ImagePicker from "expo-image-picker";
import {
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

const { width, height } = Dimensions.get("window");

const MIC_TEST_AUDIO_OPTIONS = {
  android: {
    extension: ".m4a",
    outputFormat: "mpeg4",
    audioEncoder: "aac",
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: ".m4a",
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MEDIUM,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: "audio/webm",
    bitsPerSecond: 64000,
  },
  isMeteringEnabled: true,
};

const AVATAR_PRESETS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&h=150&q=80",
  "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=150&h=150&q=80",
];

export default function ProfileScreen({ route, navigation }) {
  const {
    currentUser,
    updateSettings,
    logoutUser,
    deleteAccountAndResetApp,
    getLangDetails,
    LANGS,
  } = useContext(AppContext);
  const [saveStatus, setSaveStatus] = useState("saved"); // 'saved', 'saving', 'idle'
  const [name, setName] = useState(currentUser.name);
  const [phone, setPhone] = useState(currentUser.phone || "");

  // References and Glow states
  const scrollRef = useRef(null);
  const layoutOffsets = useRef({});
  const [glowTarget, setGlowTarget] = useState(null);

  // Modal Visibility states
  const [isImageSourceModalVisible, setIsImageSourceModalVisible] =
    useState(false);
  const [isNativeLangModalVisible, setIsNativeLangModalVisible] =
    useState(false);
  const [isSecondaryLangModalVisible, setIsSecondaryLangModalVisible] =
    useState(false);
  const [isUnityAILangModalVisible, setIsUnityAILangModalVisible] =
    useState(false);
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
  const [micTestStatus, setMicTestStatus] = useState("idle");

  // Storage & Data management state
  const [storageStats, setStorageStats] = useState({
    imagesSize: "0.00",
    avatarsSize: "0.00",
    totalSize: "0.00",
  });
  const [isCleaning, setIsCleaning] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [deleteCode, setDeleteCode] = useState("");
  const [deleteCodeInput, setDeleteCodeInput] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [profilePopupVisible, setProfilePopupVisible] = useState(false);
  const [profilePopupData, setProfilePopupData] = useState(null);

  const loadStats = async () => {
    try {
      const stats = await getStorageStats();
      setStorageStats(stats);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    let active = true;
    const fetchStats = async () => {
      try {
        const stats = await getStorageStats();
        if (active) {
          setStorageStats(stats);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchStats();
    return () => {
      active = false;
    };
  }, []);

  const handleSmartCleanup = async () => {
    setIsCleaning(true);
    try {
      const result = await runSmartStorageCleanup();
      await loadStats();
      Alert.alert(
        "Cleanup Complete",
        `Successfully purged ${result.imagesDeleted} post images and ${result.avatarsDeleted} stale contact avatars. Active contacts' avatars were preserved.`,
      );
    } catch (e) {
      console.error(e);
      Alert.alert("Cleanup Failed", "Unable to complete storage cleanup.");
    } finally {
      setIsCleaning(false);
    }
  };

  const handleCloudBackup = async () => {
    setIsBackingUp(true);
    try {
      const success = await triggerCloudBackup(true); // force backup
      if (success) {
        Alert.alert(
          "Backup Complete",
          "All contacts and chat transcripts backed up securely to the server.",
        );
      } else {
        Alert.alert(
          "Backup Failed",
          "Unable to reach the backup server. Please check your internet connection.",
        );
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Backup Failed", "An error occurred during background sync.");
    } finally {
      setIsBackingUp(false);
    }
  };

  const openProfilePopup = () => {
    setProfilePopupData({
      name: currentUser.name,
      avatar: currentUser.avatar,
      nativeLang: currentUser.nativeLang,
      uid: currentUser.uid,
    });
    setProfilePopupVisible(true);
  };

  const handleLogout = async () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await logoutUser();
          navigation.reset({
            index: 0,
            routes: [{ name: "Auth" }],
          });
        },
      },
    ]);
  };

  const generateDeletionCode = () =>
    Math.floor(100000 + Math.random() * 900000).toString();

  const openDeletionEmail = async (code) => {
    const subject = encodeURIComponent(
      "Unity account deletion confirmation code",
    );
    const body = encodeURIComponent(
      `Your Unity deletion confirmation code is: ${code}\n\nIf you did not request this, you can ignore this email.`,
    );
    const mailtoUrl = `mailto:${currentUser.email}?subject=${subject}&body=${body}`;

    const canOpen = await Linking.canOpenURL(mailtoUrl);
    if (canOpen) {
      await Linking.openURL(mailtoUrl);
      return true;
    }

    Alert.alert(
      "Email App Not Available",
      "We could not open an email app on this device. The confirmation code was generated, but you will need to send it from your email client manually.",
    );
    return false;
  };

  const handleStartDeleteAccount = () => {
    if (!currentUser.isRealUser || !currentUser.email) {
      Alert.alert(
        "Email Required",
        "Please sign in with a real email account before deleting it.",
      );
      return;
    }

    const nextCode = generateDeletionCode();
    setDeleteCode(nextCode);
    setDeleteCodeInput("");
    setIsDeleteModalVisible(true);
    openDeletionEmail(nextCode).catch((error) => {
      console.error("Failed to open deletion email", error);
    });
  };

  const handleConfirmDeleteAccount = async () => {
    if (deleteCodeInput.trim() !== deleteCode) {
      Alert.alert(
        "Code Mismatch",
        "The confirmation code does not match the code sent to your email.",
      );
      return;
    }

    setIsDeletingAccount(true);
    try {
      await deleteAccountAndResetApp();
      setIsDeleteModalVisible(false);
      setDeleteCode("");
      setDeleteCodeInput("");
      navigation.reset({
        index: 0,
        routes: [{ name: "Auth" }],
      });
    } catch (error) {
      console.error("Failed to delete account", error);
      Alert.alert(
        "Delete Failed",
        "We could not remove the account data right now. Please try again.",
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      "Clear Database",
      "Are you sure you want to delete all messages, contacts, and media? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Everything",
          style: "destructive",
          onPress: async () => {
            await clearDatabase();
            await clearLocalMediaCache();
            await loadStats();
          },
        },
      ],
    );
  };

  const trainingSentences = [
    "The quick brown fox jumps over the lazy dog.",
    "Unity translates my voice instantly to any language in real-time.",
    "Global communication is now seamless and natural for everyone.",
  ];

  // Scroll to and blink/glow target logic when route parameters change
  useEffect(() => {
    const rawTarget = route.params?.scrollTo;
    if (rawTarget !== undefined && rawTarget !== null) {
      let target = String(rawTarget);
      let highlightTarget = target;
      if (typeof rawTarget === "string" && rawTarget.startsWith("avatar")) {
        target = "avatar";
        highlightTarget = rawTarget;
        const slotMatch = rawTarget.match(/avatar(\d)/);
        if (slotMatch && slotMatch[1]) {
          const slotIndex = parseInt(slotMatch[1], 10) - 1;
          if (slotIndex >= 0 && slotIndex <= 3) {
            handleAutoSave({ activeAvatarSlot: slotIndex });
          }
        }
      }

      const scrollTimer = setTimeout(() => {
        if (layoutOffsets.current[target] !== undefined) {
          scrollRef.current?.scrollTo({
            y: layoutOffsets.current[target] - 12, // Scroll slightly above the element
            animated: true,
          });
        }

        // Trigger blinking yellow glow
        setGlowTarget(highlightTarget);

        const clearGlow = setTimeout(() => {
          setGlowTarget(null);
        }, 2500); // Glow remains visible for 2.5s

        return () => clearTimeout(clearGlow);
      }, 400); // 400ms delay to ensure component layout coordinates are fully ready

      return () => clearTimeout(scrollTimer);
    }
  }, [route.params]);

  const micTestTimeoutRef = useRef(null);
  const micTestRecorder = useAudioRecorder(MIC_TEST_AUDIO_OPTIONS);
  const micRecorderState = useAudioRecorderState(micTestRecorder, 80);

  useEffect(() => {
    return () => {
      if (micTestTimeoutRef.current) {
        clearTimeout(micTestTimeoutRef.current);
      }
    };
  }, []);

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

  // Auto-saving configuration
  function handleAutoSave(newSettings) {
    setSaveStatus("saving");
    updateSettings(newSettings);
    setTimeout(() => {
      setSaveStatus("saved");
    }, 800);
  }

  const hasSavedAvatarSlots = Array.isArray(currentUser.avatarSlots);
  const avatarSlots = AVATAR_PRESETS.map((fallbackAvatar, index) => {
    if (hasSavedAvatarSlots) {
      return currentUser.avatarSlots?.[index] || fallbackAvatar;
    }

    return index === 0 ? currentUser.avatar || fallbackAvatar : fallbackAvatar;
  });
  const matchedAvatarSlot = avatarSlots.findIndex(
    (slotAvatar) => slotAvatar === currentUser.avatar,
  );
  const activeAvatarSlot =
    Number.isInteger(currentUser.activeAvatarSlot) &&
    currentUser.activeAvatarSlot >= 0 &&
    currentUser.activeAvatarSlot < avatarSlots.length
      ? currentUser.activeAvatarSlot
      : Math.max(0, matchedAvatarSlot);

  const handleNameChange = (val) => {
    setName(val);
    handleAutoSave({ name: val });
  };

  const handlePhoneChange = (val) => {
    setPhone(val);
    handleAutoSave({ phone: val });
  };

  const selectAvatar = (url, index) => {
    handleAutoSave({
      avatar: url,
      avatarSlots,
      activeAvatarSlot: index,
    });
  };

  const saveAvatarToActiveSlot = (uri) => {
    const nextAvatarSlots = [...avatarSlots];
    nextAvatarSlots[activeAvatarSlot] = uri;
    handleAutoSave({
      avatar: uri,
      avatarSlots: nextAvatarSlots,
      activeAvatarSlot,
    });
  };

  const openGallery = async () => {
    setIsImageSourceModalVisible(false);
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      saveAvatarToActiveSlot(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    setIsImageSourceModalVisible(false);

    // Request camera permissions first
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Denied",
        "Sorry, we need camera permissions to make this work!",
      );
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      saveAvatarToActiveSlot(result.assets[0].uri);
    }
  };

  const selectNativeLang = (code) => {
    if (currentUser.secondaryLangs.includes(code)) {
      toggleSecondaryLang(code); // Remove from secondary if it's there
    }
    updateSettings({ nativeLang: code, nativeLangSelected: true });
    setIsNativeLangModalVisible(false);
  };

  const selectUnityAILang = (code) => {
    updateSettings({ unityAILang: code });
    setIsUnityAILangModalVisible(false);
  };

  const toggleSecondaryLang = (code) => {
    const list = [...currentUser.secondaryLangs];
    const index = list.indexOf(code);
    if (index > -1) {
      list.splice(index, 1);
    } else {
      list.push(code);
    }
    handleAutoSave({
      secondaryLangs: list,
      secondaryLangsSelected: list.length > 0,
    });
  };

  const handleTogglePref = (key) => {
    handleAutoSave({ [key]: !currentUser[key] });
  };

  const stopMicTest = async () => {
    if (micTestTimeoutRef.current) {
      clearTimeout(micTestTimeoutRef.current);
      micTestTimeoutRef.current = null;
    }

    try {
      if (micTestRecorder.isRecording) {
        await micTestRecorder.stop();
      }
    } catch (error) {
      console.warn("Failed to stop microphone test", error);
    } finally {
      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      }).catch((error) => console.warn("Failed to reset audio mode", error));
      setIsTestingMic(false);
      setMicTestStatus("idle");
    }
  };

  const startMicTest = async () => {
    setMicTestStatus("checking");

    try {
      const permission = await AudioModule.getRecordingPermissionsAsync();
      if (permission.status !== "granted") {
        const request = await AudioModule.requestRecordingPermissionsAsync();
        if (request.status !== "granted") {
          setMicTestStatus("idle");
          Alert.alert(
            "Microphone Permission Needed",
            "Allow microphone access to run a real input test.",
          );
          return;
        }
      }

      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      await micTestRecorder.prepareToRecordAsync();
      micTestRecorder.record();
      setIsTestingMic(true);
      setMicTestStatus("listening");
      handleAutoSave({ micTested: true });
      micTestTimeoutRef.current = setTimeout(() => {
        stopMicTest();
      }, 8000);
    } catch (error) {
      console.warn("Microphone test failed", error);
      setMicTestStatus("idle");
      setIsTestingMic(false);
      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      }).catch(() => {});
      Alert.alert(
        "Microphone Test Failed",
        "Could not start a real microphone test on this device.",
      );
    }
  };

  const toggleMicTest = () => {
    if (isTestingMic || micTestStatus === "checking") {
      stopMicTest();
      return;
    }

    startMicTest();
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

  const isDark = currentUser.prefDarkTheme;
  const colors = {
    bg: isDark ? "#0A0612" : "#F8FAFC",
    cardBg: isDark ? "#120C24" : "#FFFFFF",
    border: isDark ? "rgba(255, 255, 255, 0.07)" : "rgba(0, 0, 0, 0.05)",
    text: isDark ? "#F3F4F6" : "#0F172A",
    textMuted: isDark ? "#9CA3AF" : "#475569",
    textDimmed: isDark ? "#6B7280" : "#64748B",
    primary: isDark ? "#8B5CF6" : "#4F46E5",
    primaryGlow: isDark ? "rgba(139, 92, 246, 0.1)" : "rgba(79, 70, 229, 0.08)",
    accent: isDark ? "#06B6D4" : "#0284C7",
    success: isDark ? "#10B981" : "#16A34A",
    danger: isDark ? "#EF4444" : "#E11D48",
    warning: isDark ? "#F59E0B" : "#D97706",
  };

  const renderMicLevelMeter = () => {
    const totalBars = 24;
    const bars = [];
    const metering = micRecorderState.metering;
    const hasMetering =
      isTestingMic && metering !== undefined && Number.isFinite(metering);
    const gatedDb = hasMetering ? Math.max(-56, Math.min(-4, metering)) : -56;
    const normalized = Math.max(0, Math.min(1, (gatedDb + 56) / 52));
    const liveLevel =
      hasMetering && normalized >= 0.04 ? Math.pow(normalized, 0.72) : 0;
    const peakLevel = liveLevel;

    for (let i = 0; i < totalBars; i++) {
      const threshold = (i + 1) / totalBars;
      const energy = isTestingMic
        ? Math.max(0, Math.min(1, (liveLevel - threshold + 0.22) / 0.22))
        : 0;
      const peakEnergy = isTestingMic
        ? Math.max(0, Math.min(1, (peakLevel - threshold + 0.08) / 0.08))
        : 0;
      const maxHeight = 18 + (i % 5) * 3;
      const idleHeight = 5 + (i % 4);
      const height = Math.round(idleHeight + energy * maxHeight);
      const isHot = i >= 19;
      const isWarm = i >= 15;
      const activeColor = isHot
        ? colors.danger
        : isWarm
          ? colors.warning
          : colors.success;
      const idleColor = isDark
        ? "rgba(255, 255, 255, 0.1)"
        : "rgba(15, 23, 42, 0.1)";

      bars.push(
        <View key={i} style={styles.micLevelTrack}>
          <View
            style={[
              styles.micPeakDot,
              {
                opacity: peakEnergy > 0 ? 0.35 + peakEnergy * 0.55 : 0,
                backgroundColor: activeColor,
              },
            ]}
          />
          <View
            style={[
              styles.micLevelBox,
              {
                height,
                opacity: isTestingMic ? 0.45 + energy * 0.55 : 0.35,
                backgroundColor: energy > 0 ? activeColor : idleColor,
              },
            ]}
          />
        </View>,
      );
    }

    return <View style={styles.micLevelMeterContainer}>{bars}</View>;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header bar with auto save indicators */}
      <SafeAreaView
        style={[
          styles.headerSafeArea,
          {
            backgroundColor: colors.cardBg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
        ]}
        edges={["top", "left", "right"]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.navigate("Home")}
            style={styles.closeBtn}
          >
            <Text style={[styles.closeBtnText, { color: colors.text }]}>
              &times;
            </Text>
          </TouchableOpacity>

          <Text style={[styles.title, { color: colors.text }]}>
            Profile Settings
          </Text>

          {/* Autosave pill notification */}
          <View
            style={[
              styles.saveIndicator,
              saveStatus === "saving"
                ? {
                    backgroundColor: "rgba(245, 158, 11, 0.1)",
                    borderColor: "rgba(245, 158, 11, 0.25)",
                  }
                : {
                    backgroundColor: "rgba(16, 185, 129, 0.1)",
                    borderColor: "rgba(16, 185, 129, 0.25)",
                  },
            ]}
          >
            <View
              style={[
                styles.saveDot,
                {
                  backgroundColor:
                    saveStatus === "saving" ? colors.warning : colors.success,
                },
              ]}
            />
            <Text
              style={[
                styles.saveText,
                {
                  color:
                    saveStatus === "saving" ? colors.warning : colors.success,
                },
              ]}
            >
              {saveStatus === "saving" ? "Saving..." : "Saved"}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar presets selector */}
        <View
          onLayout={(e) => {
            layoutOffsets.current.avatar = e.nativeEvent.layout.y;
          }}
          style={[
            styles.avatarSection,
            glowTarget === "avatar" && styles.glowSection,
            {
              borderWidth: 2,
              borderColor: glowTarget === "avatar" ? "#F59E0B" : "transparent",
              borderRadius: 20,
              padding: 8,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.avatarPreviewContainer,
              { backgroundColor: colors.primary },
            ]}
            onPress={openProfilePopup}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: currentUser.avatar }}
              style={[styles.avatarPreview, { borderColor: colors.cardBg }]}
            />
            {/* Pen Icon for Edit */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setIsImageSourceModalVisible(true)}
              style={[
                styles.editIconBadge,
                { backgroundColor: colors.primary, borderColor: colors.cardBg },
              ]}
            >
              <Svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </Svg>
            </TouchableOpacity>
          </TouchableOpacity>
          <View style={styles.presetsWrapper}>
            {avatarSlots.map((avatarUri, idx) => {
              const isSelected = idx === activeAvatarSlot;
              return (
                <TouchableOpacity
                  key={`${idx}-${avatarUri}`}
                  onPress={() => selectAvatar(avatarUri, idx)}
                  activeOpacity={0.7}
                  style={[
                    styles.presetTouchTarget,
                    glowTarget === `avatar${idx + 1}` && styles.glowSection,
                    {
                      borderWidth: 2,
                      borderColor:
                        glowTarget === `avatar${idx + 1}`
                          ? "#F59E0B"
                          : "transparent",
                      borderRadius: 26,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: avatarUri }}
                    style={[
                      styles.presetItem,
                      isSelected
                        ? {
                            borderColor: colors.primary,
                            transform: [{ scale: 1.08 }],
                          }
                        : { borderColor: "transparent" },
                    ]}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Display name field */}
        <View
          onLayout={(e) => {
            layoutOffsets.current.username = e.nativeEvent.layout.y;
          }}
          style={[
            styles.formGroup,
            glowTarget === "username" && styles.glowSection,
            {
              borderWidth: 2,
              borderColor:
                glowTarget === "username" ? "#F59E0B" : "transparent",
              borderRadius: 16,
              padding: 8,
            },
          ]}
        >
          <Text style={[styles.label, { color: colors.textMuted }]}>
            Display Name
          </Text>
          <TextInput
            style={[
              styles.inputField,
              {
                backgroundColor: colors.cardBg,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="Enter display name"
            placeholderTextColor={colors.textDimmed}
            value={name}
            onChangeText={handleNameChange}
          />
        </View>

        {/* Phone number field */}
        <View
          onLayout={(e) => {
            layoutOffsets.current.phone = e.nativeEvent.layout.y;
          }}
          style={[
            styles.formGroup,
            glowTarget === "phone" && styles.glowSection,
            {
              borderWidth: 2,
              borderColor:
                glowTarget === "phone" ? "#F59E0B" : "transparent",
              borderRadius: 16,
              padding: 8,
            },
          ]}
        >
          <Text style={[styles.label, { color: colors.textMuted }]}>
            Phone Number
          </Text>
          <TextInput
            style={[
              styles.inputField,
              {
                backgroundColor: colors.cardBg,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="+1 234 567 8900"
            placeholderTextColor={colors.textDimmed}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={handlePhoneChange}
          />
        </View>

        {/* Native language picker (Show 4 + Show All) */}
        <View
          onLayout={(e) => {
            layoutOffsets.current.nativeLang = e.nativeEvent.layout.y;
          }}
          style={[
            styles.formGroup,
            glowTarget === "nativeLang" && styles.glowSection,
            {
              borderWidth: 2,
              borderColor:
                glowTarget === "nativeLang" ? "#F59E0B" : "transparent",
              borderRadius: 16,
              padding: 8,
            },
          ]}
        >
          <Text style={[styles.label, { color: colors.textMuted }]}>
            Native Language
          </Text>
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
                      ? {
                          backgroundColor: colors.primaryGlow,
                          borderColor: colors.primary,
                        }
                      : {
                          backgroundColor: colors.cardBg,
                          borderColor: colors.border,
                        },
                  ]}
                  onPress={() => selectNativeLang(code)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.pillText,
                      isSelected
                        ? { color: colors.primary, fontWeight: "600" }
                        : { color: colors.textMuted },
                    ]}
                  >
                    {lang.flag} {lang.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[
                styles.pillItem,
                {
                  backgroundColor: colors.cardBg,
                  borderColor: colors.primary,
                  borderStyle: "dashed",
                },
              ]}
              onPress={() => setIsNativeLangModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: colors.primary, fontWeight: "600" },
                ]}
              >
                + Show All
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Train Voice AI Section (Placed below Native Language) */}
        <View
          onLayout={(e) => {
            layoutOffsets.current.voice = e.nativeEvent.layout.y;
          }}
          style={[
            styles.formGroup,
            glowTarget === "voice" && styles.glowSection,
            {
              borderWidth: 2,
              borderColor: glowTarget === "voice" ? "#F59E0B" : "transparent",
              borderRadius: 16,
              padding: 8,
            },
          ]}
        >
          <Text style={[styles.label, { color: colors.textMuted }]}>
            Voice AI Profile
          </Text>
          <View
            style={[
              styles.voiceAICard,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
            ]}
          >
            <View style={styles.voiceAIRow}>
              <TouchableOpacity
                style={[
                  styles.voiceAIBtn,
                  currentUser.voiceAITrained
                    ? {
                        backgroundColor: colors.success + "20",
                        borderColor: colors.success,
                        borderWidth: 1,
                      }
                    : { backgroundColor: colors.primary },
                ]}
                onPress={startVoiceTraining}
                activeOpacity={0.8}
              >
                {currentUser.voiceAITrained && (
                  <Text
                    style={[
                      styles.voiceAITicketText,
                      { color: colors.success, fontSize: 16 },
                    ]}
                  >
                    ✓{" "}
                  </Text>
                )}
                <Text
                  style={[
                    styles.voiceAIBtnText,
                    currentUser.voiceAITrained
                      ? { color: colors.success }
                      : { color: "white" },
                  ]}
                >
                  {currentUser.voiceAITrained
                    ? "Retrain Voice AI"
                    : "Train Your Voice AI"}
                </Text>
              </TouchableOpacity>

              {currentUser.voiceAITrained && (
                <TouchableOpacity
                  style={[
                    styles.voiceAIBtn,
                    { backgroundColor: colors.accent },
                  ]}
                  onPress={() => setIsTestingModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.voiceAIBtnText}>Test Your AI</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={[styles.voiceAIDesc, { color: colors.textMuted }]}>
              {currentUser.voiceAITrained
                ? "Your speech model is active! Translate spoken audio using your own cloned voice."
                : "Clone your voice to speak translations in your own vocal print instead of robotic TTS."}
            </Text>
          </View>
        </View>

        {/* Secondary target languages selection (Show 4 + Show All) */}
        <View
          onLayout={(e) => {
            layoutOffsets.current.secondaryLang = e.nativeEvent.layout.y;
          }}
          style={[
            styles.formGroup,
            glowTarget === "secondaryLang" && styles.glowSection,
            {
              borderWidth: 2,
              borderColor:
                glowTarget === "secondaryLang" ? "#F59E0B" : "transparent",
              borderRadius: 16,
              padding: 8,
            },
          ]}
        >
          <Text style={[styles.label, { color: colors.textMuted }]}>
            Secondary Languages (To Translate)
          </Text>
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
                      ? {
                          backgroundColor: colors.primaryGlow,
                          borderColor: colors.primary,
                        }
                      : {
                          backgroundColor: colors.cardBg,
                          borderColor: colors.border,
                        },
                  ]}
                  onPress={() => toggleSecondaryLang(code)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.pillText,
                      isChecked
                        ? { color: colors.primary, fontWeight: "600" }
                        : { color: colors.textMuted },
                    ]}
                  >
                    {isChecked ? "✓ " : ""}
                    {lang.flag} {lang.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[
                styles.pillItem,
                {
                  backgroundColor: colors.cardBg,
                  borderColor: colors.primary,
                  borderStyle: "dashed",
                },
              ]}
              onPress={() => setIsSecondaryLangModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: colors.primary, fontWeight: "600" },
                ]}
              >
                + Show All
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* AI Companion settings */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.textMuted }]}>
            AI Companion Language
          </Text>
          <Text style={{ color: colors.textDimmed, fontSize: 13, marginBottom: 8, marginTop: -4 }}>
            AI translates best in selected language
          </Text>
          <View style={styles.langPills}>
            <TouchableOpacity
              style={[
                styles.pillItem,
                {
                  backgroundColor: colors.primaryGlow,
                  borderColor: colors.primary,
                },
              ]}
              onPress={() => setIsUnityAILangModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: colors.primary, fontWeight: "600" },
                ]}
              >
                {LANGS[currentUser.unityAILang]?.flag || "🌍"}{" "}
                {LANGS[currentUser.unityAILang]?.name ||
                  currentUser.unityAILang ||
                  "Select Language"}{" "}
                (Change)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Test Microphone with Horizontal Level Meter */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.textMuted }]}>
            Microphone Test
          </Text>
          <View
            style={[
              styles.micTestCard,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
            ]}
          >
            <View style={styles.micTestControls}>
              <TouchableOpacity
                style={[
                  styles.testMicBtn,
                  isTestingMic
                    ? { backgroundColor: colors.danger }
                    : { backgroundColor: colors.primary },
                ]}
                onPress={toggleMicTest}
                activeOpacity={0.75}
              >
                <Text style={styles.testMicText}>
                  {isTestingMic
                    ? "Stop Test"
                    : micTestStatus === "checking"
                      ? "Checking..."
                      : "Test Microphone"}
                </Text>
              </TouchableOpacity>

              {/* Bouncing Level Meter */}
              {renderMicLevelMeter()}
            </View>
            <Text style={[styles.micTestDesc, { color: colors.textMuted }]}>
              {isTestingMic
                ? "Speak now. The meter is following live microphone input."
                : micTestStatus === "checking"
                  ? "Requesting microphone access..."
                  : "Tap to run a real device microphone input test."}
            </Text>
          </View>
        </View>

        {/* Preferences / Toggles list */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.textMuted }]}>
            Preferences
          </Text>
          <View
            style={[
              styles.toggleList,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
            ]}
          >
            <View
              style={[styles.toggleItem, { borderBottomColor: colors.border }]}
            >
              <Text style={[styles.toggleLabel, { color: colors.text }]}>
                Dark Theme Mode
              </Text>
              <Switch
                value={currentUser.prefDarkTheme}
                onValueChange={() => handleTogglePref("prefDarkTheme")}
                trackColor={{ false: "rgba(0,0,0,0.1)", true: colors.primary }}
              />
            </View>

            <View
              style={[styles.toggleItem, { borderBottomColor: colors.border }]}
            >
              <Text style={[styles.toggleLabel, { color: colors.text }]}>
                Auto-translate Incoming Voice
              </Text>
              <Switch
                value={currentUser.prefAutoTrans}
                onValueChange={() => handleTogglePref("prefAutoTrans")}
                trackColor={{ false: "rgba(0,0,0,0.1)", true: colors.primary }}
              />
            </View>

            <View
              style={[styles.toggleItem, { borderBottomColor: colors.border }]}
            >
              <Text style={[styles.toggleLabel, { color: colors.text }]}>
                Haptic Feedback on Mic Activation
              </Text>
              <Switch
                value={currentUser.prefHaptics}
                onValueChange={() => handleTogglePref("prefHaptics")}
                trackColor={{ false: "rgba(0,0,0,0.1)", true: colors.primary }}
              />
            </View>

            <View
              style={[styles.toggleItem, { borderBottomColor: colors.border }]}
            >
              <Text style={[styles.toggleLabel, { color: colors.text }]}>
                Voice Activation Detection (VAD)
              </Text>
              <Switch
                value={currentUser.prefVad}
                onValueChange={() => handleTogglePref("prefVad")}
                trackColor={{ false: "rgba(0,0,0,0.1)", true: colors.primary }}
              />
            </View>

            <View style={styles.toggleItem}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>
                Enable Chat Text Transcripts
              </Text>
              <Switch
                value={currentUser.prefShowTranscripts}
                onValueChange={() => handleTogglePref("prefShowTranscripts")}
                trackColor={{ false: "rgba(0,0,0,0.1)", true: colors.primary }}
              />
            </View>
          </View>
        </View>

        {/* Storage & Data Section */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.textMuted }]}>
            Storage & Data
          </Text>
          <View
            style={[
              styles.toggleList,
              {
                backgroundColor: colors.cardBg,
                borderColor: colors.border,
                padding: 16,
                borderRadius: 16,
                gap: 12,
              },
            ]}
          >
            {/* Storage Stats */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                paddingBottom: 12,
              }}
            >
              <View>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: colors.text,
                  }}
                >
                  Images Cache
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.textMuted,
                    marginTop: 2,
                  }}
                >
                  Shared post media
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: colors.accent,
                }}
              >
                {storageStats.imagesSize} MB
              </Text>
            </View>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                paddingBottom: 12,
              }}
            >
              <View>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: colors.text,
                  }}
                >
                  Avatars Cache
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.textMuted,
                    marginTop: 2,
                  }}
                >
                  Contact profile images
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: colors.accent,
                }}
              >
                {storageStats.avatarsSize} MB
              </Text>
            </View>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingBottom: 8,
              }}
            >
              <Text
                style={{ fontSize: 16, fontWeight: "700", color: colors.text }}
              >
                Total Space Used
              </Text>
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "800",
                  color: colors.primary,
                }}
              >
                {storageStats.totalSize} MB
              </Text>
            </View>

            {/* Actions Grid */}
            <View style={{ gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                style={{
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: colors.primaryGlow,
                  justifyContent: "center",
                  alignItems: "center",
                  flexDirection: "row",
                  gap: 8,
                  borderWidth: 1,
                  borderColor: colors.primary,
                }}
                onPress={handleSmartCleanup}
                disabled={isCleaning}
                activeOpacity={0.8}
              >
                {isCleaning ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={colors.primary}
                      strokeWidth="2.5"
                    >
                      <Path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                      <Path d="m9 12 2 2 4-4" />
                    </Svg>
                    <Text
                      style={{
                        color: colors.primary,
                        fontWeight: "600",
                        fontSize: 15,
                      }}
                    >
                      Run Smart Cleanup
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: colors.primary,
                  justifyContent: "center",
                  alignItems: "center",
                  flexDirection: "row",
                  gap: 8,
                }}
                onPress={handleCloudBackup}
                disabled={isBackingUp}
                activeOpacity={0.85}
              >
                {isBackingUp ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2.5"
                    >
                      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <Polyline points="17 8 12 3 7 8" />
                      <Line x1="12" y1="3" x2="12" y2="15" />
                    </Svg>
                    <Text
                      style={{
                        color: "white",
                        fontWeight: "600",
                        fontSize: 15,
                      }}
                    >
                      Backup Data to Cloud
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: "rgba(239, 68, 68, 0.08)",
                  justifyContent: "center",
                  alignItems: "center",
                  flexDirection: "row",
                  gap: 8,
                  borderWidth: 1,
                  borderColor: colors.danger,
                }}
                onPress={handleClearAll}
                activeOpacity={0.8}
              >
                <Svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={colors.danger}
                  strokeWidth="2.5"
                >
                  <Path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </Svg>
                <Text
                  style={{
                    color: colors.danger,
                    fontWeight: "600",
                    fontSize: 15,
                  }}
                >
                  Clear Database & Media
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: "rgba(127, 29, 29, 0.14)",
                  justifyContent: "center",
                  alignItems: "center",
                  flexDirection: "row",
                  gap: 8,
                  borderWidth: 1,
                  borderColor: "rgba(239, 68, 68, 0.75)",
                }}
                onPress={handleStartDeleteAccount}
                activeOpacity={0.8}
              >
                <Svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={colors.danger}
                  strokeWidth="2.5"
                >
                  <Path d="M3 6h18M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />
                </Svg>
                <Text
                  style={{
                    color: colors.danger,
                    fontWeight: "700",
                    fontSize: 15,
                  }}
                >
                  Delete Account
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: "rgba(239, 68, 68, 0.08)",
                  justifyContent: "center",
                  alignItems: "center",
                  flexDirection: "row",
                  gap: 8,
                  borderWidth: 1,
                  borderColor: colors.danger,
                }}
                onPress={handleLogout}
                activeOpacity={0.8}
              >
                <Svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={colors.danger}
                  strokeWidth="2.5"
                >
                  <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <Polyline points="16 17 21 12 16 7" />
                  <Line x1="21" y1="12" x2="9" y2="12" />
                </Svg>
                <Text
                  style={{
                    color: colors.danger,
                    fontWeight: "600",
                    fontSize: 15,
                  }}
                >
                  Log Out
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Text style={[styles.footerText, { color: colors.success }]}>
          All changes are saved automatically
        </Text>
      </ScrollView>

      <UserProfilePopup
        visible={profilePopupVisible}
        profile={profilePopupData}
        onClose={() => setProfilePopupVisible(false)}
        colors={colors}
        getLangDetails={getLangDetails}
      />

      {/* ================= MODALS ================= */}

      <Modal
        animationType="fade"
        transparent={true}
        visible={isDeleteModalVisible}
        onRequestClose={() => {
          setIsDeleteModalVisible(false);
          setDeleteCode("");
          setDeleteCodeInput("");
        }}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: colors.cardBg }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Delete Account
              </Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => {
                  setIsDeleteModalVisible(false);
                  setDeleteCode("");
                  setDeleteCodeInput("");
                }}
              >
                <Text
                  style={[styles.modalCloseText, { color: colors.textMuted }]}
                >
                  &times;
                </Text>
              </TouchableOpacity>
            </View>

            <View
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.08)",
                borderColor: "rgba(239, 68, 68, 0.18)",
                borderWidth: 1,
                borderRadius: 16,
                padding: 14,
                marginBottom: 14,
                gap: 8,
              }}
            >
              <Text
                style={{
                  color: colors.danger,
                  fontWeight: "700",
                  fontSize: 15,
                }}
              >
                This permanently wipes the app on this phone.
              </Text>
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 13,
                  lineHeight: 19,
                }}
              >
                We send a confirmation code to {currentUser.email} before
                removing your profile, chats, contacts, media cache, and stored
                settings.
              </Text>
            </View>

            <TouchableOpacity
              style={{
                height: 46,
                borderRadius: 12,
                backgroundColor: colors.primary,
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 12,
              }}
              onPress={() => {
                const nextCode = generateDeletionCode();
                setDeleteCode(nextCode);
                setDeleteCodeInput("");
                openDeletionEmail(nextCode).catch((error) => {
                  console.error("Failed to open deletion email", error);
                });
              }}
              activeOpacity={0.85}
            >
              <Text style={{ color: "white", fontWeight: "700" }}>
                Send confirmation email
              </Text>
            </TouchableOpacity>

            <TextInput
              value={deleteCodeInput}
              onChangeText={setDeleteCodeInput}
              placeholder="Enter the 6-digit code"
              placeholderTextColor={colors.textDimmed}
              keyboardType="number-pad"
              style={[
                styles.inputField,
                {
                  backgroundColor: colors.bg,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              maxLength={6}
            />

            <TouchableOpacity
              style={{
                height: 46,
                borderRadius: 12,
                backgroundColor: "rgba(239, 68, 68, 0.08)",
                justifyContent: "center",
                alignItems: "center",
                marginTop: 12,
                borderWidth: 1,
                borderColor: colors.danger,
              }}
              onPress={handleConfirmDeleteAccount}
              disabled={isDeletingAccount || deleteCode.length === 0}
              activeOpacity={0.85}
            >
              {isDeletingAccount ? (
                <ActivityIndicator color={colors.danger} />
              ) : (
                <Text style={{ color: colors.danger, fontWeight: "700" }}>
                  Confirm and wipe this phone
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Image Source Selection (WhatsApp Style Bottom Sheet) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isImageSourceModalVisible}
        onRequestClose={() => setIsImageSourceModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { justifyContent: "flex-end" }]}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.cardBg,
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                paddingBottom: 40,
              },
            ]}
          >
            <Text
              style={[
                styles.modalTitle,
                { color: colors.text, marginBottom: 24 },
              ]}
            >
              Profile photo
            </Text>

            <View
              style={{
                flexDirection: "row",
                gap: 30,
                justifyContent: "flex-start",
                paddingHorizontal: 10,
              }}
            >
              <TouchableOpacity
                style={{ alignItems: "center", gap: 8 }}
                onPress={takePhoto}
                activeOpacity={0.7}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: "rgba(79, 70, 229, 0.1)",
                    justifyContent: "center",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: "rgba(79, 70, 229, 0.2)",
                  }}
                >
                  <Svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.primary}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <Circle cx="12" cy="13" r="4" />
                  </Svg>
                </View>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 13,
                    fontWeight: "500",
                  }}
                >
                  Camera
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ alignItems: "center", gap: 8 }}
                onPress={openGallery}
                activeOpacity={0.7}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: "rgba(79, 70, 229, 0.1)",
                    justifyContent: "center",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: "rgba(79, 70, 229, 0.2)",
                  }}
                >
                  <Svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.primary}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <Circle cx="8.5" cy="8.5" r="1.5" />
                    <Polyline points="21 15 16 10 5 21" />
                  </Svg>
                </View>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 13,
                    fontWeight: "500",
                  }}
                >
                  Gallery
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={{ position: "absolute", top: 16, right: 16, padding: 8 }}
              onPress={() => setIsImageSourceModalVisible(false)}
            >
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 24,
                  fontWeight: "300",
                }}
              >
                &times;
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal 1: Native Language Selection (Popup of 20) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isNativeLangModalVisible}
        onRequestClose={() => setIsNativeLangModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: colors.cardBg }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Select Native Language
              </Text>
              <TouchableOpacity
                onPress={() => setIsNativeLangModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={[styles.modalCloseText, { color: colors.text }]}>
                  &times;
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
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
                        isSelected && {
                          backgroundColor: colors.primaryGlow,
                          borderColor: colors.primary,
                        },
                      ]}
                      onPress={() => selectNativeLang(code)}
                    >
                      <Text style={styles.modalGridItemFlag}>{lang.flag}</Text>
                      <Text
                        style={[
                          styles.modalGridItemText,
                          { color: colors.text },
                          isSelected && {
                            fontWeight: "700",
                            color: colors.primary,
                          },
                        ]}
                        numberOfLines={1}
                      >
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
          <View
            style={[styles.modalContent, { backgroundColor: colors.cardBg }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Target Languages
              </Text>
              <TouchableOpacity
                onPress={() => setIsSecondaryLangModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={[styles.modalCloseText, { color: colors.text }]}>
                  &times;
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
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
                        isChecked && {
                          backgroundColor: colors.primaryGlow,
                          borderColor: colors.primary,
                        },
                      ]}
                      onPress={() => toggleSecondaryLang(code)}
                    >
                      <View style={styles.checkboxContainer}>
                        <Text style={styles.modalGridItemFlag}>
                          {lang.flag}
                        </Text>
                        {isChecked && (
                          <View
                            style={[
                              styles.checkboxBadge,
                              { backgroundColor: colors.primary },
                            ]}
                          >
                            <Text style={styles.checkboxBadgeText}>✓</Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.modalGridItemText,
                          { color: colors.text },
                          isChecked && {
                            fontWeight: "700",
                            color: colors.primary,
                          },
                        ]}
                        numberOfLines={1}
                      >
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
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.cardBg, maxHeight: "85%" },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Voice AI Training
              </Text>
              <TouchableOpacity
                onPress={() => setIsTrainingModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={[styles.modalCloseText, { color: colors.text }]}>
                  &times;
                </Text>
              </TouchableOpacity>
            </View>

            {trainingProgress < 100 ||
            trainingStep < trainingSentences.length - 1 ? (
              <View style={styles.trainingBody}>
                <Text style={[styles.trainingSub, { color: colors.textMuted }]}>
                  Sentence {trainingStep + 1} of {trainingSentences.length}
                </Text>

                {/* Sentence Reading Card */}
                <View
                  style={[
                    styles.sentenceCard,
                    { backgroundColor: colors.bg, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.sentenceText, { color: colors.text }]}>
                    {`"${trainingSentences[trainingStep]}"`}
                  </Text>
                </View>

                {/* Progress Bar */}
                <View style={styles.trainingProgressWrapper}>
                  <View style={styles.progressHeader}>
                    <Text
                      style={[
                        styles.progressLabel,
                        { color: colors.textMuted },
                      ]}
                    >
                      Recording Speech
                    </Text>
                    <Text
                      style={[styles.progressPct, { color: colors.primary }]}
                    >
                      {trainingProgress}%
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.progressBarBg,
                      {
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.08)"
                          : "rgba(0,0,0,0.06)",
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          backgroundColor: colors.primary,
                          width: `${trainingProgress}%`,
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Hold to Speak CTA Button */}
                <View style={styles.recordActionContainer}>
                  <TouchableOpacity
                    style={[
                      styles.recordHoldBtn,
                      { backgroundColor: colors.primary },
                      isRecording && {
                        backgroundColor: colors.danger,
                        transform: [{ scale: 1.05 }],
                      },
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
                  <Text
                    style={[styles.recordHint, { color: colors.textDimmed }]}
                  >
                    {isRecording
                      ? "Release to pause"
                      : "Press and hold to read aloud"}
                  </Text>
                </View>
              </View>
            ) : (
              // Success Screen when complete
              <View style={styles.successBody}>
                <View
                  style={[
                    styles.successIconOuter,
                    { backgroundColor: colors.success + "20" },
                  ]}
                >
                  <Text
                    style={[styles.successIconText, { color: colors.success }]}
                  >
                    ✓
                  </Text>
                </View>
                <Text style={[styles.successTitle, { color: colors.text }]}>
                  Voice Training Complete!
                </Text>
                <Text style={[styles.successDesc, { color: colors.textMuted }]}>
                  Your voice clone is fully trained and ready to translate.
                </Text>
                <TouchableOpacity
                  style={[
                    styles.successDoneBtn,
                    { backgroundColor: colors.success },
                  ]}
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
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.cardBg, maxHeight: "85%" },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Test Voice Clone
              </Text>
              <TouchableOpacity
                onPress={() => setIsTestingModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={[styles.modalCloseText, { color: colors.text }]}>
                  &times;
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.testIntro, { color: colors.textMuted }]}>
              Hear how your voice sounds in other languages! Tap play next to
              any target translation.
            </Text>

            <ScrollView
              contentContainerStyle={styles.testList}
              showsVerticalScrollIndicator={false}
            >
              {[
                {
                  code: "zh",
                  name: "Chinese",
                  flag: "🇨🇳",
                  phrase: "你好，很高兴今天能和你说话！",
                },
                {
                  code: "ar",
                  name: "Arabic",
                  flag: "🇸🇦",
                  phrase: "مرحباً، من الرائع التحدث إليك اليوم!",
                },
                {
                  code: "es",
                  name: "Spanish",
                  flag: "🇪🇸",
                  phrase: "Hola, es genial hablar contigo hoy!",
                },
                {
                  code: "fr",
                  name: "French",
                  flag: "🇫🇷",
                  phrase: "Bonjour, c'est génial de vous parler aujourd'hui !",
                },
                {
                  code: "ja",
                  name: "Japanese",
                  flag: "🇯🇵",
                  phrase: "こんにちは、今日はお話しできて光栄です！",
                },
                {
                  code: "sw",
                  name: "Swahili",
                  flag: "🇰🇪",
                  phrase: "Habari, ni vyema kuzungumza nawe leo!",
                },
              ].map((item) => {
                const isPlaying = playingLang === item.code;
                return (
                  <View
                    key={item.code}
                    style={[
                      styles.testItemCard,
                      {
                        backgroundColor: colors.bg,
                        borderColor: colors.border,
                      },
                      isPlaying && { borderColor: colors.primary },
                    ]}
                  >
                    <View style={styles.testItemHeader}>
                      <View style={styles.testItemLang}>
                        <Text style={styles.testItemFlag}>{item.flag}</Text>
                        <Text
                          style={[styles.testItemName, { color: colors.text }]}
                        >
                          {item.name}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.testPlayBtn,
                          {
                            backgroundColor: isPlaying
                              ? colors.danger
                              : colors.primary,
                          },
                        ]}
                        onPress={() => handlePlayVoice(item.code)}
                        disabled={playingLang !== null && !isPlaying}
                      >
                        {isPlaying ? (
                          // Stop / Pause icon
                          <Svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="white"
                          >
                            <Path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                          </Svg>
                        ) : (
                          // Play icon
                          <Svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="white"
                          >
                            <Path d="M8 5v14l11-7z" />
                          </Svg>
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Speech Text and Waveform visualizer */}
                    <View style={styles.testItemContent}>
                      <Text
                        style={[
                          styles.testItemPhrase,
                          { color: colors.textDimmed },
                        ]}
                      >
                        {item.phrase}
                      </Text>

                      {isPlaying && (
                        <View style={styles.visualizerRow}>
                          {[...Array(12)].map((_, i) => {
                            // Generate heights for animated pulse feel
                            const randomHeight =
                              Math.floor(
                                Math.sin((playProgress + i * 2) * 0.5) * 10,
                              ) + 16;
                            return (
                              <View
                                key={i}
                                style={[
                                  styles.visualizerBar,
                                  {
                                    backgroundColor: colors.accent,
                                    height: randomHeight,
                                  },
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

      {/* Unity AI Lang Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isUnityAILangModalVisible}
        onRequestClose={() => setIsUnityAILangModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.cardBg, maxHeight: "75%" },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                AI Companion Language
              </Text>
              <TouchableOpacity
                onPress={() => setIsUnityAILangModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={[styles.modalCloseText, { color: colors.text }]}>
                  &times;
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalGrid}>
                {Object.keys(LANGS).map((code) => {
                  const lang = LANGS[code];
                  const isChecked = currentUser.unityAILang === code;
                  return (
                    <TouchableOpacity
                      key={code}
                      style={[
                        styles.modalGridItem,
                        { borderColor: colors.border },
                        isChecked && {
                          backgroundColor: colors.primaryGlow,
                          borderColor: colors.primary,
                        },
                      ]}
                      onPress={() => selectUnityAILang(code)}
                    >
                      <View style={styles.checkboxContainer}>
                        <Text style={styles.modalGridItemFlag}>
                          {lang.flag}
                        </Text>
                        {isChecked && (
                          <View
                            style={[
                              styles.checkboxBadge,
                              { backgroundColor: colors.primary },
                            ]}
                          >
                            <Text style={styles.checkboxBadgeText}>✓</Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.modalGridItemText,
                          { color: colors.text },
                          isChecked && {
                            fontWeight: "700",
                            color: colors.primary,
                          },
                        ]}
                        numberOfLines={1}
                      >
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSafeArea: {
    width: "100%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 28,
    lineHeight: 28,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  saveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  saveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  saveText: {
    fontSize: 11,
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 48,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  avatarPreviewContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    padding: 3,
    marginBottom: 16,
  },
  avatarPreview: {
    flex: 1,
    width: "100%",
    height: "100%",
    borderRadius: 42,
    borderWidth: 3,
  },
  editIconBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  presetsWrapper: {
    flexDirection: "row",
    gap: 12,
  },
  presetTouchTarget: {
    padding: 2,
  },
  presetItem: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
  },
  formGroup: {
    marginBottom: 24,
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  inputField: {
    width: "100%",
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  langPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pillItem: {
    borderWidth: 1,
    borderRadius: 30,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "500",
  },
  voiceAICard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  voiceAIRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  voiceAIBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  voiceAIBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
  voiceAITicketText: {
    fontWeight: "700",
  },
  voiceAIDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  micTestCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  micTestControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  testMicBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  testMicText: {
    color: "white",
    fontSize: 13,
    fontWeight: "600",
  },
  micLevelMeterContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    flex: 1,
    height: 42,
    justifyContent: "space-between",
    paddingLeft: 8,
  },
  micLevelTrack: {
    width: 5,
    height: 42,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  micPeakDot: {
    width: 5,
    height: 2,
    borderRadius: 1,
    marginBottom: 2,
  },
  micLevelBox: {
    width: 5,
    minHeight: 4,
    borderRadius: 2.5,
  },
  micTestDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  toggleList: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  toggleItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  footerText: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 8,
  },

  // Modals Styling
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(10, 6, 18, 0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    maxHeight: "80%",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 28,
    lineHeight: 28,
  },
  modalScroll: {
    paddingBottom: 12,
  },
  modalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  modalGridItem: {
    width: "48%",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  modalGridItemFlag: {
    fontSize: 22,
  },
  modalGridItemText: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  checkboxContainer: {
    position: "relative",
  },
  checkboxBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxBadgeText: {
    color: "white",
    fontSize: 9,
    fontWeight: "700",
  },
  modalDoneBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 16,
  },
  modalDoneBtnText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },

  // Voice Training Modal styles
  trainingBody: {
    gap: 18,
    alignItems: "center",
  },
  trainingSub: {
    fontSize: 13,
    fontWeight: "600",
  },
  sentenceCard: {
    width: "100%",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  sentenceText: {
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 24,
  },
  trainingProgressWrapper: {
    width: "100%",
    gap: 6,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  progressPct: {
    fontSize: 13,
    fontWeight: "700",
  },
  progressBarBg: {
    width: "100%",
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 5,
  },
  recordActionContainer: {
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  recordHoldBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  recordHint: {
    fontSize: 12,
    fontWeight: "500",
  },
  successBody: {
    alignItems: "center",
    paddingVertical: 12,
    gap: 16,
  },
  successIconOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  successIconText: {
    fontSize: 32,
    fontWeight: "700",
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  successDesc: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  successDoneBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  successDoneText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },

  // Test Clone Modal styles
  testIntro: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  testList: {
    gap: 12,
    paddingBottom: 16,
  },
  testItemCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  testItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  testItemLang: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  testItemFlag: {
    fontSize: 22,
  },
  testItemName: {
    fontSize: 14,
    fontWeight: "600",
  },
  testPlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  testItemContent: {
    gap: 8,
  },
  testItemPhrase: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: "italic",
  },
  visualizerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 28,
    marginTop: 6,
  },
  visualizerBar: {
    width: 3,
    borderRadius: 1.5,
    minHeight: 4,
  },
  glowSection: {
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 3,
  },
});
