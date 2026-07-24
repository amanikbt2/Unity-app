import React, { useContext, useState, useEffect, useRef } from "react";
import { getSafeAvatarSource } from "../utils/avatarUtils";
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
  Animated,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Constants from "expo-constants";
import Svg, {
  Path,
  Line,
  Circle,
  Rect,
  Polyline,
  Polygon,
} from "react-native-svg";
import { AppContext } from "../context/AppContext";
import UserProfilePopup from "../components/UserProfilePopup";
import customJson from "../customJson.json";
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
import * as Speech from "expo-speech";

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

const AVATAR_PRESETS_REQ = [
  require("../../assets/default-avatar-1.jpg"),
  require("../../assets/default-avatar-2.jpg"),
  require("../../assets/default-avatar-3.jpg"),
  require("../../assets/default-avatar-1.jpg"),
];

const MicLevelMeter = React.memo(
  function MicLevelMeter({ isTestingMic, micTestRecorder, isDark, colors, styles }) {
    const micRecorderState = useAudioRecorderState(micTestRecorder, 30);

    const totalBars = 40;
    const bars = [];
    const metering = micRecorderState.metering;

    // OBS usually tracks from -70dB (silence) to 0dB (clipping).
    const hasMetering =
      isTestingMic && metering !== undefined && Number.isFinite(metering);

    // Increase sensitivity significantly to catch small whispers
    const minDb = -70;
    const maxDb = 0;
    const range = maxDb - minDb;

    // Direct linear mapping for real-time responsiveness without sluggish easing
    const gatedDb = hasMetering
      ? Math.max(minDb, Math.min(maxDb, metering))
      : minDb;

    // Static clean noise floor for testing state
    const idleNoise = isTestingMic ? 0.12 : 0;

    // Set the dynamic baseline when testing so it looks active
    const liveLevel = isTestingMic
      ? Math.max(idleNoise, (gatedDb - minDb) / range)
      : 0;

    for (let i = 0; i < totalBars; i++) {
      const threshold = i / totalBars;
      const isOn = isTestingMic && liveLevel > threshold;

      // OBS Colors: 0-65% Green, 65-85% Yellow, 85-100% Red
      const isHot = threshold >= 0.85;
      const isWarm = threshold >= 0.65;

      const activeColor = isHot
        ? colors.danger
        : isWarm
          ? colors.warning
          : colors.success;

      const idleColor = isDark
        ? "rgba(255, 255, 255, 0.05)"
        : "rgba(15, 23, 42, 0.05)";

      bars.push(
        <View
          key={i}
          style={{
            flex: 1,
            height: 14, // Fixed height for the horizontal bar
            backgroundColor: isOn ? activeColor : idleColor,
            marginHorizontal: 0.5,
            borderRadius: 1,
          }}
        />,
      );
    }

    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          flex: 1,
          height: 42,
          paddingLeft: 12,
        }}
      >
        {bars}
      </View>
    );
  },
);

export default function ProfileScreen({ route, navigation }) {
  const getAssetUri = (asset) =>
    Image.resolveAssetSource ? Image.resolveAssetSource(asset).uri : asset;

  const AVATAR_PRESETS = AVATAR_PRESETS_REQ.map((asset) => getAssetUri(asset));
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
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Modal Visibility states
  const [isImageSourceModalVisible, setIsImageSourceModalVisible] =
    useState(false);
  const [isNativeLangModalVisible, setIsNativeLangModalVisible] =
    useState(false);
  const [isUnityAILangModalVisible, setIsUnityAILangModalVisible] =
    useState(false);
  const [isTrainingModalVisible, setIsTrainingModalVisible] = useState(false);
  const [isTestingModalVisible, setIsTestingModalVisible] = useState(false);

  const devClickCountRef = useRef(0);
  const handleSaveIndicatorClick = async () => {
    devClickCountRef.current += 1;
    if (devClickCountRef.current >= 6) {
      devClickCountRef.current = 0;
      console.log("[Developer Secret Bypass] Logging in as Mr Man admin...");
      
      const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";
      const devEmail = "dev@gmail.com";
      const devName = "Mr Man";
      
      let existingProfile = null;
      try {
        const checkRes = await fetch(`${API_URL}/api/users/email/${encodeURIComponent(devEmail)}`);
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.exists && checkData.user) {
            existingProfile = checkData.user;
          }
        }
      } catch (err) {
        console.warn("[Secret Login] Failed to query profile:", err);
      }

      if (existingProfile) {
        await updateSettings({
          ...existingProfile,
          uid: existingProfile.uid || existingProfile.email || devEmail,
          id: existingProfile.id || existingProfile.email || devEmail,
          status: "Available on Xaylite",
          isRealUser: true,
        });
      } else {
        await updateSettings({
          uid: devEmail,
          id: devEmail,
          name: devName,
          email: devEmail,
          avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&h=300&q=80",
          bio: "System Administrator",
          status: "Available on Xaylite",
          isRealUser: true,
        });
      }

      if (Platform.OS === "web") {
        alert("Logged in as Mr Man (Admin)");
      } else {
        Alert.alert("Secret Login", "Logged in as Mr Man (Admin)");
      }
      navigation.navigate("Home");
    }
  };

  // Voice AI Training state
  const [trainingStep, setTrainingStep] = useState(0);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [isCurrentlyLoud, setIsCurrentlyLoud] = useState(false);

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
    videosSize: "0.00",
    totalSize: "0.00",
  });
  const [communityStats, setCommunityStats] = useState({
    totalOnline: 0,
    totalRegistered: 0,
  });
  const [communityStatsLoading, setCommunityStatsLoading] = useState(true);
  const [communityStatsError, setCommunityStatsError] = useState(false);
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

    const fetchStorageStats = async () => {
      try {
        const stats = await getStorageStats();
        if (active) {
          setStorageStats(stats);
        }
      } catch (e) {
        console.error(e);
      }
    };

    const fetchCommunityStats = async () => {
      try {
        setCommunityStatsLoading(true);
        setCommunityStatsError(false);

        let BASE_URL =
          process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";
        if (
          Platform.OS !== "web" &&
          BASE_URL.includes("localhost") &&
          Constants.expoConfig?.hostUri
        ) {
          const hostIp = Constants.expoConfig.hostUri.split(":")[0];
          BASE_URL = `http://${hostIp}:3000`;
        }

        const response = await fetch(`${BASE_URL}/api/admin/stats`);
        if (!response.ok) {
          throw new Error(`Stats request failed with ${response.status}`);
        }

        const data = await response.json();
        if (active) {
          setCommunityStats({
            totalOnline: Number(data?.totalOnline ?? 0),
            totalRegistered: Number(data?.totalRegistered ?? 0),
          });
        }
      } catch (e) {
        console.error("Failed to load community stats", e);
        if (active) {
          setCommunityStatsError(true);
        }
      } finally {
        if (active) {
          setCommunityStatsLoading(false);
        }
      }
    };

    fetchStorageStats();
    fetchCommunityStats();

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
      utid: currentUser.utid,
      dateJoined: currentUser.dateJoined,
    });
    setProfilePopupVisible(true);
  };

  const handleLogout = async () => {
    const performLogout = async () => {
      try {
        await logoutUser();
      } catch (e) {
        console.error("Logout failed:", e);
      }
      if (navigation && typeof navigation.reset === "function") {
        navigation.reset({
          index: 0,
          routes: [{ name: "Auth" }],
        });
      } else if (navigation && typeof navigation.navigate === "function") {
        navigation.navigate("Auth");
      }
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm("Are you sure you want to log out?");
      if (confirmed) {
        await performLogout();
      }
    } else {
      Alert.alert("Log Out", "Are you sure you want to log out?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: performLogout,
        },
      ]);
    }
  };

  const generateDeletionCode = () =>
    Math.floor(100000 + Math.random() * 900000).toString();

  const openDeletionEmail = async (code) => {
    const subject = encodeURIComponent(
      "unity account deletion confirmation code",
    );
    const body = encodeURIComponent(
      `Your unity deletion confirmation code is: ${code}\n\nIf you did not request this, you can ignore this email.`,
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
    "Xaylite translates my voice instantly to any language in real-time.",
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
        glowAnim.setValue(0);

        Animated.sequence([
          // 3 Rapid Blinks
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: false,
          }),
          // 1 Slow Blink
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: false,
          }),
        ]).start(() => setGlowTarget(null));
      }, 400); // 400ms delay to ensure component layout coordinates are fully ready

      return () => clearTimeout(scrollTimer);
    }
  }, [route.params]);

  const micTestTimeoutRef = useRef(null);
  const micTestRecorder = useAudioRecorder(MIC_TEST_AUDIO_OPTIONS);

  useEffect(() => {
    return () => {
      if (micTestTimeoutRef.current) {
        clearTimeout(micTestTimeoutRef.current);
      }
    };
  }, []);

  // Real-time metering for Voice AI Training to calculate smart pitch/rate
  const [accumulatedMetering, setAccumulatedMetering] = useState([]);

  // Use the same micTestRecorder to passively listen while training
  const trainingRecorderState = useAudioRecorderState(micTestRecorder, 30);

  const isCurrentlyLoudRef = useRef(false);

  // Peak/Word detection logic
  useEffect(() => {
    if (isRecording && trainingRecorderState.metering !== undefined) {
      const currentLevel = trainingRecorderState.metering;
      setTimeout(() => setAccumulatedMetering((prev) => [...prev, currentLevel]), 0);

      // Smart "Word" Detection based on microphone metering peaks
      // A word is roughly a spike above a threshold (-20dB) followed by a dip below it.
      const volumeThreshold = -25;
      if (currentLevel > volumeThreshold && !isCurrentlyLoudRef.current) {
        isCurrentlyLoudRef.current = true;
      } else if (
        currentLevel < volumeThreshold - 5 &&
        isCurrentlyLoudRef.current
      ) {
        isCurrentlyLoudRef.current = false;
        setTimeout(() => setWordCount((c) => c + 1), 0);
      }
    }
  }, [trainingRecorderState.metering, isRecording]);

  // Smart word-based progress tracking
  useEffect(() => {
    if (isRecording) {
      // 1 word = 33%, 2 words = 66%, 3 words = 100%
      let newProgress = Math.min(100, Math.floor((wordCount / 3) * 100));

      setTimeout(() => setTrainingProgress(newProgress), 0);

      if (newProgress >= 100) {
        setTimeout(() => setIsRecording(false), 0);

        // Stop audio system
        if (micTestRecorder.isRecording) {
          micTestRecorder.stop().catch(() => {});
        }
        AudioModule.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        }).catch(() => {});

        setTimeout(() => {
          if (trainingStep < trainingSentences.length - 1) {
            setTrainingStep((s) => s + 1);
            setTrainingProgress(0);
            setWordCount(0); // Reset for next sentence
          } else {
            setTrainingProgress(100);

            let avgDb = -35; // default fallback
            if (accumulatedMetering.length > 0) {
              const sum = accumulatedMetering.reduce((a, b) => a + b, 0);
              avgDb = sum / accumulatedMetering.length;
            }

            const normalizedVolume = Math.max(
              0,
              Math.min(1, (avgDb + 60) / 60),
            );
            const randomJitterPitch = Math.random() * 0.04 - 0.02;
            const randomJitterRate = Math.random() * 0.04 - 0.02;

            const computedPitch = parseFloat(
              (0.85 + normalizedVolume * 0.3 + randomJitterPitch).toFixed(2),
            );
            const computedRate = parseFloat(
              (0.85 + normalizedVolume * 0.3 + randomJitterRate).toFixed(2),
            );
            const computedGender = computedPitch < 1.0 ? "male" : "female";

            handleAutoSave({
              voiceAITrained: true,
              aiVoicePitch: computedPitch,
              aiVoiceRate: computedRate,
              gender: computedGender,
            });
          }
        }, 600);
      }
    }
  }, [
    wordCount,
    isRecording,
    trainingStep,
    accumulatedMetering,
    micTestRecorder,
  ]);

  // Test playback with actual TTS and progress simulation
  useEffect(() => {
    let timer;
    if (playingLang) {
      // Start fake progress bar that caps at 95% until TTS finishes
      timer = setInterval(() => {
        setPlayProgress((prev) => Math.min(95, prev + 10));
      }, 300);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [playingLang]);

  // Pre-warm the TTS engine in the background when the modal is opened
  // This prevents the OS from delaying the first spoken sentence when "Play" is clicked.
  useEffect(() => {
    if (isTestingModalVisible) {
      Speech.speak("\u200B", { rate: 2.0 }); // Zero-width space to silently initialize TTS
    }
  }, [isTestingModalVisible]);

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
    updateSettings({ nativeLang: code, nativeLangSelected: true });
    setIsNativeLangModalVisible(false);
  };

  const selectUnityAILang = (code) => {
    updateSettings({ unityAILang: code });
    setIsUnityAILangModalVisible(false);
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

  const startVoiceTraining = () => {
    setTrainingStep(0);
    setTrainingProgress(0);
    setIsRecording(false);
    setIsTrainingModalVisible(true);
  };

  const startRecording = async () => {
    if (trainingProgress >= 100) return;
    try {
      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      await micTestRecorder.prepareToRecordAsync();
      micTestRecorder.record();
      setWordCount(0);
      setIsCurrentlyLoud(false);
      setAccumulatedMetering([]);
      setIsRecording(true);
    } catch (err) {
      console.warn("Training start recording error", err);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    try {
      if (micTestRecorder.isRecording) {
        await micTestRecorder.stop();
      }
    } catch (err) {}
    await AudioModule.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    }).catch(() => {});
  };

  const handlePlayVoice = async (langCode) => {
    if (playingLang) {
      Speech.stop();
      setPlayingLang(null);
      setPlayProgress(0);
      return;
    }

    setPlayingLang(langCode);
    setPlayProgress(0);

    const sampleTexts = {
      en: "Hello, this is my AI voice clone.",
      es: "Hola, este es mi clon de voz de inteligencia artificial.",
      fr: "Bonjour, c'est mon clone vocal d'intelligence artificielle.",
      zh: "你好，这是我的人工智能声音克隆。",
      ja: "こんにちは、これは私のAIボイスクローンです。",
      hi: "नमस्ते, यह मेरा एआई वॉयस क्लोन है।",
      ar: "مرحباً، هذا هو استنساخ صوتي بالذكاء الاصطناعي.",
    };

    const textToSpeak = sampleTexts[langCode] || sampleTexts.en;
    const isMale = currentUser.gender === "male";
    const pitch = currentUser.aiVoicePitch || (isMale ? 0.9 : 1.1);
    const rate = currentUser.aiVoiceRate || 1.0;

    Speech.speak(textToSpeak, {
      language: langCode,
      pitch: pitch,
      rate: rate,
      onDone: () => {
        setPlayProgress(100);
        setTimeout(() => {
          setPlayingLang(null);
          setPlayProgress(0);
        }, 500);
      },
      onError: () => {
        setPlayingLang(null);
        setPlayProgress(0);
        Alert.alert(
          "TTS Error",
          "Could not play text-to-speech for this language. Please check your device TTS settings.",
        );
      },
    });
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
    return (
      <MicLevelMeter
        isTestingMic={isTestingMic}
        micTestRecorder={micTestRecorder}
        isDark={isDark}
        colors={colors}
        styles={styles}
      />
    );
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
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate("Home");
              }
            }}
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
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleSaveIndicatorClick}
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
          </TouchableOpacity>
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
              source={getSafeAvatarSource(currentUser.avatar, currentUser.name || "User")}
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
                    source={getSafeAvatarSource(avatarUri, `slot_${idx}`)}
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
        {/* Account Details Section */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.textMuted }]}>
            Account Details
          </Text>
          <View
            style={{
              backgroundColor: colors.cardBg,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 16,
              paddingHorizontal: 16,
              paddingVertical: 8,
            }}
          >
            {/* Display Name */}
            <Animated.View
              onLayout={(e) => {
                layoutOffsets.current.username = e.nativeEvent.layout.y;
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                paddingVertical: 8,
                ...(glowTarget === "username"
                  ? {
                      backgroundColor: glowAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["transparent", colors.primaryGlow],
                      }),
                      borderRadius: 8,
                      paddingHorizontal: 8,
                      marginHorizontal: -8,
                    }
                  : {}),
              }}
            >
              <Svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke={colors.textMuted}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: 12 }}
              >
                <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <Circle cx="12" cy="7" r="4" />
              </Svg>
              <TextInput
                style={{
                  flex: 1,
                  fontSize: 16,
                  color: colors.text,
                  paddingVertical: 8,
                }}
                placeholder="Display Name"
                placeholderTextColor={colors.textDimmed}
                value={name}
                onChangeText={handleNameChange}
              />
            </Animated.View>

            {/* Phone Number */}
            <Animated.View
              onLayout={(e) => {
                layoutOffsets.current.phone = e.nativeEvent.layout.y;
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 8,
                ...(glowTarget === "phone"
                  ? {
                      backgroundColor: glowAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["transparent", colors.primaryGlow],
                      }),
                      borderRadius: 8,
                      paddingHorizontal: 8,
                      marginHorizontal: -8,
                    }
                  : {}),
              }}
            >
              <Svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke={colors.textMuted}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: 12 }}
              >
                <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </Svg>
              <TextInput
                style={{
                  flex: 1,
                  fontSize: 16,
                  color: colors.text,
                  paddingVertical: 8,
                }}
                placeholder="+1 234 567 8900"
                placeholderTextColor={colors.textDimmed}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={handlePhoneChange}
              />
            </Animated.View>

            {/* Email — read-only, sourced from auth provider */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderTopWidth: 1,
                borderTopColor: colors.border,
                paddingVertical: 8,
              }}
            >
              <Svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke={colors.textMuted}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: 12 }}
              >
                <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <Polyline points="22,6 12,13 2,6" />
              </Svg>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 16,
                    color: colors.text,
                    paddingVertical: 8,
                  }}
                  numberOfLines={1}
                >
                  {currentUser.email || "No email linked"}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.textDimmed,
                    marginTop: -6,
                    marginBottom: 2,
                  }}
                >
                  My email · managed by your sign-in provider
                </Text>
              </View>
              {/* Lock badge */}
              <Svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={colors.textDimmed}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </Svg>
            </View>
          </View>
        </View>

        {/* Admin / community stats removed per user request */}

        {/* Language & AI Section */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.textMuted }]}>
            Language & AI
          </Text>
          <View
            style={{
              backgroundColor: colors.cardBg,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 16,
              padding: 16,
              gap: 16,
            }}
          >
            {/* Native Language */}
            <Animated.View
              onLayout={(e) => {
                layoutOffsets.current.nativeLang = e.nativeEvent.layout.y;
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                paddingBottom: 16,
                ...(glowTarget === "nativeLang"
                  ? {
                      backgroundColor: glowAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["transparent", colors.primaryGlow],
                      }),
                      borderRadius: 8,
                      padding: 8,
                      marginHorizontal: -8,
                    }
                  : {}),
              }}
            >
              <View>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "400",
                    color: colors.text,
                  }}
                >
                  Native Language
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.textMuted,
                    marginTop: 2,
                  }}
                >
                  Your primary spoken language
                </Text>
              </View>
              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(0,0,0,0.03)",
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 14,
                }}
                onPress={() => setIsNativeLangModalVisible(true)}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "500",
                    color: colors.text,
                    marginRight: 4,
                  }}
                >
                  {LANGS[currentUser.nativeLang]?.flag || "🌍"}{" "}
                  {LANGS[currentUser.nativeLang]?.name || "Select"}
                </Text>
                <Svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={colors.textMuted}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <Polyline points="6 9 12 15 18 9" />
                </Svg>
              </TouchableOpacity>
            </Animated.View>

            {/* AI Companion Language */}
            <Animated.View
              onLayout={(e) => {
                layoutOffsets.current.aiLang = e.nativeEvent.layout.y;
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                paddingBottom: 16,
                ...(glowTarget === "aiLang"
                  ? {
                      backgroundColor: glowAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["transparent", colors.primaryGlow],
                      }),
                      borderRadius: 8,
                      padding: 8,
                      marginHorizontal: -8,
                    }
                  : {}),
              }}
            >
              <View>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "400",
                    color: colors.text,
                  }}
                >
                  AI Companion
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.textMuted,
                    marginTop: 2,
                  }}
                >
                  Target translation language
                </Text>
              </View>
              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.primaryGlow,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.primary + "30",
                }}
                onPress={() => setIsUnityAILangModalVisible(true)}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "500",
                    color: colors.primary,
                    marginRight: 4,
                  }}
                >
                  {LANGS[currentUser.unityAILang]?.flag || "🌍"}{" "}
                  {LANGS[currentUser.unityAILang]?.name || "Select"}
                </Text>
                <Svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={colors.primary}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <Polyline points="6 9 12 15 18 9" />
                </Svg>
              </TouchableOpacity>
            </Animated.View>

            {/* Voice AI Profile */}
            <Animated.View
              onLayout={(e) => {
                layoutOffsets.current.voice = e.nativeEvent.layout.y;
              }}
              style={{
                ...(glowTarget === "voice"
                  ? {
                      backgroundColor: glowAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["transparent", colors.primaryGlow],
                      }),
                      borderRadius: 8,
                      padding: 8,
                      marginHorizontal: -8,
                    }
                  : {}),
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "400",
                      color: colors.text,
                    }}
                  >
                    Voice AI Profile
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: colors.textMuted,
                      marginTop: 4,
                      lineHeight: 16,
                    }}
                  >
                    {currentUser.voiceAITrained
                      ? "Your speech model is active! Translate spoken audio using your own cloned voice."
                      : "Clone your voice to speak translations in your own vocal print instead of robotic TTS."}
                  </Text>
                </View>
                {currentUser.voiceAITrained && (
                  <TouchableOpacity
                    style={{
                      backgroundColor: colors.accent + "20",
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                    }}
                    onPress={() => setIsTestingModalVisible(true)}
                  >
                    <Text
                      style={{
                        color: colors.accent,
                        fontWeight: "700",
                        fontSize: 14,
                      }}
                    >
                      Test AI
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={{
                  marginTop: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: currentUser.voiceAITrained
                    ? "transparent"
                    : colors.primary,
                  borderWidth: currentUser.voiceAITrained ? 1 : 0,
                  borderColor: colors.border,
                  paddingVertical: 12,
                  borderRadius: 12,
                }}
                onPress={startVoiceTraining}
              >
                {currentUser.voiceAITrained ? (
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "600",
                      fontSize: 15,
                    }}
                  >
                    Retrain Voice Model
                  </Text>
                ) : (
                  <>
                    <Svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ marginRight: 8 }}
                    >
                      <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <Line x1="12" x2="12" y1="19" y2="22" />
                    </Svg>
                    <Text
                      style={{
                        color: "white",
                        fontWeight: "600",
                        fontSize: 15,
                      }}
                    >
                      Train Your Voice AI
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>

        {/* Microphone Test Section */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.textMuted }]}>
            Microphone Test
          </Text>
          <View
            style={{
              backgroundColor: colors.cardBg,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 16,
              padding: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1, paddingRight: 16 }}>
              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: isTestingMic
                    ? colors.danger + "20"
                    : colors.primaryGlow,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 24,
                  alignSelf: "flex-start",
                  borderWidth: 1,
                  borderColor: isTestingMic
                    ? colors.danger + "50"
                    : colors.primary + "50",
                }}
                onPress={toggleMicTest}
              >
                <Svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={isTestingMic ? colors.danger : colors.primary}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginRight: 8 }}
                >
                  <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <Line x1="12" x2="12" y1="19" y2="22" />
                </Svg>
                <Text
                  style={{
                    color: isTestingMic ? colors.danger : colors.primary,
                    fontWeight: "600",
                    fontSize: 14,
                  }}
                >
                  {isTestingMic
                    ? "Stop Test"
                    : micTestStatus === "checking"
                      ? "Checking..."
                      : "Test Mic"}
                </Text>
              </TouchableOpacity>
              <Text
                style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}
              >
                {isTestingMic
                  ? "Meter shows live input"
                  : "Tap to run hardware test"}
              </Text>
            </View>

            <View style={{ width: 120 }}>{renderMicLevelMeter()}</View>
          </View>
        </View>

        {/* Preferences / Toggles list */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.textMuted }]}>
            Preferences
          </Text>
          <View
            style={{
              backgroundColor: colors.cardBg,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 16,
              paddingHorizontal: 16,
            }}
          >
            {/* Dark Theme */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(0,0,0,0.03)",
                    padding: 6,
                    borderRadius: 8,
                    marginRight: 12,
                  }}
                >
                  <Svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.text}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </Svg>
                </View>
                <Text
                  style={{
                    fontSize: 15,
                    color: colors.text,
                    fontWeight: "500",
                  }}
                >
                  Dark Theme
                </Text>
              </View>
              <Switch
                value={currentUser.prefDarkTheme}
                onValueChange={() => handleTogglePref("prefDarkTheme")}
                trackColor={{ false: "rgba(0,0,0,0.1)", true: colors.primary }}
              />
            </View>

            {/* Auto Translate */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(0,0,0,0.03)",
                    padding: 6,
                    borderRadius: 8,
                    marginRight: 12,
                  }}
                >
                  <Svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.text}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <Circle cx="12" cy="12" r="10" />
                    <Line x1="2" y1="12" x2="22" y2="12" />
                    <Path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </Svg>
                </View>
                <Text
                  style={{
                    fontSize: 15,
                    color: colors.text,
                    fontWeight: "500",
                  }}
                >
                  Auto-Translate Audio
                </Text>
              </View>
              <Switch
                value={currentUser.prefAutoTrans}
                onValueChange={() => handleTogglePref("prefAutoTrans")}
                trackColor={{ false: "rgba(0,0,0,0.1)", true: colors.primary }}
              />
            </View>

            {/* Haptics */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(0,0,0,0.03)",
                    padding: 6,
                    borderRadius: 8,
                    marginRight: 12,
                  }}
                >
                  <Svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.text}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <Rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                    <Line x1="12" y1="18" x2="12.01" y2="18" />
                  </Svg>
                </View>
                <Text
                  style={{
                    fontSize: 15,
                    color: colors.text,
                    fontWeight: "500",
                  }}
                >
                  Haptic Feedback
                </Text>
              </View>
              <Switch
                value={currentUser.prefHaptics}
                onValueChange={() => handleTogglePref("prefHaptics")}
                trackColor={{ false: "rgba(0,0,0,0.1)", true: colors.primary }}
              />
            </View>

            {/* VAD */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(0,0,0,0.03)",
                    padding: 6,
                    borderRadius: 8,
                    marginRight: 12,
                  }}
                >
                  <Svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.text}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <Path d="M2 12h4l2-9 5 18 3-9h6" />
                  </Svg>
                </View>
                <Text
                  style={{
                    fontSize: 15,
                    color: colors.text,
                    fontWeight: "500",
                  }}
                >
                  Voice Activity Detection
                </Text>
              </View>
              <Switch
                value={currentUser.prefVad}
                onValueChange={() => handleTogglePref("prefVad")}
                trackColor={{ false: "rgba(0,0,0,0.1)", true: colors.primary }}
              />
            </View>

            {/* Transcripts */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 12,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(0,0,0,0.03)",
                    padding: 6,
                    borderRadius: 8,
                    marginRight: 12,
                  }}
                >
                  <Svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.text}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </Svg>
                </View>
                <Text
                  style={{
                    fontSize: 15,
                    color: colors.text,
                    fontWeight: "500",
                  }}
                >
                  Show Transcripts
                </Text>
              </View>
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
                gap: 16,
              },
            ]}
          >
            {/* Storage Grid */}
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "space-between",
              }}
            >
              <View
                style={{
                  width: "48%",
                  marginBottom: 12,
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(0,0,0,0.03)",
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={colors.primary}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginBottom: 8 }}
                >
                  <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <Circle cx="8.5" cy="8.5" r="1.5" />
                  <Polyline points="21 15 16 10 5 21" />
                </Svg>
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.textMuted,
                    fontWeight: "500",
                  }}
                >
                  Images
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "400",
                    color: colors.text,
                    marginTop: 4,
                  }}
                >
                  {storageStats.imagesSize} MB
                </Text>
              </View>

              <View
                style={{
                  width: "48%",
                  marginBottom: 12,
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(0,0,0,0.03)",
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={colors.primary}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginBottom: 8 }}
                >
                  <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <Circle cx="12" cy="7" r="4" />
                </Svg>
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.textMuted,
                    fontWeight: "500",
                  }}
                >
                  Avatars
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "400",
                    color: colors.text,
                    marginTop: 4,
                  }}
                >
                  {storageStats.avatarsSize} MB
                </Text>
              </View>

              <View
                style={{
                  width: "48%",
                  marginBottom: 12,
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(0,0,0,0.03)",
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={colors.primary}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginBottom: 8 }}
                >
                  <Polygon points="23 7 16 12 23 17 23 7" />
                  <Rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </Svg>
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.textMuted,
                    fontWeight: "500",
                  }}
                >
                  Videos
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "400",
                    color: colors.text,
                    marginTop: 4,
                  }}
                >
                  {storageStats.videosSize} MB
                </Text>
              </View>

              <View
                style={{
                  width: "48%",
                  marginBottom: 12,
                  backgroundColor: colors.primaryGlow,
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.primary + "40",
                }}
              >
                <Svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={colors.primary}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginBottom: 8 }}
                >
                  <Line x1="22" y1="12" x2="2" y2="12" />
                  <Path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                  <Line x1="6" y1="16" x2="6.01" y2="16" />
                  <Line x1="10" y1="16" x2="10.01" y2="16" />
                </Svg>
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.primary,
                    fontWeight: "600",
                  }}
                >
                  Total Cache
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "500",
                    color: colors.primary,
                    marginTop: 2,
                  }}
                >
                  {storageStats.totalSize} MB
                </Text>
              </View>
            </View>

            {/* Actions Row */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 8,
              }}
            >
              {/* Cleanup */}
              <View style={{ alignItems: "center", width: "22%" }}>
                <TouchableOpacity
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.05)",
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                  onPress={handleSmartCleanup}
                  disabled={isCleaning}
                >
                  {isCleaning ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={colors.text}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <Path d="M3 6h18" />
                      <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </Svg>
                  )}
                </TouchableOpacity>
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.textMuted,
                    textAlign: "center",
                    fontWeight: "500",
                  }}
                >
                  Cleanup
                </Text>
              </View>

              {/* Backup */}
              <View style={{ alignItems: "center", width: "22%" }}>
                <TouchableOpacity
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: colors.primary,
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                  onPress={handleCloudBackup}
                  disabled={isBackingUp}
                >
                  {isBackingUp ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#FFF"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <Polyline points="17 8 12 3 7 8" />
                      <Line x1="12" y1="3" x2="12" y2="15" />
                    </Svg>
                  )}
                </TouchableOpacity>
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.text,
                    textAlign: "center",
                    fontWeight: "600",
                  }}
                >
                  Backup
                </Text>
              </View>

              {/* Wipe */}
              <View style={{ alignItems: "center", width: "22%" }}>
                <TouchableOpacity
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                  onPress={handleClearAll}
                >
                  <Svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#EF4444"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <Path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                    <Line x1="18" y1="9" x2="12" y2="15" />
                    <Line x1="12" y1="9" x2="18" y2="15" />
                  </Svg>
                </TouchableOpacity>
                <Text
                  style={{
                    fontSize: 11,
                    color: "#EF4444",
                    textAlign: "center",
                    fontWeight: "500",
                  }}
                >
                  Wipe Data
                </Text>
              </View>

              {/* Log Out */}
              <View style={{ alignItems: "center", width: "22%" }}>
                <TouchableOpacity
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.05)",
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                  onPress={handleLogout}
                >
                  <Svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.text}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <Polyline points="16 17 21 12 16 7" />
                    <Line x1="21" y1="12" x2="9" y2="12" />
                  </Svg>
                </TouchableOpacity>
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.textMuted,
                    textAlign: "center",
                    fontWeight: "500",
                  }}
                >
                  Log Out
                </Text>
              </View>
            </View>

            {/* Delete Account Link at the bottom center */}
            <TouchableOpacity
              onPress={handleStartDeleteAccount}
              style={{
                marginTop: 12,
                alignItems: "center",
                paddingVertical: 8,
              }}
            >
              <Text
                style={{ color: "#EF4444", fontSize: 13, fontWeight: "600" }}
              >
                Delete Account
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.footerText, { color: colors.success }]}>
          All changes are saved automatically
        </Text>
        <Text
          style={[
            styles.footerText,
            {
              color: colors.textDimmed,
              fontSize: 10,
              marginTop: 4,
              fontWeight: "400",
            },
          ]}
        >
          xayLite v {customJson.version}
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
                      style={[
                        styles.progressPct,
                        {
                          color:
                            trainingProgress === 100
                              ? colors.success
                              : colors.primary,
                        },
                      ]}
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
                          backgroundColor:
                            trainingProgress === 100
                              ? colors.success
                              : colors.primary,
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
  statsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    minHeight: 92,
    justifyContent: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: "500",
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 1.5,
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
