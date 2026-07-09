import React, { useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  Dimensions,
  Easing,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
  Linking,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Path,
  Polygon,
  Line,
  Circle,
  Rect,
  Polyline,
} from "react-native-svg";
import { Ionicons, MaterialIcons, Feather } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { trackEvent } from "../utils/Analytics";
import * as Contacts from "expo-contacts/legacy";
import * as ImagePicker from "expo-image-picker";
import { AppContext } from "../context/AppContext";
import { translateText } from "../services/TranslationService";
import { createPost, syncPendingPosts } from "../services/PostService";
import { scheduleLocalNotification } from "../services/NotificationService";
import {
  initDatabase,
  getContacts as getDbContacts,
  saveContacts as saveDbContacts,
  getPosts as getDbPosts,
  savePosts as saveDbPosts,
  getExploreProfiles as getDbExplore,
  saveExploreProfiles as saveDbExplore,
  hasUnsyncedContacts,
  getUnsyncedContactsCount,
  savePendingPost,
  incrementContactUnread,
} from "../services/DatabaseService";
import {
  initDirectories,
  cacheRemoteImage,
  triggerCloudBackup,
} from "../services/StorageService";
import {
  saveLastImportCheckTime,
  getLastImportCheckTime,
  saveFirstTimeImportStatus,
  isFirstTimeImport,
  saveLastAutoSyncDate,
  getLastAutoSyncDate,
} from "../services/SecureStorage";
import UserProfilePopup from "../components/UserProfilePopup";

const { width, height } = Dimensions.get("window");

const DEFAULT_AVATARS = [
  require("../../assets/default-avatar-1.jpg"),
  require("../../assets/default-avatar-2.jpg"),
  require("../../assets/default-avatar-3.jpg"),
];

const getAssetUri = (asset) =>
  Image.resolveAssetSource ? Image.resolveAssetSource(asset).uri : asset;

const getDefaultAvatar = (seed) => {
  const idx =
    typeof seed === "string"
      ? seed.length % DEFAULT_AVATARS.length
      : Math.floor(Math.random() * DEFAULT_AVATARS.length);
  return getAssetUri(DEFAULT_AVATARS[idx]);
};

// Helper to convert flag emoji to lowercase 2-letter country code
function getCountryCodeFromFlag(flagEmoji) {
  if (!flagEmoji || typeof flagEmoji !== "string") return null;
  const chars = [...flagEmoji];
  if (chars.length < 2) {
    if (flagEmoji.length === 2 && /^[a-zA-Z]{2}$/.test(flagEmoji)) {
      return flagEmoji.toLowerCase();
    }
    return null;
  }
  let code = "";
  for (const char of chars) {
    const codePoint = char.codePointAt(0);
    if (codePoint >= 127462 && codePoint <= 127487) {
      code += String.fromCharCode(codePoint - 127462 + 97);
    }
  }
  return code.length === 2 ? code : null;
}

// Helper to render flag image or fallback emoji/text
function renderFlagOrEmoji(val) {
  const code = getCountryCodeFromFlag(val);
  if (code) {
    return (
      <Image
        source={{ uri: `https://flagcdn.com/w40/${code}.png` }}
        style={styles.flagImage}
        resizeMode="cover"
      />
    );
  }
  return <Text style={styles.flagText}>{val}</Text>;
}

const STATUS_ONLINE_PATTERN = /online|available|ready to chat|connected|active/;
const isOnlineStatus = (status) =>
  typeof status === "string" &&
  STATUS_ONLINE_PATTERN.test(status.trim().toLowerCase());

const INITIAL_CONTACTS = [
  {
    id: "unity_ai",
    name: "unity AI",
    avatar: require("../../assets/icon.png"),
    flag: "🌍",
    langName: "AI Companion",
    status: "Ready to chat",
    isUnityUser: true,
  },
  {
    id: "c1",
    name: "Marcus Sterling",
    avatar: require("../../assets/default-avatar-1.jpg"),
    flag: "🇺🇸",
    langName: "English (US)",
    status: "Busy",
    isUnityUser: true,
  },
  {
    id: "c2",
    name: "Yuki Tanaka",
    avatar: require("../../assets/default-avatar-2.jpg"),
    flag: "🇯🇵",
    langName: "Japanese",
    status: "Available",
    isUnityUser: true,
  },
];

const EXPLORE_PEOPLE = [
  {
    id: "e1",
    name: "Amélie Dubois",
    avatar: require("../../assets/default-avatar-3.jpg"),
    flag: "🇫🇷",
    langName: "French (France)",
    bio: "Hi! I am a culinary chef in Paris. Let's exchange recipes!",
  },
  {
    id: "e2",
    name: "Hiroshi Sato",
    avatar: require("../../assets/default-avatar-1.jpg"),
    flag: "🇯🇵",
    langName: "Japanese (Japan)",
    bio: "Tech enthusiast and history buff. Happy to translate and chat!",
  },
];

const INITIAL_POSTS = [
  {
    id: "p1",
    authorName: "Sarah Jenkins",
    avatar: require("../../assets/default-avatar-1.jpg"),
    flag: "🇺🇸",
    time: "2 hours ago",
    content:
      "Just arrived in Tokyo! The translation app has been a lifesaver for ordering food and finding my hotel. Highly recommend it! 🗼🇯🇵",
    images: [
      "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=600&q=80",
    ],
    likes: 24,
    liked: false,
    comments: [
      {
        id: "c1_1",
        author: "Yuki Tanaka",
        content:
          "Welcome to Japan! Let me know if you need any recommendations.",
      },
      {
        id: "c1_2",
        author: "Sarah Jenkins",
        content:
          "Thank you Yuki! I would love to get some sushi recommendations.",
      },
    ],
  },
  {
    id: "p2",
    authorName: "Carlos Gomez",
    avatar: require("../../assets/default-avatar-2.jpg"),
    flag: "🇪🇸",
    time: "4 hours ago",
    content:
      "Preparando la presentación para la cumbre europea de mañana. Gracias a Dios por la traducción de documentos en tiempo real de Unity, me ahorró horas de trabajo duro. 🇪🇺💼",
    images: [],
    likes: 12,
    liked: false,
    comments: [
      {
        id: "c2_1",
        author: "Lucas Dupont",
        content: "Bonne chance Carlos! Everything will go well.",
      },
    ],
  },
];

const SERVER_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";

const normalizePost = (post) => {
  const authorName = post?.authorName || "user";
  const avatar =
    post?.avatar_local_path ||
    (post?.avatar && typeof post.avatar === "string" && !post.avatar.includes("unsplash.com")
      ? post.avatar
      : getDefaultAvatar(authorName));
  return {
    ...post,
    avatar,
    likes: typeof post?.likes === "number" ? post.likes : 0,
    liked: Boolean(post?.liked),
    comments: Array.isArray(post?.comments) ? post.comments : [],
    images: Array.isArray(post?.images)
      ? post.images
      : Array.isArray(post?.imageUrls)
        ? post.imageUrls
        : post?.image
          ? [post.image]
          : [],
    images_local_paths: Array.isArray(post?.images_local_paths)
      ? post.images_local_paths
      : [],
  };
};

const normalizePosts = (posts) =>
  Array.isArray(posts) ? posts.map(normalizePost) : [];

const POST_BACKGROUND_PRESETS = [
  { id: "aurora", label: "Aurora", colors: ["#0F172A", "#4F46E5", "#06B6D4"] },
  { id: "sunset", label: "Sunset", colors: ["#7C2D12", "#EA580C", "#F59E0B"] },
  { id: "mint", label: "Mint", colors: ["#042F2E", "#0F766E", "#34D399"] },
  { id: "rose", label: "Rose", colors: ["#3F1D38", "#C026D3", "#F472B6"] },
  { id: "ink", label: "Ink", colors: ["#111827", "#374151", "#6B7280"] },
  {
    id: "sunrise",
    label: "Sunrise",
    colors: ["#431407", "#DB2777", "#FB7185"],
  },
];

const POST_TRANSLATION_TARGETS = {
  en: { code: "en", name: "English", label: "English" },
  sw: { code: "sw", name: "Swahili", label: "Kiswahili" },
  ar: { code: "ar", name: "Arabic", label: "Arabic" },
};

const POST_DESCRIPTION_LIMIT = 180;

const getPostTranslationTarget = (langCode) =>
  POST_TRANSLATION_TARGETS[langCode] || POST_TRANSLATION_TARGETS.en;

const getPostBackgroundPreset = (presetId) =>
  POST_BACKGROUND_PRESETS.find((preset) => preset.id === presetId) ||
  POST_BACKGROUND_PRESETS[0];

const buildPostCopy = (text) => {
  const cleanText = (text || "").trim();
  if (cleanText.length <= POST_DESCRIPTION_LIMIT) {
    return { content: cleanText, description: "" };
  }

  return {
    content: cleanText.slice(0, POST_DESCRIPTION_LIMIT).trimEnd() + "...",
    description: cleanText,
  };
};

const getPostMediaTypeFromAsset = (assetType, uri) => {
  const typeHint = (assetType || "").toLowerCase();
  const uriHint = (uri || "").toLowerCase();
  if (typeHint.includes("video") || /\.(mp4|mov|m4v|webm)$/i.test(uriHint)) {
    return "video";
  }
  if (typeHint.includes("image")) {
    return "image";
  }
  return "gradient";
};

const getPostDisplayText = (post) =>
  (post?.description || post?.content || "").trim();

export default function HomeScreen({ navigation }) {
  const { currentUser, getLangDetails, getLangDetailsFromFlag, LANGS } =
    useContext(AppContext);
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState("chats");
  const [callsFilter, setCallsFilter] = useState("all");
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [contactsFilter, setContactsFilter] = useState("my");
  const [contacts, setContacts] = useState(INITIAL_CONTACTS);
  const [syncedCount, setSyncedCount] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [showImportSuccess, setShowImportSuccess] = useState(false);
  const [contactSearchText, setContactSearchText] = useState("");
  const [exploreSearchText, setExploreSearchText] = useState("");
  const [postSearchText, setPostSearchText] = useState("");
  const [isPostSearchVisible, setIsPostSearchVisible] = useState(false);
  const [posts, setPosts] = useState(INITIAL_POSTS);
  const [exploreProfiles, setExploreProfiles] = useState(EXPLORE_PEOPLE);
  const [startConvModalVisible, setStartConvModalVisible] = useState(false);
  const [startConvSearch, setStartConvSearch] = useState("");
  const [startConvFilter, setStartConvFilter] = useState("contacts");
  const [profilePopupVisible, setProfilePopupVisible] = useState(false);
  const [profilePopupData, setProfilePopupData] = useState(null);

  // Post/Update creation states
  const [postModalVisible, setPostModalVisible] = useState(false);
  const [newPostText, setNewPostText] = useState("");
  const [newPostImages, setNewPostImages] = useState([]);
  const [newPostMediaType, setNewPostMediaType] = useState("gradient");
  const [newPostBackgroundKey, setNewPostBackgroundKey] = useState("aurora");
  const [newPostFlag, setNewPostFlag] = useState("\u{1F30D}");

  // Bottom Sheet Comments state
  const [activeCommentsPostId, setActiveCommentsPostId] = useState(null);
  const [newCommentText, setNewCommentText] = useState("");
  const [postTranslations, setPostTranslations] = useState({});
  const [expandedPosts, setExpandedPosts] = useState({});

  // Post Options Bottom Sheet state
  const [optionsPost, setOptionsPost] = useState(null);

  // Gradient shifting animation value
  const [gradientAnim] = useState(() => new Animated.Value(0));

  // Pulse animations for giant CTA button
  const [pulseAnim1] = useState(() => new Animated.Value(0));
  const [pulseAnim2] = useState(() => new Animated.Value(0));
  const [pulseAnim3] = useState(() => new Animated.Value(0));

  // Start animated loops
  useEffect(() => {
    // Gradient loop
    Animated.loop(
      Animated.timing(gradientAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    ).start();

    // Pulse animation logic: trigger every 10 seconds.
    // The animation itself is quick and beautiful (YouTube style).
    const triggerPulse = () => {
      pulseAnim1.setValue(0);
      pulseAnim2.setValue(0);
      pulseAnim3.setValue(0);

      Animated.parallel([
        Animated.timing(pulseAnim1, {
          toValue: 1,
          duration: 1200,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.sequence([
          Animated.delay(200),
          Animated.timing(pulseAnim2, {
            toValue: 1,
            duration: 1200,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            useNativeDriver: Platform.OS !== "web",
          }),
        ]),
        Animated.sequence([
          Animated.delay(400),
          Animated.timing(pulseAnim3, {
            toValue: 1,
            duration: 1200,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            useNativeDriver: Platform.OS !== "web",
          }),
        ]),
      ]).start();
    };

    // Trigger immediately on mount
    triggerPulse();

    // Trigger every 10 seconds
    const pulseInterval = setInterval(triggerPulse, 10000);

    return () => {
      clearInterval(pulseInterval);
    };
  }, [gradientAnim, pulseAnim1, pulseAnim2, pulseAnim3]);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const dismissed = await AsyncStorage.getItem("@onboarding_dismissed");
        if (dismissed !== "true") {
          setOnboardingVisible(true);
        }
      } catch (e) {
        console.error("Failed to read onboarding dismiss state", e);
        setOnboardingVisible(true);
      }
    };
    checkOnboarding();
  }, []);

  /**
   * Auto-sync contacts on app open (once per day).
   * Runs silently in the background. Shows inline success/fail.
   */
  useEffect(() => {
    let isActive = true;

    const autoSync = async () => {
      try {
        const todayStr = new Date().toISOString().split("T")[0];
        const lastSyncDate = await getLastAutoSyncDate();
        if (lastSyncDate === todayStr) {
          console.log("[Contacts] Already auto-synced today:", todayStr);
          // Still load existing contacts from DB
          const existing = await getDbContacts();
          if (existing && existing.length > 0) setContacts(existing);
          return;
        }

        console.log("[Contacts] Starting automatic daily contact sync...");
        await handleImportContacts(true);
      } catch (err) {
        console.error("[Contacts] Auto-sync trigger error:", err);
      }
    };

    if (isActive) autoSync();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    const targetLang = getPostTranslationTarget(currentUser.nativeLang || "en");

    (async () => {
      const nextTranslations = {};
      const postsToTranslate = normalizePosts(posts).slice(0, 12);
      for (const post of postsToTranslate) {
        if (!isActive) break;
        const sourceText = getPostDisplayText(post);
        if (!sourceText) continue;

        try {
          const translated = await translateText(sourceText, targetLang.code);
          if (isActive && translated?.trim()) {
            nextTranslations[post.id] = translated.trim();
            // Update state incrementally so UI doesn't wait for all
            setPostTranslations((prev) => ({
              ...prev,
              [post.id]: translated.trim(),
            }));
          }
        } catch (error) {
          console.warn("[HomeScreen] Post translation failed:", error);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [posts, currentUser.nativeLang]);

  // Background Pre-fetching function (TikTok style)
  const preFetchServerData = async () => {
    try {
      console.log(
        "[HomeScreen] Silently pre-fetching feed & explore profiles...",
      );

      // 1. Fetch Posts from Server
      const postsResponse = await fetch(`${SERVER_URL}/api/posts`);
      if (postsResponse.ok) {
        const remotePosts = await postsResponse.json();

        // Cache images in background
        const postsWithCachedMedia = await Promise.all(
          remotePosts.map(async (post) => {
            const postImages = post.imageUrls || post.images || [];
            const localImages =
              postImages.length > 0
                ? await Promise.all(
                    postImages.map((img) => cacheRemoteImage(img, "image")),
                  )
                : [];
            const localAvatar = post.avatar
              ? await cacheRemoteImage(post.avatar, "avatar")
              : null;
            return {
              ...post,
              images_local_paths: localImages || [],
              avatar_local_path: localAvatar || "",
            };
          }),
        );

        const normalizedPosts = postsWithCachedMedia.map(normalizePost);
        await saveDbPosts(normalizedPosts);
        const updatedPosts = await getDbPosts();
        setPosts(normalizePosts(updatedPosts));
      }

      // 2. Fetch Explore Profiles from Server
      const exploreResponse = await fetch(`${SERVER_URL}/api/explore`);
      if (exploreResponse.ok) {
        const remoteExplore = await exploreResponse.json();

        // Cache avatars in background
        const exploreWithCachedMedia = await Promise.all(
          remoteExplore.map(async (profile) => {
            const localAvatar = profile.avatar
              ? await cacheRemoteImage(profile.avatar, "avatar")
              : null;
            return {
              ...profile,
              avatar_local_path: localAvatar || "",
            };
          }),
        );

        await saveDbExplore(exploreWithCachedMedia);
        const updatedExplore = await getDbExplore();
        setExploreProfiles(updatedExplore);
      }
    } catch (err) {
      console.warn(
        "[HomeScreen] Offline or server pre-fetch failed:",
        err.message,
      );
    }
  };

  // Load offline data and pre-fetch server data on mount
  useEffect(() => {
    async function loadLocalData() {
      try {
        const dbSuccess = await initDatabase();
        if (!dbSuccess) {
          console.warn(
            "[HomeScreen] Database initialization failed. Skipping local data load.",
          );
          // Still try to fetch from server if possible
          preFetchServerData();
          return;
        }

        await initDirectories();

        // 1. Load Contacts
        const localContacts = await getDbContacts();
        if (localContacts.length > 0) {
          setContacts(localContacts);
          setImported(true);
        } else {
          // Prepopulate database with default contacts
          await saveDbContacts(INITIAL_CONTACTS);
          const initialWithTime = await getDbContacts();
          setContacts(initialWithTime);
        }

        // 2. Load Posts
        const localPosts = await getDbPosts();
        if (localPosts.length > 0) {
          setPosts(normalizePosts(localPosts));
        } else {
          const normalizedInitialPosts = normalizePosts(INITIAL_POSTS);
          await saveDbPosts(normalizedInitialPosts);
          setPosts(normalizedInitialPosts);
        }

        // 3. Load Explore Profiles
        const localExplore = await getDbExplore();
        if (localExplore.length > 0) {
          setExploreProfiles(localExplore);
        } else {
          await saveDbExplore(EXPLORE_PEOPLE);
          setExploreProfiles(EXPLORE_PEOPLE);
        }

        // 4. Pre-fetch from Server
        preFetchServerData();

        // 5. Cloud Backup Check
        triggerCloudBackup().catch((err) =>
          console.warn("Background backup check failed:", err.message),
        );
      } catch (e) {
        console.error("Error loading local DB data on mount:", e);
      }
    }
    loadLocalData();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      async function refreshContacts() {
        try {
          const latestContacts = await getDbContacts();
          if (latestContacts && latestContacts.length > 0) {
            setContacts(latestContacts);
          }
        } catch (e) {
          console.error("Failed to refresh contacts on focus:", e);
        }
      }
      refreshContacts();
    }, []),
  );

  // Define onboarding tasks
  const allTasks = [
    {
      id: "avatar",
      isCompleted:
        currentUser.avatarSlots &&
        ((currentUser.avatarSlots[0] &&
          typeof currentUser.avatarSlots[0] === "string" &&
          !currentUser.avatarSlots[0].includes("avatar_1.jpg")) ||
          (currentUser.avatarSlots[1] &&
            typeof currentUser.avatarSlots[1] === "string" &&
            !currentUser.avatarSlots[1].includes("avatar_2.jpg")) ||
          (currentUser.avatarSlots[2] &&
            typeof currentUser.avatarSlots[2] === "string" &&
            !currentUser.avatarSlots[2].includes("avatar_3.jpg")) ||
          (currentUser.avatarSlots[3] &&
            typeof currentUser.avatarSlots[3] === "string" &&
            !currentUser.avatarSlots[3].includes("avatar_4.jpg"))),
      uncompletedLabel: "Add profile picture",
      completedLabel: "✓ Profile picture added",
    },
    {
      id: "username",
      isCompleted: !!(currentUser.name && currentUser.name !== "User124"),
      uncompletedLabel: "Change username",
      completedLabel: "✓ Username Changed",
    },
    {
      id: "phone",
      isCompleted: !!(currentUser.phone && currentUser.phone.trim() !== ""),
      uncompletedLabel: "Add phone number",
      completedLabel: "✓ Phone Number Added",
    },
    {
      id: "nativeLang",
      isCompleted: currentUser.nativeLangSelected === true,
      uncompletedLabel: "Add native language",
      completedLabel: "✓ Native Language Added",
    },
    {
      id: "voice",
      isCompleted:
        currentUser.voiceAITrained === true || currentUser.micTested === true,
      uncompletedLabel: "Train your voice AI",
      completedLabel: "✓ Voice AI Trained",
    },
    {
      id: "aiLang",
      isCompleted: !!(currentUser.unityAILang && currentUser.unityAILang.trim() !== ""),
      uncompletedLabel: "Set AI companion language",
      completedLabel: "✓ AI Companion Language Set",
    },
  ];

  const completedTasks = allTasks.filter((t) => t.isCompleted);
  const uncompletedTasks = allTasks.filter((t) => !t.isCompleted);

  // Compute onboarding metrics
  const completedSteps = completedTasks.length;
  const totalSteps = allTasks.length;
  const onboardingPct = Math.round((completedSteps / totalSteps) * 100);

  // Select exactly 3 tasks to display at a time (1 completed followed by 2 uncompleted)
  let tasksToShow = [];
  if (uncompletedTasks.length > 0) {
    if (completedTasks.length > 0) {
      // Show 1 completed task first
      tasksToShow.push(completedTasks[0]);
      // Show up to 2 uncompleted tasks
      tasksToShow.push(uncompletedTasks[0]);
      if (uncompletedTasks[1]) {
        tasksToShow.push(uncompletedTasks[1]);
      } else if (completedTasks[1]) {
        tasksToShow.push(completedTasks[1]);
      }
    } else {
      // No completed tasks yet, show first 3 uncompleted
      tasksToShow = uncompletedTasks.slice(0, 3);
    }
  } else {
    // All completed
    tasksToShow = completedTasks.slice(0, 3);
  }

  // Color mappings based on active dark theme preference
  const isDark = currentUser.prefDarkTheme;
  const colors = {
    bg: isDark ? "#0A0612" : "#F8FAFC",
    cardBg: isDark ? "#120C24" : "#FFFFFF",
    border: isDark ? "rgba(255, 255, 255, 0.07)" : "rgba(0, 0, 0, 0.05)",
    text: isDark ? "#F3F4F6" : "#0F172A",
    textMuted: isDark ? "#9CA3AF" : "#475569",
    textDimmed: isDark ? "#6B7280" : "#64748B",
    accent: isDark ? "#06B6D4" : "#0284C7",
    primary: isDark ? "#8B5CF6" : "#4F46E5",
    primaryGlow: isDark
      ? "rgba(139, 92, 246, 0.15)"
      : "rgba(79, 70, 229, 0.08)",
    headerBg: isDark ? "rgba(10, 6, 18, 0.85)" : "rgba(241, 245, 249, 0.95)",
  };

  const handleStartConv = () => {
    trackEvent("opened_start_conversation", currentUser, {});
    setStartConvSearch("");
    setStartConvFilter("global");
    setStartConvModalVisible(true);
  };

  const handlePartnerClick = (
    name,
    avatar,
    flag,
    id,
    status,
    lang,
    langName,
  ) => {
    trackEvent("started_chat", currentUser, {
      partnerName: name,
      partnerId: id,
    });
    navigation.navigate("Conversation", {
      partnerName: name,
      partnerAvatar: avatar,
      partnerFlag: flag,
      partnerId: id || name,
      partnerStatus: status,
      partnerLang: lang,
      partnerLangName: langName,
    });
  };

  const handleCloseOnboarding = async () => {
    setOnboardingVisible(false);
    try {
      await AsyncStorage.setItem("@onboarding_dismissed", "true");
    } catch (e) {
      console.error("Failed to dismiss onboarding", e);
    }
  };

  const handleOpenSettings = async (target) => {
    trackEvent("opened_settings", currentUser, { target });
    setOnboardingVisible(false);
    try {
      await AsyncStorage.setItem("@onboarding_dismissed", "true");
    } catch (e) {
      console.error("Failed to mark onboarding as dismissed", e);
    }
    navigation.navigate("Profile", { scrollTo: target });
  };

  const openProfilePopup = (profile = {}) => {
    const flag = profile.flag || profile.authorFlag || "🌍";
    const languageFromFlag = getLangDetailsFromFlag(flag) || {};
    const languageFromNative = profile.nativeLang
      ? getLangDetails(profile.nativeLang)
      : null;

    setProfilePopupData({
      ...profile,
      name: profile.name || profile.authorName || "Unity User",
      avatar:
        profile.avatar_local_path ||
        profile.avatar ||
        profile.authorAvatar ||
        getDefaultAvatar(profile.name || profile.authorName || "user"),
      flag,
      langName:
        profile.langName ||
        languageFromNative?.name ||
        languageFromFlag.name ||
        "Translator Partner",
      country: profile.country || languageFromFlag.country || "",
      uid:
        profile.uid ||
        profile.id ||
        profile.authorId ||
        profile.email ||
        profile.name ||
        profile.authorName,
    });
    setProfilePopupVisible(true);
  };

  const handlePostLike = async (postId) => {
    try {
      const userKey = currentUser?.name || currentUser?.id || "Anonymous";

      const response = await fetch(`${SERVER_URL}/api/posts/${postId}/like`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userKey }),
      });

      if (!response.ok) {
        throw new Error("Failed to toggle like");
      }

      const updatedPost = await response.json();
      setPosts((currentPosts) =>
        currentPosts.map((post) => (post.id === postId ? updatedPost : post)),
      );
      trackEvent("liked_post", currentUser, { postId });
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const handleImportContacts = async (isAuto = false) => {
    if (isImporting) return;
    setIsImporting(true);
    trackEvent("started_contact_import", currentUser, { auto: isAuto });
    try {
      // Daily check: skip if already synced today (only for auto mode)
      if (isAuto) {
        const todayStr = new Date().toISOString().split("T")[0];
        const lastSyncDate = await getLastAutoSyncDate();
        if (lastSyncDate === todayStr) {
          console.log("[Contacts] Already auto-synced today, skipping.");
          setIsImporting(false);
          return;
        }
      }

      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        if (!isAuto) {
          Alert.alert(
            "Permission Denied",
            "Permission to access contacts was denied. Please enable it in settings.",
          );
        }
        setIsImporting(false);
        return;
      }

      console.log("[Contacts] Fetching device contacts...");
      let data = [];
      try {
        const response = await Contacts.getContactsAsync({
          fields: [
            Contacts.Fields.Name,
            Contacts.Fields.PhoneNumbers,
            Contacts.Fields.Emails,
            Contacts.Fields.Image,
          ],
        });
        data = response.data;
      } catch (imageFetchError) {
        console.warn(
          "[Contacts] Fetch failed with Image field, retrying without it:",
          imageFetchError,
        );
        const fallbackResponse = await Contacts.getContactsAsync({
          fields: [
            Contacts.Fields.Name,
            Contacts.Fields.PhoneNumbers,
            Contacts.Fields.Emails,
          ],
        });
        data = fallbackResponse.data;
      }

      if (data && data.length > 0) {
        console.log(
          `[Contacts] Found ${data.length} device contacts. Syncing...`,
        );

        const deviceContacts = data.slice(0, 50);

        const phoneNumbers = deviceContacts
          .map((item) =>
            item.phoneNumbers && item.phoneNumbers.length > 0
              ? item.phoneNumbers[0].number
              : "",
          )
          .filter((num) => num !== "");

        let unityUserMap = {};
        try {
          console.log("[Contacts] Checking backend for Unity accounts...");
          const res = await fetch(`${SERVER_URL}/api/check-contacts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phoneNumbers }),
          });
          const checkData = await res.json();
          if (checkData && checkData.contacts) {
            checkData.contacts.forEach((c) => {
              unityUserMap[c.phone] = c;
            });
          }
        } catch (backendErr) {
          console.warn(
            "[Contacts] Failed to check backend for users",
            backendErr,
          );
        }

        const formattedContacts = await Promise.all(
          deviceContacts.map(async (item, idx) => {
            const phone =
              item.phoneNumbers && item.phoneNumbers.length > 0
                ? item.phoneNumbers[0].number
                : "";
            const email =
              item.emails && item.emails.length > 0 ? item.emails[0].email : "";

            const unityInfo = unityUserMap[phone];
            const isUnityUser = !!(unityInfo && (unityInfo.hasUnityAccount || unityInfo.hasAccount));

            let flag = "";
            let lang = "";

            if (!isUnityUser) {
              // Not on Xaylite -> show current user's native flag/language
              flag = getLangDetails(currentUser.nativeLang)?.flag || "🌍";
              lang = getLangDetails(currentUser.nativeLang)?.name || "English";
            } else {
              // On Xaylite -> show actual flag/lang if available, or fallback
              const backendFlag = unityInfo?.flag || unityInfo?.nativeLangFlag;
              const backendLang = unityInfo?.lang || unityInfo?.nativeLang;

              if (backendFlag && backendLang) {
                flag = backendFlag;
                lang = backendLang;
              } else if (phone.includes("+33")) {
                flag = "\u{1F1EB}\u{1F1F7}";
                lang = "French";
              } else if (phone.includes("+81")) {
                flag = "\u{1F1EF}\u{1F1F5}";
                lang = "Japanese";
              } else if (phone.includes("+34")) {
                flag = "\u{1F1EA}\u{1F1F8}";
                lang = "Spanish";
              } else if (phone.includes("+254")) {
                flag = "\u{1F1F0}\u{1F1EA}";
                lang = "Swahili";
              } else {
                const simulatedLangs = [
                  { flag: "\u{1F1FA}\u{1F1F8}", lang: "English" },
                  { flag: "\u{1F1EA}\u{1F1F8}", lang: "Spanish" },
                  { flag: "\u{1F1EB}\u{1F1F7}", lang: "French" },
                  { flag: "\u{1F1EF}\u{1F1F5}", lang: "Japanese" },
                ];
                const choice = simulatedLangs[idx % simulatedLangs.length];
                flag = choice.flag;
                lang = choice.lang;
              }
            }

            let localAvatar = "";
            if (item.image && item.image.uri) {
              localAvatar = await cacheRemoteImage(item.image.uri, "avatar");
            } else {
              localAvatar = getDefaultAvatar(item.name || `user_${idx}`);
            }

            return {
              id: item.id || `c_device_${Date.now()}_${idx}`,
              name: item.name || "Unnamed Contact",
              phone: phone,
              email: email,
              flag: flag,
              langName: lang,
              status: isUnityUser ? "Available on Xaylite" : "Not on Xaylite",
              is_synced: 1,
              avatar: localAvatar,
              isUnityUser: isUnityUser ? 1 : 0,
            };
          }),
        );

        await saveDbContacts(formattedContacts);

        const updatedContacts = await getDbContacts();
        setContacts(updatedContacts);
        setSyncedCount(formattedContacts.length);
        setImported(true);

        if (formattedContacts.length > 0) {
          setShowImportSuccess(true);
          setTimeout(() => setShowImportSuccess(false), 15000);
        }

        // Mark today as synced
        const todayStr = new Date().toISOString().split("T")[0];
        await saveLastAutoSyncDate(todayStr);
        await saveLastImportCheckTime(Date.now());
        console.log(`[Contacts] Sync complete: ${formattedContacts.length} contacts`);
      } else {
        console.log("[Contacts] No contacts found on device.");
      }
    } catch (e) {
      console.error("[Contacts] Sync error:", e);
      Alert.alert(
        "Contact Sync Failed",
        "An error occurred while syncing your contacts.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Retry", onPress: () => handleImportContacts(false) },
        ],
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmAddContact = (name) => {
    Alert.alert(
      "Add to Contacts",
      `Would you like to add "${name}" to your contacts and start a conversation?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Add & Chat",
          onPress: () => {
            const newContact = {
              id: "c_" + Date.now(),
              name: name,
              avatar:
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80",
              flag: "🌍",
              langName: "Universal Partner",
              status: "Hey there! I am using Unity.",
            };
            setContacts((prev) => [...prev, newContact]);
            setStartConvModalVisible(false);
            handlePartnerClick(
              newContact.name,
              newContact.avatar,
              newContact.flag,
            );
          },
        },
      ],
    );
  };

  const handlePickPostImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert(
          "Photo Permission Needed",
          "Allow photo access to choose an image or video for your update.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 0.9,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const uris = result.assets.map((a) => a.uri);
        setNewPostImages((prev) => [...prev, ...uris]);
        // Only set media type if it's the first image being added or was a gradient
        setNewPostMediaType((prev) =>
          prev === "gradient" || prev === null
            ? getPostMediaTypeFromAsset(result.assets[0].type, uris[0])
            : prev,
        );
      }
    } catch (error) {
      console.error("Failed to pick post media", error);
      Alert.alert("Media Error", "Could not open your library.");
    }
  };

  const handlePickGradient = (presetId) => {
    setNewPostImages([]);
    setNewPostMediaType("gradient");
    setNewPostBackgroundKey(presetId);
  };

  const handleCreatePost = async () => {
    if (!newPostText.trim() && newPostImages.length === 0) return;

    const userFlag = currentUser.nativeLang
      ? getLangDetails(currentUser.nativeLang).flag || "\u{1F30D}"
      : "\u{1F30D}";
    const authorName =
      currentUser.name && currentUser.name !== "User124"
        ? currentUser.name
        : "User124";
    const postCopy = buildPostCopy(newPostText.trim());

    // Optimistically create the post object
    const pendingPostId = "pending_" + Date.now();
    const newPostPayload = {
      id: pendingPostId,
      content: postCopy.content,
      description: postCopy.description,
      authorId: currentUser.email || authorName,
      authorName,
      authorAvatar:
        currentUser.avatar ||
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80",
      authorFlag: userFlag,
      authorNativeLang: currentUser.nativeLang || "",
      imageUris: newPostImages,
      mediaType: newPostMediaType,
      backgroundKey: newPostBackgroundKey,
    };

    // Show optimistic UI immediately and close modal
    const optimisticPost = {
      ...newPostPayload,
      isPending: true,
      time: "Just now",
      flag: userFlag,
      likes: 0,
      liked: false,
      comments: [],
    };

    setPosts((prev) => [optimisticPost, ...prev]);
    setPostModalVisible(false);
    setNewPostText("");
    setNewPostImages([]);
    setNewPostMediaType("gradient");
    setNewPostBackgroundKey("aurora");

    // Notify user of background upload
    scheduleLocalNotification(
      "Uploading Post...",
      "Your post is being sent to the server.",
      { seconds: 1 },
    );

    try {
      // Save to local offline queue
      await savePendingPost(pendingPostId, newPostPayload);

      // Trigger background sync
      await syncPendingPosts();

      // Remove pending flag in UI
      setPosts((prev) =>
        prev.map((p) =>
          p.id === pendingPostId ? { ...p, isPending: false } : p,
        ),
      );
    } catch (error) {
      console.error("[HomeScreen] Failed to queue post:", error);
    }
  };

  const getAuthorAvatar = (authorName) => {
    if (
      authorName === currentUser.name ||
      authorName === "User124" ||
      authorName === "Me"
    ) {
      return currentUser.avatar;
    }
    // Search in INITIAL_POSTS
    const postWithAuthor = INITIAL_POSTS.find(
      (p) => p.authorName === authorName,
    );
    if (postWithAuthor) return postWithAuthor.avatar;

    // Search in INITIAL_CONTACTS
    const contactWithAuthor = INITIAL_CONTACTS.find(
      (c) => c.name === authorName,
    );
    if (contactWithAuthor) return contactWithAuthor.avatar;

    // Fallback
    return getDefaultAvatar(authorName || "user");
  };

  const handlePostChat = (post) => {
    const isOwner =
      post.authorName === (currentUser.name || "User124") ||
      post.authorName === "Me";
    if (isOwner) {
      Alert.alert("Chat", "You cannot start a conversation with yourself.");
      return;
    }

    const existingContact = contacts.find(
      (c) => c.name.toLowerCase() === post.authorName.toLowerCase(),
    );

    if (existingContact) {
      handlePartnerClick(
        existingContact.name,
        existingContact.avatar,
        existingContact.flag,
      );
    } else {
      Alert.alert(
        "Add to Contacts",
        `Would you like to add "${post.authorName}" to your contacts and start a conversation?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Add & Chat",
            onPress: () => {
              const newContact = {
                id: "c_" + Date.now(),
                name: post.authorName,
                avatar:
                  post.avatar ||
                  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80",
                flag: post.flag || "🌍",
                langName: "Translator Partner",
                status: "Hey there! Let's translate.",
              };
              setContacts((prev) => [...prev, newContact]);
              handlePartnerClick(
                newContact.name,
                newContact.avatar,
                newContact.flag,
              );
            },
          },
        ],
      );
    }
  };

  const handlePostMoreOptions = (post) => {
    setOptionsPost(post);
  };

  const handleDeletePost = (postId) => {
    Alert.alert(
      "Delete Update",
      "Are you sure you want to delete this update post? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setPosts((prev) => prev.filter((p) => p.id !== postId));
            setOptionsPost(null);
          },
        },
      ],
    );
  };

  const handleSharePost = (post) => {
    Alert.alert("Share", `Successfully shared post by ${post.authorName}!`);
    setOptionsPost(null);
  };

  const handleCopyLink = () => {
    Alert.alert("Copy Link", "Post link copied to clipboard!");
    setOptionsPost(null);
  };

  const handleReportPost = (post) => {
    Alert.alert("Reported", "Thank you! We will review this post.");
    setOptionsPost(null);
  };

  const handleOpenComments = (postId) => {
    setActiveCommentsPostId(postId);
    setNewCommentText("");
  };

  const handleSheetAddComment = () => {
    if (!newCommentText.trim() || !activeCommentsPostId) return;
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id === activeCommentsPostId) {
          const currentComments = Array.isArray(post.comments)
            ? post.comments
            : [];
          return {
            ...post,
            comments: [
              ...currentComments,
              {
                id: Date.now().toString(),
                author:
                  currentUser.name && currentUser.name !== "User124"
                    ? currentUser.name
                    : "User124",
                content: newCommentText.trim(),
              },
            ],
          };
        }
        return post;
      }),
    );
    setNewCommentText("");
  };

  const activePost = activeCommentsPostId
    ? normalizePost(posts.find((p) => p.id === activeCommentsPostId))
    : null;

  const handleToggleLike = (postId) => {
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id === postId) {
          return {
            ...post,
            liked: !post.liked,
            likes: post.liked ? post.likes - 1 : post.likes + 1,
          };
        }
        return post;
      }),
    );
  };

  // Interpolate animated gradient shifts
  const translateX = gradientAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -width * 0.6],
  });

  // Prepare current user profile for injection
  const myProfile = {
    id: "me",
    name: `(Me) ${currentUser.name && currentUser.name !== "User124" ? currentUser.name : "User124"}`,
    avatar:
      currentUser.avatar ||
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80",
    flag: currentUser.nativeLang
      ? getLangDetails(currentUser.nativeLang)?.flag || "🌍"
      : "🌍",
    langName: currentUser.nativeLang
      ? getLangDetails(currentUser.nativeLang)?.name || "Universal"
      : "Universal",
    status: currentUser.bio || "Online",
    bio: currentUser.bio || "This is me!",
    isMe: true,
  };

  const isOnlineContact = (item) => item?.isMe || isOnlineStatus(item?.status);

  const displayedContacts = [
    myProfile,
    ...normalizePosts(contacts).filter((c) => c.id !== "me"),
  ];
  const displayedExplore = [
    myProfile,
    ...normalizePosts(exploreProfiles).filter((e) => e.id !== "me"),
  ].filter((person) => {
    if (!exploreSearchText) return true;
    const q = exploreSearchText.toLowerCase();
    return (
      (person.name && person.name.toLowerCase().includes(q)) ||
      (person.utid && person.utid.toLowerCase().includes(q)) ||
      (person.uid && person.uid.toLowerCase().includes(q))
    );
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <SafeAreaView
        style={[
          styles.safeArea,
          {
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.cardBg,
          },
        ]}
        edges={["top", "left", "right"]}
      >
        {/* Header bar */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.headerGreeting, { color: colors.text }]}>
              {activeTab === "chats"
                ? "Chats"
                : activeTab === "updates"
                  ? "Updates"
                  : activeTab === "contacts"
                    ? "Contacts"
                    : "Calls"}
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              {activeTab === "chats"
                ? "You're ready to communicate instantly"
                : activeTab === "updates"
                  ? "Status & global community updates"
                  : activeTab === "contacts"
                    ? "Manage your contacts & explore people"
                    : "Recent voice translation sessions"}
            </Text>
          </View>
          {/* Menu Button (Three horizontal lines menu like WhatsApp) */}
          <TouchableOpacity
            style={[styles.menuBtn, { backgroundColor: colors.border }]}
            onPress={handleOpenSettings}
            activeOpacity={0.7}
          >
            <Svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.text}
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <Line x1="3" y1="12" x2="21" y2="12" />
              <Line x1="3" y1="6" x2="21" y2="6" />
              <Line x1="3" y1="18" x2="21" y2="18" />
            </Svg>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Main scrolling content view */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "chats" && (
          <View>
            {/* Giant start mic CTA */}
            <View style={styles.ctaContainer}>
              <View style={styles.ctaButtonWrapper}>
                {/* Pulse Ring 1 */}
                <Animated.View
                  style={[
                    styles.pulseRing,
                    {
                      borderWidth: 1.5,
                      borderColor: colors.primary,
                      backgroundColor: "transparent",
                      transform: [
                        {
                          scale: pulseAnim1.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1.0, 1.25],
                          }),
                        },
                      ],
                      opacity: pulseAnim1.interpolate({
                        inputRange: [0, 0.1, 0.8, 1],
                        outputRange: [0, 0.8, 0.8, 0],
                      }),
                    },
                  ]}
                />

                {/* Pulse Ring 2 */}
                <Animated.View
                  style={[
                    styles.pulseRing,
                    {
                      borderWidth: 1.5,
                      borderColor: colors.primary,
                      backgroundColor: "transparent",
                      transform: [
                        {
                          scale: pulseAnim2.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1.0, 1.25],
                          }),
                        },
                      ],
                      opacity: pulseAnim2.interpolate({
                        inputRange: [0, 0.1, 0.8, 1],
                        outputRange: [0, 0.8, 0.8, 0],
                      }),
                    },
                  ]}
                />

                {/* Pulse Ring 3 */}
                <Animated.View
                  style={[
                    styles.pulseRing,
                    {
                      borderWidth: 1.5,
                      borderColor: colors.primary,
                      backgroundColor: "transparent",
                      transform: [
                        {
                          scale: pulseAnim3.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1.0, 1.25],
                          }),
                        },
                      ],
                      opacity: pulseAnim3.interpolate({
                        inputRange: [0, 0.1, 0.8, 1],
                        outputRange: [0, 0.8, 0.8, 0],
                      }),
                    },
                  ]}
                />

                <TouchableOpacity
                  style={[styles.giantCta, { backgroundColor: colors.primary }]}
                  onPress={handleStartConv}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[colors.primary, "#6D28D9"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.giantCtaGradient}
                  >
                    <Svg
                      width="40"
                      height="40"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <Line x1="12" x2="12" y1="19" y2="22" />
                    </Svg>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
              <Text style={[styles.ctaTitle, { color: colors.text }]}>
                Start a Conversation
              </Text>
              <Text style={[styles.ctaSubtitle, { color: colors.textMuted }]}>
                Tap to start new conversation
              </Text>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.textDimmed }]}>
              Recent Conversations
            </Text>

            <View
              style={[
                styles.convList,
                { backgroundColor: colors.cardBg, borderColor: colors.border },
              ]}
            >
              {/* Unity AI Card */}
              <View
                style={[styles.convCard, { borderBottomColor: colors.border }]}
              >
                <TouchableOpacity
                  activeOpacity={0.85}
                  hitSlop={8}
                  onPress={() => openProfilePopup(INITIAL_CONTACTS[0])}
                  style={styles.avatarContainer}
                >
                  <Image
                    source={{ uri: INITIAL_CONTACTS[0].avatar }}
                    style={styles.avatar}
                  />
                  <View
                    style={[styles.flagBadge, { backgroundColor: colors.bg }]}
                  >
                    {renderFlagOrEmoji(
                      LANGS[currentUser.unityAILang]?.flag || "🌍",
                    )}
                  </View>
                  {isOnlineStatus(INITIAL_CONTACTS[0].status) && (
                    <View
                      style={[
                        styles.onlineBadge,
                        { borderColor: colors.cardBg },
                      ]}
                    />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() =>
                    handlePartnerClick(
                      INITIAL_CONTACTS[0].name,
                      INITIAL_CONTACTS[0].avatar,
                      LANGS[currentUser.unityAILang]?.flag || "🌍",
                      INITIAL_CONTACTS[0].id,
                      INITIAL_CONTACTS[0].status,
                      currentUser.unityAILang || "en",
                      LANGS[currentUser.unityAILang]?.name || "English",
                    )
                  }
                  style={styles.convBodyPress}
                >
                  <View style={styles.convDetails}>
                    <View style={styles.convHeader}>
                      <Text
                        style={[
                          styles.partnerName,
                          { color: colors.text, fontWeight: "700" },
                        ]}
                      >
                        {INITIAL_CONTACTS[0].name}
                      </Text>
                      <Text
                        style={[styles.convTime, { color: colors.textDimmed }]}
                      >
                        Always Online
                      </Text>
                    </View>
                    <Text
                      style={[styles.convPreview, { color: colors.primary }]}
                    >
                      AI is ready to chat!
                    </Text>
                  </View>
                  <View style={styles.convArrow}>
                    <Svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={colors.textDimmed}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <Path d="M9 18l6-6-6-6" />
                    </Svg>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Partner Card 1 */}
              <View
                style={[styles.convCard, { borderBottomColor: colors.border }]}
              >
                <TouchableOpacity
                  activeOpacity={0.85}
                  hitSlop={8}
                  onPress={() =>
                    openProfilePopup({
                      name: "Sophia Martinez",
                      avatar:
                        "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&h=100&q=80",
                      flag: "🇪🇸",
                      langName: "Spanish",
                      uid: "recent_sophia",
                    })
                  }
                  style={styles.avatarContainer}
                >
                  <Image
                    source={{
                      uri: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&h=100&q=80",
                    }}
                    style={styles.avatar}
                  />
                  <View
                    style={[styles.flagBadge, { backgroundColor: colors.bg }]}
                  >
                    {renderFlagOrEmoji("🇪🇸")}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() =>
                    handlePartnerClick(
                      "Sophia Martinez",
                      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&h=100&q=80",
                      "🇪🇸",
                    )
                  }
                  style={styles.convBodyPress}
                >
                  <View style={styles.convDetails}>
                    <View style={styles.convHeader}>
                      <Text
                        style={[styles.partnerName, { color: colors.text }]}
                      >
                        Sophia Martinez
                      </Text>
                      <Text
                        style={[styles.convTime, { color: colors.textDimmed }]}
                      >
                        2m ago
                      </Text>
                    </View>
                    <Text
                      style={[styles.convPreview, { color: colors.textMuted }]}
                    >
                      English ⇄ Spanish (Active)
                    </Text>
                  </View>
                  <View style={styles.convArrow}>
                    <Svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={colors.textDimmed}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <Path d="M9 18l6-6-6-6" />
                    </Svg>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Partner Card 2 */}
              <View
                style={[styles.convCard, { borderBottomColor: colors.border }]}
              >
                <TouchableOpacity
                  activeOpacity={0.85}
                  hitSlop={8}
                  onPress={() =>
                    openProfilePopup({
                      name: "Kenji Sato",
                      avatar:
                        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80",
                      flag: "🇯🇵",
                      langName: "Japanese",
                      uid: "recent_kenji",
                    })
                  }
                  style={styles.avatarContainer}
                >
                  <Image
                    source={{
                      uri: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80",
                    }}
                    style={styles.avatar}
                  />
                  <View
                    style={[styles.flagBadge, { backgroundColor: colors.bg }]}
                  >
                    {renderFlagOrEmoji("🇯🇵")}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() =>
                    handlePartnerClick(
                      "Kenji Sato",
                      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80",
                      "🇯🇵",
                    )
                  }
                  style={styles.convBodyPress}
                >
                  <View style={styles.convDetails}>
                    <View style={styles.convHeader}>
                      <Text
                        style={[styles.partnerName, { color: colors.text }]}
                      >
                        Kenji Sato
                      </Text>
                      <Text
                        style={[styles.convTime, { color: colors.textDimmed }]}
                      >
                        1h ago
                      </Text>
                    </View>
                    <Text
                      style={[styles.convPreview, { color: colors.textMuted }]}
                    >
                      English ⇄ Japanese
                    </Text>
                  </View>
                  <View style={styles.convArrow}>
                    <Svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={colors.textDimmed}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <Path d="M9 18l6-6-6-6" />
                    </Svg>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Partner Card 3 */}
              <View style={[styles.convCard, { borderBottomWidth: 0 }]}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  hitSlop={8}
                  onPress={() =>
                    openProfilePopup({
                      name: "Amara Okoro",
                      avatar:
                        "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=100&h=100&q=80",
                      flag: "🇰🇪",
                      langName: "Swahili",
                      uid: "recent_amara",
                    })
                  }
                  style={styles.avatarContainer}
                >
                  <Image
                    source={{
                      uri: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=100&h=100&q=80",
                    }}
                    style={styles.avatar}
                  />
                  <View
                    style={[styles.flagBadge, { backgroundColor: colors.bg }]}
                  >
                    {renderFlagOrEmoji("🇰🇪")}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() =>
                    handlePartnerClick(
                      "Amara Okoro",
                      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=100&h=100&q=80",
                      "🇰🇪",
                    )
                  }
                  style={styles.convBodyPress}
                >
                  <View style={styles.convDetails}>
                    <View style={styles.convHeader}>
                      <Text
                        style={[styles.partnerName, { color: colors.text }]}
                      >
                        Amara Okoro
                      </Text>
                      <Text
                        style={[styles.convTime, { color: colors.textDimmed }]}
                      >
                        Yesterday
                      </Text>
                    </View>
                    <Text
                      style={[styles.convPreview, { color: colors.textMuted }]}
                    >
                      English ⇄ Swahili
                    </Text>
                  </View>
                  <View style={styles.convArrow}>
                    <Svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={colors.textDimmed}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <Path d="M9 18l6-6-6-6" />
                    </Svg>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {activeTab === "contacts" && (
          <View>
            <View style={styles.filterContainer}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  contactsFilter === "my"
                    ? {
                        backgroundColor: colors.primaryGlow,
                        borderColor: colors.primary,
                      }
                    : {
                        backgroundColor: colors.cardBg,
                        borderColor: colors.border,
                      },
                ]}
                activeOpacity={0.7}
                onPress={() => setContactsFilter("my")}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    contactsFilter === "my"
                      ? { color: colors.primary, fontWeight: "600" }
                      : { color: colors.textMuted },
                  ]}
                >
                  My Contacts
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterChip,
                  contactsFilter === "explore"
                    ? {
                        backgroundColor: colors.primaryGlow,
                        borderColor: colors.primary,
                      }
                    : {
                        backgroundColor: colors.cardBg,
                        borderColor: colors.border,
                      },
                ]}
                activeOpacity={0.7}
                onPress={() => setContactsFilter("explore")}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    contactsFilter === "explore"
                      ? { color: colors.primary, fontWeight: "600" }
                      : { color: colors.textMuted },
                  ]}
                >
                  Explore People
                </Text>
              </TouchableOpacity>
            </View>

            {contactsFilter === "my" && (
              <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(0,0,0,0.03)",
                    borderWidth: 1,
                    borderColor: isDark
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.05)",
                    borderRadius: 14,
                    paddingHorizontal: 14,
                    height: 40,
                  }}
                >
                  <Svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.textMuted}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginRight: 8 }}
                  >
                    <Circle cx="11" cy="11" r="8" />
                    <Path d="M21 21l-4.35-4.35" />
                  </Svg>
                  <TextInput
                    style={{
                      flex: 1,
                      color: colors.text,
                      fontSize: 14,
                      outlineStyle: "none",
                    }}
                    placeholder="Search by name or UTID"
                    placeholderTextColor={colors.textMuted}
                    onChangeText={setContactSearchText}
                    value={contactSearchText}
                  />
                </View>

                {/* Subtle syncing indicator (no manual button) */}
                {isImporting ? (
                  <View
                    style={[
                      styles.importSuccessCard,
                      {
                        backgroundColor: colors.cardBg,
                        borderColor: colors.border,
                        flexDirection: "row",
                        alignItems: "center",
                      },
                    ]}
                  >
                    <ActivityIndicator
                      size="small"
                      color={colors.primary}
                      style={{ marginRight: 10 }}
                    />
                    <Text
                      style={[
                        styles.importSuccessText,
                        { color: colors.textMuted },
                      ]}
                    >
                      Syncing contacts...
                    </Text>
                  </View>
                ) : null}

                {showImportSuccess && syncedCount > 0 ? (
                  <View
                    style={[
                      styles.importSuccessCard,
                      {
                        backgroundColor: colors.cardBg,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.importSuccessText,
                        { color: colors.accent },
                      ]}
                    >
                      ✓ Successfully synced {syncedCount} phone contacts!
                    </Text>
                  </View>
                ) : null}

                <Text
                  style={[
                    styles.sectionTitle,
                    { color: colors.textDimmed, marginTop: 12 },
                  ]}
                >
                  My Address Book
                </Text>

                <View
                  style={[
                    styles.convList,
                    {
                      backgroundColor: colors.cardBg,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {contacts
                    .filter((c) => {
                      const q = contactSearchText.toLowerCase();
                      return (
                        (c.name || "").toLowerCase().includes(q) ||
                        (c.id || "").toLowerCase().includes(q) ||
                        (c.uid || "").toLowerCase().includes(q)
                      );
                    })
                    .sort((a, b) => {
                      const aVal = a.isUnityUser === true || a.isUnityUser === 1 ? 1 : 0;
                      const bVal = b.isUnityUser === true || b.isUnityUser === 1 ? 1 : 0;
                      return bVal - aVal;
                    })
                    .map((contact, index, arr) => (
                      <TouchableOpacity
                        key={contact.id}
                        style={[
                          styles.convCard,
                          index === arr.length - 1
                            ? { borderBottomWidth: 0 }
                            : { borderBottomColor: colors.border },
                        ]}
                        activeOpacity={0.7}
                        onPress={() => {
                          if (!contact.isUnityUser) {
                            const message =
                              "🤯 I'm talking to people in different languages with XayLite, even animals. You should try it too! Download: https://keysire.com";
                            const phone = (contact.phone || "").replace(
                              /\D/g,
                              "",
                            );
                            Linking.openURL(
                              `whatsapp://send?text=${encodeURIComponent(message)}&phone=${phone}`,
                            ).catch(() => {
                              Alert.alert(
                                "WhatsApp not found",
                                "Could not open WhatsApp. Please make sure it is installed.",
                              );
                            });
                            return;
                          }
                          handlePartnerClick(
                            contact.name,
                            contact.avatar,
                            contact.flag,
                            contact.id,
                          );
                        }}
                      >
                        <View style={styles.avatarContainer}>
                          <Image
                            source={{ uri: contact.avatar }}
                            style={styles.avatar}
                          />
                          {isOnlineContact(contact) && (
                            <View
                              style={[
                                styles.onlineBadge,
                                { borderColor: colors.cardBg },
                              ]}
                            />
                          )}
                          <View
                            style={[
                              styles.flagBadge,
                              { backgroundColor: colors.bg },
                            ]}
                          >
                            {renderFlagOrEmoji(contact.flag)}
                          </View>
                        </View>
                        <View style={styles.convDetails}>
                          <View style={styles.convHeader}>
                            <Text
                              style={[
                                styles.partnerName,
                                { color: colors.text },
                              ]}
                            >
                              {contact.name}
                            </Text>
                            {contact.unreadCount > 0 && (
                              <View
                                style={{
                                  backgroundColor: "#EF4444",
                                  borderRadius: 12,
                                  minWidth: 20,
                                  height: 20,
                                  justifyContent: "center",
                                  alignItems: "center",
                                  marginLeft: 8,
                                  paddingHorizontal: 6,
                                }}
                              >
                                <Text
                                  style={{
                                    color: "#FFFFFF",
                                    fontSize: 12,
                                    fontWeight: "bold",
                                  }}
                                >
                                  {contact.unreadCount}
                                </Text>
                              </View>
                            )}
                            <Text
                              style={[
                                styles.contactStatus,
                                {
                                  color: colors.accent,
                                  marginLeft: contact.unreadCount > 0 ? 8 : 0,
                                },
                              ]}
                            >
                              {contact.status}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.convPreview,
                              { color: colors.textMuted },
                            ]}
                          >
                            Native: {contact.langName}
                          </Text>
                        </View>
                        <View style={styles.convArrow}>
                          {!contact.isUnityUser ? (
                            <View
                              style={{
                                backgroundColor: colors.border,
                                paddingHorizontal: 12,
                                paddingVertical: 4,
                                borderRadius: 12,
                              }}
                            >
                              <Text
                                style={{
                                  color: colors.text,
                                  fontSize: 12,
                                  fontWeight: "600",
                                }}
                              >
                                Invite
                              </Text>
                            </View>
                          ) : (
                            <Svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke={colors.textDimmed}
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <Path d="M9 18l6-6-6-6" />
                            </Svg>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                </View>
              </View>
            )}

            {contactsFilter === "explore" && (
              <View>
                {/* Search Bar for Explore */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(0,0,0,0.03)",
                    borderWidth: 1,
                    borderColor: isDark
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.05)",
                    borderRadius: 14,
                    paddingHorizontal: 14,
                    height: 40,
                    marginTop: 8,
                    marginBottom: 16,
                  }}
                >
                  <Svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.textMuted}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginRight: 8 }}
                  >
                    <Circle cx="11" cy="11" r="8" />
                    <Path d="M21 21l-4.35-4.35" />
                  </Svg>
                  <TextInput
                    style={{
                      flex: 1,
                      color: colors.text,
                      fontSize: 14,
                      outlineStyle: "none",
                    }}
                    placeholder="Search by name or UTID"
                    placeholderTextColor={colors.textMuted}
                    onChangeText={setExploreSearchText}
                    value={exploreSearchText}
                  />
                </View>

                <View style={styles.exploreGrid}>
                  {displayedExplore.map((person) => (
                    <View
                      key={person.id}
                      style={[
                        styles.exploreCard,
                        {
                          backgroundColor: colors.cardBg,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Image
                        source={{
                          uri: person.avatar_local_path || person.avatar,
                        }}
                        style={styles.exploreImage}
                      />
                      <View
                        style={[
                          styles.exploreFlagBadge,
                          { backgroundColor: colors.bg },
                        ]}
                      >
                        {renderFlagOrEmoji(person.flag)}
                      </View>
                      <View style={styles.exploreCardDetails}>
                        <Text
                          style={[styles.exploreName, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {person.name}
                        </Text>
                        <Text
                          style={[
                            styles.exploreLang,
                            { color: colors.primary },
                          ]}
                          numberOfLines={1}
                        >
                          {person.langName}
                        </Text>
                        <Text
                          style={[
                            styles.exploreBio,
                            { color: colors.textMuted },
                          ]}
                          numberOfLines={2}
                        >
                          {person.bio}
                        </Text>
                        <TouchableOpacity
                          style={[
                            styles.exploreCta,
                            { backgroundColor: colors.primary },
                          ]}
                          onPress={() =>
                            handlePartnerClick(
                              person.name,
                              person.avatar_local_path || person.avatar,
                              person.flag,
                              person.id,
                            )
                          }
                          activeOpacity={0.8}
                        >
                          <LinearGradient
                            colors={[colors.primary, "#6D28D9"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.exploreCtaGradient}
                          >
                            <Text style={styles.exploreCtaText}>Chat Now</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {activeTab === "updates" && (
          <View style={styles.updatesContainer}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 20,
                marginBottom: 12,
              }}
            >
              {!isPostSearchVisible ? (
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: colors.textDimmed, margin: 0 },
                  ]}
                >
                  Recent Updates
                </Text>
              ) : (
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(0,0,0,0.03)",
                    borderWidth: 1,
                    borderColor: isDark
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.05)",
                    borderRadius: 24,
                    paddingHorizontal: 16,
                    height: 40,
                    marginRight: 12,
                  }}
                >
                  <Svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.textMuted}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginRight: 8 }}
                  >
                    <Circle cx="11" cy="11" r="8" />
                    <Path d="M21 21l-4.35-4.35" />
                  </Svg>
                  <TextInput
                    style={{
                      flex: 1,
                      color: colors.text,
                      fontSize: 14,
                      outlineStyle: "none",
                      borderWidth: 0,
                    }}
                    placeholder="Search posts, UTID..."
                    placeholderTextColor={colors.textMuted}
                    onChangeText={setPostSearchText}
                    value={postSearchText}
                    autoFocus
                  />
                </View>
              )}
              <TouchableOpacity
                onPress={() => {
                  if (isPostSearchVisible) {
                    setPostSearchText("");
                  }
                  setIsPostSearchVisible(!isPostSearchVisible);
                }}
                activeOpacity={0.7}
                style={{ padding: 4 }}
              >
                {isPostSearchVisible ? (
                  <Svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.textMuted}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <Line x1="18" y1="6" x2="6" y2="18" />
                    <Line x1="6" y1="6" x2="18" y2="18" />
                  </Svg>
                ) : (
                  <Svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.textMuted}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <Circle cx="11" cy="11" r="8" />
                    <Path d="M21 21l-4.35-4.35" />
                  </Svg>
                )}
              </TouchableOpacity>
            </View>

            {posts
              .filter((post) => {
                if (!postSearchText) return true;
                const q = postSearchText.toLowerCase();
                return (
                  (post.authorName &&
                    post.authorName.toLowerCase().includes(q)) ||
                  (post.content && post.content.toLowerCase().includes(q)) ||
                  (post.description &&
                    post.description.toLowerCase().includes(q)) ||
                  (post.authorEmail &&
                    post.authorEmail.toLowerCase().includes(q))
                );
              })
              .map((post) => {
                return (
                  <View
                    key={post.id}
                    style={[
                      styles.postCard,
                      {
                        backgroundColor: colors.cardBg,
                        borderColor: colors.border,
                        opacity: post.isPending ? 0.7 : 1,
                      },
                    ]}
                  >
                    {/* Post Header */}
                    <View style={styles.postHeader}>
                      <View style={styles.avatarContainer}>
                        <Image
                          source={{
                            uri: post.avatar_local_path || post.avatar,
                          }}
                          style={styles.postAvatar}
                        />
                        <View
                          style={[
                            styles.flagBadge,
                            { backgroundColor: colors.bg },
                          ]}
                        >
                          {renderFlagOrEmoji(post.flag)}
                        </View>
                      </View>
                      <View style={[styles.postAuthorInfo, { flex: 1 }]}>
                        <Text
                          style={[
                            styles.postAuthorName,
                            { color: colors.text },
                          ]}
                        >
                          {post.authorName}
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            marginTop: 2,
                          }}
                        >
                          <Text
                            style={[
                              styles.postTimeText,
                              { color: colors.textDimmed },
                            ]}
                          >
                            {post.time}
                          </Text>
                          {post.isPending && (
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                marginLeft: 6,
                              }}
                            >
                              <Text
                                style={{
                                  color: colors.primary,
                                  fontSize: 12,
                                  marginRight: 4,
                                }}
                              >
                                • Uploading
                              </Text>
                              <ActivityIndicator
                                size="small"
                                color={colors.primary}
                              />
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Header Action Icons: Chat + 3-Dot Options */}
                      <View style={styles.postHeaderActions}>
                        <TouchableOpacity
                          onPress={() => handlePostMoreOptions(post)}
                          style={styles.postHeaderActionBtn}
                          activeOpacity={0.7}
                        >
                          <Svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke={colors.textMuted}
                            strokeWidth="2.5"
                          >
                            <Circle cx="12" cy="12" r="1.5" />
                            <Circle cx="6" cy="12" r="1.5" />
                            <Circle cx="18" cy="12" r="1.5" />
                          </Svg>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Post Content */}
                    {(() => {
                      const fullPostText = (
                        post.description ||
                        post.content ||
                        ""
                      ).trim();
                      const isExpanded = Boolean(expandedPosts[post.id]);
                      const shouldTruncate =
                        fullPostText.length > POST_DESCRIPTION_LIMIT;
                      const previewText =
                        shouldTruncate && !isExpanded
                          ? `${fullPostText.slice(0, POST_DESCRIPTION_LIMIT).trimEnd()}...`
                          : fullPostText;
                      const translationText = postTranslations[post.id];
                      const background = getPostBackgroundPreset(
                        post.backgroundKey,
                      );
                      const showGradientCard =
                        post.mediaType === "gradient" &&
                        (!post.images || post.images.length === 0);

                      if (showGradientCard) {
                        return (
                          <LinearGradient
                            colors={background.colors}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.postGradientCard}
                          >
                            <Text style={styles.postGradientText}>
                              {previewText}
                            </Text>
                            {shouldTruncate && (
                              <TouchableOpacity
                                onPress={() =>
                                  setExpandedPosts((prev) => ({
                                    ...prev,
                                    [post.id]: !prev[post.id],
                                  }))
                                }
                                style={styles.postSeeMoreBtn}
                                activeOpacity={0.75}
                              >
                                <Text style={styles.postSeeMoreText}>
                                  {isExpanded ? "See less" : "See more"}
                                </Text>
                              </TouchableOpacity>
                            )}
                            {translationText ? (
                              <Text style={styles.postTranslationText}>
                                {translationText}
                              </Text>
                            ) : null}
                          </LinearGradient>
                        );
                      }

                      return (
                        <>
                          {post.images && post.images.length > 0 ? (
                            post.mediaType === "video" ? (
                              <View style={styles.postVideoPlaceholder}>
                                <LinearGradient
                                  colors={background.colors}
                                  start={{ x: 0, y: 0 }}
                                  end={{ x: 1, y: 1 }}
                                  style={styles.postVideoGradient}
                                >
                                  <Text style={styles.postVideoBadge}>
                                    VIDEO
                                  </Text>
                                  <Text style={styles.postVideoText}>
                                    Tap to play after upload support is enabled.
                                  </Text>
                                </LinearGradient>
                              </View>
                            ) : (
                              <View style={styles.postImageGrid}>
                                {post.images
                                  .slice(0, 4)
                                  .map((imgUri, index) => {
                                    const isLast = index === 3;
                                    const extraCount = post.images.length - 4;
                                    const localPath =
                                      post.images_local_paths?.[index] ||
                                      imgUri;
                                    const numImages = Math.min(
                                      post.images.length,
                                      4,
                                    );

                                    // Simple grid logic
                                    let itemStyle = styles.gridItemSingle;
                                    if (numImages === 2)
                                      itemStyle = styles.gridItemHalf;
                                    else if (numImages === 3)
                                      itemStyle =
                                        index === 0
                                          ? styles.gridItemFullTop
                                          : styles.gridItemHalfBottom;
                                    else if (numImages >= 4)
                                      itemStyle = styles.gridItemQuarter;

                                    return (
                                      <View
                                        key={index}
                                        style={[
                                          styles.gridImageWrapper,
                                          itemStyle,
                                        ]}
                                      >
                                        <Image
                                          source={{ uri: localPath }}
                                          style={styles.gridImage}
                                          resizeMode="cover"
                                        />
                                        {isLast && extraCount > 0 && (
                                          <View style={styles.gridOverlay}>
                                            <Text
                                              style={styles.gridOverlayText}
                                            >
                                              +{extraCount}
                                            </Text>
                                          </View>
                                        )}
                                      </View>
                                    );
                                  })}
                              </View>
                            )
                          ) : null}

                          <Text
                            style={[
                              styles.postContentText,
                              { color: colors.text },
                            ]}
                          >
                            {previewText}
                          </Text>

                          {shouldTruncate && (
                            <TouchableOpacity
                              onPress={() =>
                                setExpandedPosts((prev) => ({
                                  ...prev,
                                  [post.id]: !prev[post.id],
                                }))
                              }
                              style={styles.postSeeMoreBtn}
                              activeOpacity={0.75}
                            >
                              <Text style={styles.postSeeMoreText}>
                                {isExpanded ? "See less" : "See more"}
                              </Text>
                            </TouchableOpacity>
                          )}

                          {translationText ? (
                            <Text style={styles.postTranslationText}>
                              {translationText}
                            </Text>
                          ) : null}
                        </>
                      );
                    })()}
                    {/* Post Stats */}
                    <View
                      style={[
                        styles.postStatsRow,
                        { borderBottomColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.postStatsText,
                          { color: colors.textDimmed },
                        ]}
                      >
                        {post.likes} {post.likes === 1 ? "Like" : "Likes"}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleOpenComments(post.id)}
                      >
                        <Text
                          style={[
                            styles.postStatsText,
                            { color: colors.textDimmed },
                          ]}
                        >
                          {post.comments?.length ?? 0}{" "}
                          {(post.comments?.length ?? 0) === 1
                            ? "Comment"
                            : "Comments"}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Post Actions */}
                    <View style={styles.postActionsRow}>
                      <TouchableOpacity
                        style={styles.postActionBtn}
                        onPress={() => handleToggleLike(post.id)}
                      >
                        <Svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill={post.liked ? colors.danger : "none"}
                          stroke={post.liked ? colors.danger : colors.textMuted}
                          strokeWidth="2"
                        >
                          <Path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                        </Svg>
                        <Text
                          style={[
                            styles.postActionText,
                            {
                              color: post.liked
                                ? colors.danger
                                : colors.textMuted,
                            },
                          ]}
                        >
                          Like
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.postActionBtn}
                        onPress={() => handleOpenComments(post.id)}
                      >
                        <Svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={colors.textMuted}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <Path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                        </Svg>
                        <Text
                          style={[
                            styles.postActionText,
                            { color: colors.textMuted },
                          ]}
                        >
                          Comment
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
          </View>
        )}

        {activeTab === "calls" && (
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingVertical: 12,
                gap: 10,
              }}
            >
              {[
                "all",
                "missed",
                "contacts",
                "spam",
                "outgoing",
                "incoming",
              ].map((filterItem) => (
                <TouchableOpacity
                  key={filterItem}
                  onPress={() => setCallsFilter(filterItem)}
                  style={[
                    {
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor:
                        callsFilter === filterItem
                          ? colors.primary
                          : isDark
                            ? "rgba(255,255,255,0.05)"
                            : "rgba(0,0,0,0.05)",
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: callsFilter === filterItem ? "#fff" : colors.text,
                      fontWeight: callsFilter === filterItem ? "600" : "500",
                      textTransform: "capitalize",
                    }}
                  >
                    {filterItem}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View
              style={[
                styles.convList,
                { backgroundColor: colors.cardBg, borderColor: colors.border },
              ]}
            >
              <View
                style={[styles.convCard, { borderBottomColor: colors.border }]}
              >
                <View style={styles.avatarContainer}>
                  <Image
                    source={{
                      uri: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&h=100&q=80",
                    }}
                    style={styles.avatar}
                  />
                  <View
                    style={[
                      styles.callIndicatorBadge,
                      { backgroundColor: "#10B981" },
                    ]}
                  >
                    <Text style={styles.callArrow}>↗</Text>
                  </View>
                </View>
                <View style={styles.convDetails}>
                  <View style={styles.convHeader}>
                    <Text style={[styles.partnerName, { color: colors.text }]}>
                      Sophia Martinez
                    </Text>
                    <Text
                      style={[styles.convTime, { color: colors.textDimmed }]}
                    >
                      10m ago
                    </Text>
                  </View>
                  <Text
                    style={[styles.convPreview, { color: colors.textMuted }]}
                  >
                    Outgoing translation call • 4m 12s
                  </Text>
                </View>
              </View>

              <View style={[styles.convCard, { borderBottomWidth: 0 }]}>
                <View style={styles.avatarContainer}>
                  <Image
                    source={{
                      uri: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80",
                    }}
                    style={styles.avatar}
                  />
                  <View
                    style={[
                      styles.callIndicatorBadge,
                      { backgroundColor: "#EF4444" },
                    ]}
                  >
                    <Text style={styles.callArrow}>↙</Text>
                  </View>
                </View>
                <View style={styles.convDetails}>
                  <View style={styles.convHeader}>
                    <Text style={[styles.partnerName, { color: colors.text }]}>
                      Kenji Sato
                    </Text>
                    <Text
                      style={[styles.convTime, { color: colors.textDimmed }]}
                    >
                      Yesterday
                    </Text>
                  </View>
                  <Text
                    style={[styles.convPreview, { color: colors.textMuted }]}
                  >
                    Incoming translation call • 12m 40s
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <UserProfilePopup
        visible={profilePopupVisible}
        profile={profilePopupData}
        onClose={() => setProfilePopupVisible(false)}
        colors={colors}
        getLangDetails={getLangDetails}
        getLangDetailsFromFlag={getLangDetailsFromFlag}
      />

      {/* Centered Premium Onboarding Popup Card (adapts to light/dark themes dynamically!) */}
      {onboardingVisible && onboardingPct < 100 && (
        <Modal
          visible={onboardingVisible}
          transparent
          animationType="fade"
          onRequestClose={handleCloseOnboarding}
        >
          <View style={styles.onboardingOverlay}>
            <View
              style={[
                styles.onboardingCard,
                {
                  backgroundColor: colors.cardBg,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.onboardingHeader}>
                <View
                  style={[
                    styles.promptIcon,
                    { backgroundColor: colors.primaryGlow },
                  ]}
                >
                  <Svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#A855F7"
                    strokeWidth="2"
                  >
                    <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </Svg>
                </View>
                <View style={styles.promptDetails}>
                  <Text style={[styles.promptTitle, { color: colors.text }]}>
                    Complete your profile
                  </Text>
                  <Text
                    style={[
                      styles.promptProgressText,
                      { color: colors.textMuted },
                    ]}
                  >
                    {onboardingPct}% completed
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleCloseOnboarding}
                  style={styles.closeMiniBtn}
                >
                  <Text
                    style={[styles.closeMiniText, { color: colors.textDimmed }]}
                  >
                    &times;
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Fluid shifting gradient progress bar */}
              <View style={styles.progressBarContainer}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${onboardingPct}%`,
                    },
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.fluidGradientContainer,
                      {
                        transform: [{ translateX }],
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={[
                        colors.primary,
                        "#EC4899",
                        colors.accent,
                        colors.primary,
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.progressBarGradient}
                    />
                  </Animated.View>
                </Animated.View>
              </View>

              {/* Interactive Checklist Options (Pills) */}
              {uncompletedTasks.length > 0 ? (
                <View style={styles.promptOptions}>
                  {tasksToShow.map((task) => (
                    <TouchableOpacity
                      key={task.id}
                      style={[
                        styles.optionPill,
                        task.isCompleted
                          ? styles.pillCompleted
                          : {
                              backgroundColor: task.highlight
                                ? colors.primary + "20"
                                : colors.bg,
                              borderColor: task.highlight
                                ? colors.primary
                                : colors.border,
                              borderWidth: task.highlight ? 2 : 1,
                            },
                      ]}
                      disabled={task.isCompleted}
                      onPress={() => handleOpenSettings(task.id)}
                    >
                      <Text
                        style={[
                          styles.pillLabel,
                          task.isCompleted
                            ? styles.pillLabelCompleted
                            : {
                                color: task.highlight
                                  ? colors.primary
                                  : colors.textMuted,
                                fontWeight: task.highlight ? "700" : "500",
                              },
                        ]}
                      >
                        {task.isCompleted
                          ? task.completedLabel
                          : task.uncompletedLabel}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.shoutoutContainer}>
                  <Text style={styles.shoutoutTitle}>🎉 Profile Complete!</Text>
                  <Text
                    style={[styles.shoutoutText, { color: colors.textDimmed }]}
                  >
                    {
                      "You're all set! You can customize settings in the settings menu."
                    }
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* Floating Action Button (Teal Gradient Floating Plus) for Contacts Tab */}
      {activeTab === "contacts" && (
        <TouchableOpacity
          style={[
            styles.fab,
            { bottom: 16 + 66 + (insets.bottom > 0 ? insets.bottom : 10) },
          ]}
          activeOpacity={0.8}
          onPress={handleStartConv}
        >
          <LinearGradient
            colors={[colors.primary, "#6D28D9"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          >
            <Svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Line x1="12" y1="5" x2="12" y2="19" />
              <Line x1="5" y1="12" x2="19" y2="12" />
            </Svg>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Floating Action Button for Updates Tab */}
      {activeTab === "updates" && (
        <TouchableOpacity
          style={[
            styles.fab,
            { bottom: 16 + 66 + (insets.bottom > 0 ? insets.bottom : 10) },
          ]}
          activeOpacity={0.8}
          onPress={() => {
            const userFlag = currentUser.nativeLang
              ? getLangDetails(currentUser.nativeLang).flag || "🌍"
              : "🌍";
            setNewPostFlag(userFlag);
            setPostModalVisible(true);
          }}
        >
          <LinearGradient
            colors={[colors.primary, "#6D28D9"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          >
            <Svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Line x1="12" y1="5" x2="12" y2="19" />
              <Line x1="5" y1="12" x2="19" y2="12" />
            </Svg>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Bottom Tabs navigation bar */}
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: colors.cardBg,
            borderColor: colors.border,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
            height: 66 + (insets.bottom > 0 ? insets.bottom : 10),
          },
        ]}
      >
        <TouchableOpacity
          style={styles.tabBarBtn}
          onPress={() => setActiveTab("chats")}
        >
          <View
            style={[
              styles.tabIconBg,
              activeTab === "chats" && { backgroundColor: colors.primaryGlow },
            ]}
          >
            <Svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke={
                activeTab === "chats" ? colors.primary : colors.textDimmed
              }
              strokeWidth="2.2"
            >
              <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </Svg>
          </View>
          <Text
            style={[
              styles.tabBarLabel,
              {
                color:
                  activeTab === "chats" ? colors.primary : colors.textDimmed,
                fontWeight: activeTab === "chats" ? "600" : "500",
              },
            ]}
          >
            Chats
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabBarBtn}
          onPress={() => setActiveTab("contacts")}
        >
          <View
            style={[
              styles.tabIconBg,
              activeTab === "contacts" && {
                backgroundColor: colors.primaryGlow,
              },
            ]}
          >
            <Svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke={
                activeTab === "contacts" ? colors.primary : colors.textDimmed
              }
              strokeWidth="2.2"
            >
              <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <Circle cx="9" cy="7" r="4" fill="none" />
              <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </Svg>
          </View>
          <Text
            style={[
              styles.tabBarLabel,
              {
                color:
                  activeTab === "contacts" ? colors.primary : colors.textDimmed,
                fontWeight: activeTab === "contacts" ? "600" : "500",
              },
            ]}
          >
            Contacts
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabBarBtn}
          onPress={() => setActiveTab("calls")}
        >
          <View
            style={[
              styles.tabIconBg,
              activeTab === "calls" && { backgroundColor: colors.primaryGlow },
            ]}
          >
            <Svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke={
                activeTab === "calls" ? colors.primary : colors.textDimmed
              }
              strokeWidth="2.2"
            >
              <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </Svg>
          </View>
          <Text
            style={[
              styles.tabBarLabel,
              {
                color:
                  activeTab === "calls" ? colors.primary : colors.textDimmed,
                fontWeight: activeTab === "calls" ? "600" : "500",
              },
            ]}
          >
            Calls
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabBarBtn}
          onPress={() => setActiveTab("updates")}
        >
          <View
            style={[
              styles.tabIconBg,
              activeTab === "updates" && {
                backgroundColor: colors.primaryGlow,
              },
            ]}
          >
            <Svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke={
                activeTab === "updates" ? colors.primary : colors.textDimmed
              }
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
              <Path d="M12 6v6l4 2" />
            </Svg>
          </View>
          <Text
            style={[
              styles.tabBarLabel,
              {
                color:
                  activeTab === "updates" ? colors.primary : colors.textDimmed,
                fontWeight: activeTab === "updates" ? "600" : "500",
              },
            ]}
          >
            Updates
          </Text>
        </TouchableOpacity>
      </View>

      {/* Create Post Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={postModalVisible}
        onRequestClose={() => setPostModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View
            style={[
              styles.createPostModalContent,
              {
                backgroundColor: colors.cardBg,
                borderColor: colors.border,
                maxHeight: height - Math.max(insets.top, 24) - 12,
                paddingBottom: Math.max(insets.bottom, 16) + 16,
              },
            ]}
          >
            {/* Modal Header */}
            <View
              style={[
                styles.createPostHeader,
                { borderBottomColor: colors.border },
              ]}
            >
              <TouchableOpacity
                onPress={() => setPostModalVisible(false)}
                style={[
                  styles.createPostCloseBtn,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(0,0,0,0.05)",
                  },
                ]}
              >
                <Text
                  style={[styles.createPostCloseText, { color: colors.text }]}
                >
                  &times;
                </Text>
              </TouchableOpacity>
              <Text style={[styles.createPostTitle, { color: colors.text }]}>
                Create Update
              </Text>
              <TouchableOpacity
                style={[
                  styles.createPostSubmitBtn,
                  {
                    backgroundColor: newPostText.trim()
                      ? colors.primary
                      : colors.border,
                  },
                ]}
                onPress={handleCreatePost}
                disabled={!newPostText.trim()}
              >
                <Text
                  style={[
                    styles.createPostSubmitBtnText,
                    { color: newPostText.trim() ? "white" : colors.textDimmed },
                  ]}
                >
                  Post
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.createPostBody}
              contentContainerStyle={styles.createPostBodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Author Profile Row */}
              <View style={styles.createPostUserRow}>
                <Image
                  source={{
                    uri:
                      currentUser.avatar ||
                      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80",
                  }}
                  style={styles.createPostUserAvatar}
                />
                <View style={styles.createPostUserInfo}>
                  <Text
                    style={[styles.createPostUserName, { color: colors.text }]}
                  >
                    {currentUser.name || "User124"}
                  </Text>
                  <View style={styles.postLanguageBadge}>
                    <Text
                      style={[
                        styles.postLanguageBadgeText,
                        { color: colors.primary },
                      ]}
                    >
                      {getLangDetails(currentUser.nativeLang || "en").flag ||
                        "??"}{" "}
                      Posting as{" "}
                      {getLangDetails(currentUser.nativeLang || "en").name}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Text Input area */}
              <TextInput
                style={[
                  styles.createPostInput,
                  { color: colors.text, borderColor: colors.border },
                ]}
                placeholder="What's on your mind? Share an update..."
                placeholderTextColor={colors.textDimmed}
                multiline
                value={newPostText}
                onChangeText={setNewPostText}
                textAlignVertical="top"
              />

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.postGradientPickerRow}
              >
                {POST_BACKGROUND_PRESETS.map((preset) => {
                  const isSelected =
                    newPostMediaType === "gradient" &&
                    newPostBackgroundKey === preset.id;
                  return (
                    <TouchableOpacity
                      key={preset.id}
                      onPress={() => handlePickGradient(preset.id)}
                      style={[
                        styles.postGradientChip,
                        isSelected && styles.postGradientChipSelected,
                      ]}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={preset.colors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.postGradientChipSwatch}
                      />
                      <Text
                        style={[
                          styles.postGradientChipLabel,
                          { color: colors.text },
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.postMediaActionRow}>
                <TouchableOpacity
                  style={[
                    styles.pickPhotoBtn,
                    {
                      borderColor: colors.primary,
                      backgroundColor: isDark
                        ? "rgba(168,85,247,0.1)"
                        : "rgba(168,85,247,0.05)",
                    },
                  ]}
                  onPress={handlePickPostImage}
                  activeOpacity={0.8}
                >
                  <Svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.primary}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <Circle cx="8.5" cy="8.5" r="1.5" />
                    <Polyline points="21 15 16 10 5 21" />
                  </Svg>
                  <Text
                    style={[styles.pickPhotoBtnText, { color: colors.primary }]}
                  >
                    Add Photos or Video
                  </Text>
                </TouchableOpacity>
              </View>

              {newPostImages.length > 0 && newPostMediaType === "image" && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginTop: 10 }}
                >
                  {newPostImages.map((uri, index) => (
                    <View
                      key={index}
                      style={[
                        styles.createPostImgPreviewContainer,
                        { marginRight: 10 },
                      ]}
                    >
                      <Image
                        source={{ uri }}
                        style={styles.createPostImgPreview}
                      />
                      <TouchableOpacity
                        style={[
                          styles.deleteImgBtn,
                          { backgroundColor: colors.danger },
                        ]}
                        onPress={() => {
                          setNewPostImages((prev) => {
                            const next = prev.filter((_, i) => i !== index);
                            if (next.length === 0)
                              setNewPostMediaType("gradient");
                            return next;
                          });
                        }}
                      >
                        <Text style={styles.deleteImgBtnText}>&times;</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              {newPostImages.length > 0 && newPostMediaType === "video" && (
                <View style={styles.createPostVideoPreview}>
                  <LinearGradient
                    colors={
                      getPostBackgroundPreset(newPostBackgroundKey).colors
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.createPostVideoGradient}
                  >
                    <Text style={styles.postVideoBadge}>VIDEO</Text>
                    <Text style={styles.createPostVideoText}>
                      Video selected
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.deleteImgBtn,
                        { backgroundColor: colors.danger },
                      ]}
                      onPress={() => {
                        setNewPostImages([]);
                        setNewPostMediaType("gradient");
                      }}
                    >
                      <Text style={styles.deleteImgBtnText}>&times;</Text>
                    </TouchableOpacity>
                  </LinearGradient>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Post Options Bottom Sheet Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={optionsPost !== null}
        onRequestClose={() => setOptionsPost(null)}
      >
        <View style={styles.optionsSheetOverlay}>
          <Pressable
            style={styles.optionsSheetBackdrop}
            onPress={() => setOptionsPost(null)}
          />

          <View
            style={[
              styles.optionsSheetContent,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.optionsSheetHandle,
                {
                  backgroundColor: isDark
                    ? "rgba(255, 255, 255, 0.2)"
                    : "rgba(0, 0, 0, 0.15)",
                },
              ]}
            />

            <View style={styles.optionsSheetList}>
              {optionsPost && (
                <>
                  {/* Share Option */}
                  <TouchableOpacity
                    style={[
                      styles.optionsSheetItem,
                      { borderBottomColor: colors.border },
                    ]}
                    onPress={() => handleSharePost(optionsPost)}
                    activeOpacity={0.7}
                  >
                    <Svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={colors.text}
                      strokeWidth="2"
                    >
                      <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <Polyline points="16 6 12 2 8 6" />
                      <Line x1="12" y1="2" x2="12" y2="15" />
                    </Svg>
                    <Text
                      style={[
                        styles.optionsSheetItemText,
                        { color: colors.text },
                      ]}
                    >
                      Share Update
                    </Text>
                  </TouchableOpacity>

                  {/* Copy Link Option */}
                  <TouchableOpacity
                    style={[
                      styles.optionsSheetItem,
                      { borderBottomColor: colors.border },
                    ]}
                    onPress={handleCopyLink}
                    activeOpacity={0.7}
                  >
                    <Svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={colors.text}
                      strokeWidth="2"
                    >
                      <Rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </Svg>
                    <Text
                      style={[
                        styles.optionsSheetItemText,
                        { color: colors.text },
                      ]}
                    >
                      Copy Link
                    </Text>
                  </TouchableOpacity>

                  {/* Owner Delete Option vs Non-Owner Actions */}
                  {optionsPost.authorName ===
                    (currentUser.name || "User124") ||
                  optionsPost.authorName === "Me" ? (
                    <TouchableOpacity
                      style={[styles.optionsSheetItem, styles.deleteOptionItem]}
                      onPress={() => handleDeletePost(optionsPost.id)}
                      activeOpacity={0.7}
                    >
                      <Svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#EF4444"
                        strokeWidth="2"
                      >
                        <Polyline points="3 6 5 6 21 6" />
                        <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <Line x1="10" y1="11" x2="10" y2="17" />
                        <Line x1="14" y1="11" x2="14" y2="17" />
                      </Svg>
                      <Text
                        style={[
                          styles.optionsSheetItemText,
                          { color: "#EF4444", fontWeight: "600" },
                        ]}
                      >
                        Delete Update
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.optionsSheetItem,
                          { borderBottomColor: colors.border },
                        ]}
                        onPress={() => handleReportPost(optionsPost)}
                        activeOpacity={0.7}
                      >
                        <Svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#EF4444"
                          strokeWidth="2"
                        >
                          <Path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                          <Line x1="4" y1="22" x2="4" y2="15" />
                        </Svg>
                        <Text
                          style={[
                            styles.optionsSheetItemText,
                            { color: "#EF4444" },
                          ]}
                        >
                          Report Update
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.optionsSheetCancelBtn,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.05)",
                },
              ]}
              onPress={() => setOptionsPost(null)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.optionsSheetCancelText, { color: colors.text }]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bottom Sheet Comments Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={activeCommentsPostId !== null}
        onRequestClose={() => setActiveCommentsPostId(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.bottomSheetOverlay}
        >
          {/* Backdrop pressable to close sheet */}
          <Pressable
            style={styles.bottomSheetBackdrop}
            onPress={() => setActiveCommentsPostId(null)}
          />

          <View
            style={[
              styles.bottomSheetContent,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
            ]}
          >
            {/* Grabber Handle */}
            <View
              style={[
                styles.bottomSheetHandle,
                {
                  backgroundColor: isDark
                    ? "rgba(255, 255, 255, 0.2)"
                    : "rgba(0, 0, 0, 0.15)",
                },
              ]}
            />

            {/* Header */}
            <View
              style={[
                styles.bottomSheetHeader,
                { borderBottomColor: colors.border },
              ]}
            >
              <Text style={[styles.bottomSheetTitle, { color: colors.text }]}>
                Comments ({activePost ? (activePost.comments?.length ?? 0) : 0})
              </Text>
              <TouchableOpacity
                onPress={() => setActiveCommentsPostId(null)}
                style={[
                  styles.bottomSheetCloseBtn,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(0,0,0,0.05)",
                  },
                ]}
              >
                <Text
                  style={[styles.bottomSheetCloseText, { color: colors.text }]}
                >
                  &times;
                </Text>
              </TouchableOpacity>
            </View>

            {/* Comments List */}
            <ScrollView
              contentContainerStyle={styles.bottomSheetScroll}
              showsVerticalScrollIndicator={false}
            >
              {activePost && (activePost.comments?.length ?? 0) > 0 ? (
                (activePost.comments ?? []).map((comment) => (
                  <View key={comment.id} style={styles.bottomSheetCommentItem}>
                    <View style={styles.bottomSheetCommentAvatarContainer}>
                      <Image
                        source={{ uri: getAuthorAvatar(comment.author) }}
                        style={styles.bottomSheetCommentAvatar}
                      />
                    </View>
                    <View style={styles.bottomSheetCommentContentContainer}>
                      <View
                        style={[
                          styles.bottomSheetCommentBubble,
                          { backgroundColor: isDark ? "#1E1636" : "#E4E6EB" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.bottomSheetCommentAuthor,
                            { color: colors.text },
                          ]}
                        >
                          {comment.author}
                        </Text>
                        <Text
                          style={[
                            styles.bottomSheetCommentText,
                            { color: colors.text },
                          ]}
                        >
                          {comment.content}
                        </Text>
                      </View>

                      {/* Facebook action row under the bubble */}
                      <View style={styles.bottomSheetCommentActions}>
                        <Text
                          style={[
                            styles.bottomSheetCommentActionText,
                            { color: colors.textDimmed },
                          ]}
                        >
                          Just now
                        </Text>
                        <Text
                          style={[
                            styles.bottomSheetCommentActionBullet,
                            { color: colors.textDimmed },
                          ]}
                        >
                          •
                        </Text>
                        <TouchableOpacity activeOpacity={0.7}>
                          <Text
                            style={[
                              styles.bottomSheetCommentActionBtnText,
                              { color: colors.textMuted },
                            ]}
                          >
                            Like
                          </Text>
                        </TouchableOpacity>
                        <Text
                          style={[
                            styles.bottomSheetCommentActionBullet,
                            { color: colors.textDimmed },
                          ]}
                        >
                          •
                        </Text>
                        <TouchableOpacity activeOpacity={0.7}>
                          <Text
                            style={[
                              styles.bottomSheetCommentActionBtnText,
                              { color: colors.textMuted },
                            ]}
                          >
                            Reply
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.noCommentsContainer}>
                  <Text
                    style={[
                      styles.noCommentsText,
                      { color: colors.textDimmed },
                    ]}
                  >
                    No comments yet. Be the first to comment!
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Comment Input Bar */}
            <View
              style={[
                styles.bottomSheetInputRow,
                { borderTopColor: colors.border },
              ]}
            >
              <View style={styles.bottomSheetInputActionsLeft}>
                <TouchableOpacity
                  style={styles.bottomSheetInputIconBtn}
                  activeOpacity={0.7}
                >
                  <Svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.textDimmed}
                    strokeWidth="2"
                  >
                    <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <Circle cx="12" cy="13" r="4" />
                  </Svg>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[
                  styles.bottomSheetInput,
                  {
                    backgroundColor: isDark ? "#1E1636" : "#F1F5F9",
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="Write a comment..."
                placeholderTextColor={colors.textDimmed}
                value={newCommentText}
                onChangeText={setNewCommentText}
                onSubmitEditing={handleSheetAddComment}
              />
              <TouchableOpacity
                style={[
                  styles.bottomSheetSendBtn,
                  {
                    backgroundColor: newCommentText.trim()
                      ? colors.primary
                      : isDark
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(0,0,0,0.05)",
                  },
                ]}
                onPress={handleSheetAddComment}
                disabled={!newCommentText.trim()}
              >
                <Svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={newCommentText.trim() ? "white" : colors.textDimmed}
                  strokeWidth="2.5"
                >
                  <Line x1="22" y1="2" x2="11" y2="13" />
                  <Polygon points="22 2 15 22 11 13 2 9 22 2" />
                </Svg>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Start Conversation Modal (Search and filter popup) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={startConvModalVisible}
        onRequestClose={() => setStartConvModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.startConvModalContent,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitleText, { color: colors.text }]}>
                Start Translation Chat
              </Text>
              <TouchableOpacity
                onPress={() => setStartConvModalVisible(false)}
                style={[styles.modalCloseBtn, { backgroundColor: colors.bg }]}
              >
                <Text
                  style={[
                    styles.modalCloseBtnText,
                    { color: colors.textDimmed },
                  ]}
                >
                  &times;
                </Text>
              </TouchableOpacity>
            </View>

            {/* Filter Tabs removed as per user request (now defaults to global) */}
            {/* Search Input */}
            <View
              style={[
                styles.modalSearchBox,
                { backgroundColor: colors.bg, borderColor: colors.border },
              ]}
            >
              <Svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke={colors.textDimmed}
                strokeWidth="2"
                style={{ marginRight: 8 }}
              >
                <Circle cx="11" cy="11" r="8" />
                <Line x1="21" y1="21" x2="16.65" y2="16.65" />
              </Svg>
              <TextInput
                style={[styles.modalSearchInput, { color: colors.text }]}
                placeholder="Search by name or UID"
                placeholderTextColor={colors.textDimmed}
                value={startConvSearch}
                onChangeText={setStartConvSearch}
              />
            </View>

            {/* Scrollable list of matched partners */}
            <ScrollView
              style={styles.modalScrollList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {(() => {
                const sourceList =
                  startConvFilter === "contacts"
                    ? displayedContacts
                    : displayedExplore;
                
                let filtered = sourceList.filter(
                  (item) =>
                    item.name
                      .toLowerCase()
                      .includes(startConvSearch.toLowerCase()) ||
                    item.id
                      .toLowerCase()
                      .includes(startConvSearch.toLowerCase()),
                );

                // Ensure AI Companion (unity_ai) is always in the list and sorted first
                const hasAI = filtered.some((item) => item.id === "unity_ai");
                if (!hasAI) {
                  const aiContact = displayedContacts.find((c) => c.id === "unity_ai") || {
                    id: "unity_ai",
                    name: "unity AI",
                    avatar: require("../../assets/icon.png"),
                    flag: "🌍",
                    langName: "AI Companion",
                    status: "Ready to chat",
                    isUnityUser: true,
                  };
                  const matchesSearch =
                    aiContact.name.toLowerCase().includes(startConvSearch.toLowerCase()) ||
                    aiContact.id.toLowerCase().includes(startConvSearch.toLowerCase());
                  if (matchesSearch) {
                    filtered = [aiContact, ...filtered];
                  }
                }

                // Unity AI always first, then Xaylite-available users
                filtered.sort((a, b) => {
                  if (a.id === "unity_ai") return -1;
                  if (b.id === "unity_ai") return 1;
                  const aVal = a.isUnityUser === true || a.isUnityUser === 1 ? 1 : 0;
                  const bVal = b.isUnityUser === true || b.isUnityUser === 1 ? 1 : 0;
                  return bVal - aVal;
                });

                if (filtered.length === 0) {
                  return (
                    <View style={styles.modalEmptyState}>
                      <Text
                        style={[
                          styles.modalEmptyText,
                          { color: colors.textDimmed, marginBottom: 16 },
                        ]}
                      >
                        {`No partners found matching "${startConvSearch}"`}
                      </Text>
                      {startConvFilter === "contacts" &&
                        startConvSearch.trim().length > 0 && (
                          <TouchableOpacity
                            style={[
                              styles.modalAddContactCard,
                              { borderColor: colors.border },
                            ]}
                            onPress={() =>
                              handleConfirmAddContact(startConvSearch.trim())
                            }
                            activeOpacity={0.7}
                          >
                            <View
                              style={[
                                styles.modalAddContactIconBg,
                                { backgroundColor: colors.primaryGlow },
                              ]}
                            >
                              <Svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke={colors.primary}
                                strokeWidth="2.5"
                              >
                                <Path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <Circle cx="9" cy="7" r="4" />
                                <Line x1="19" y1="8" x2="19" y2="14" />
                                <Line x1="16" y1="11" x2="22" y2="11" />
                              </Svg>
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text
                                style={[
                                  styles.modalAddContactText,
                                  { color: colors.text },
                                ]}
                              >
                                {`Add "${startConvSearch.trim()}" to Contacts`}
                              </Text>
                              <Text
                                style={{
                                  color: colors.textDimmed,
                                  fontSize: 11,
                                  marginTop: 2,
                                }}
                              >
                                Start a new translated conversation
                              </Text>
                            </View>
                          </TouchableOpacity>
                        )}
                    </View>
                  );
                }

                return filtered.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.modalPartnerCard,
                      { borderBottomColor: colors.border },
                    ]}
                    onPress={() => {
                      if (!item.isUnityUser) {
                        const message =
                          "🤯 I'm talking to people in different languages with XayLite, even animals. You should try it too! Download: https://keysire.com";
                        const phone = (item.phone || "").replace(/\D/g, "");
                        Linking.openURL(
                          `whatsapp://send?text=${encodeURIComponent(message)}&phone=${phone}`,
                        ).catch(() => {
                          Alert.alert(
                            "WhatsApp not found",
                            "Could not open WhatsApp. Please make sure it is installed.",
                          );
                        });
                        return;
                      }
                      setStartConvModalVisible(false);
                      handlePartnerClick(
                        item.name,
                        item.avatar_local_path || item.avatar,
                        item.flag,
                        item.id,
                      );
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.modalAvatarContainer}>
                      <Image
                        source={{ uri: item.avatar_local_path || item.avatar }}
                        style={styles.modalAvatar}
                      />
                      {isOnlineContact(item) && (
                        <View
                          style={[
                            styles.onlineBadge,
                            { borderColor: colors.cardBg },
                          ]}
                        />
                      )}
                      <View
                        style={[
                          styles.modalFlagBadge,
                          { backgroundColor: colors.bg },
                        ]}
                      >
                        {renderFlagOrEmoji(item.flag)}
                      </View>
                    </View>
                    <View style={styles.modalPartnerInfo}>
                      <View style={styles.modalNameRow}>
                        <Text
                          style={[
                            styles.modalPartnerName,
                            { color: colors.text },
                          ]}
                        >
                          {item.name}
                        </Text>
                        <Text
                          style={[
                            styles.modalPartnerUid,
                            { color: colors.textDimmed },
                          ]}
                        >
                          #{item.id}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.modalPartnerLang,
                          { color: colors.primary },
                        ]}
                      >
                        {item.langName}
                      </Text>
                      {startConvFilter === "contacts" ? (
                        <Text
                          style={[
                            styles.modalPartnerBio,
                            { color: colors.textMuted },
                          ]}
                          numberOfLines={1}
                        >
                          {item.status}
                        </Text>
                      ) : (
                        <Text
                          style={[
                            styles.modalPartnerBio,
                            { color: colors.textMuted },
                          ]}
                          numberOfLines={1}
                        >
                          {item.bio}
                        </Text>
                      )}
                    </View>
                    <View
                      style={[
                        styles.modalPartnerCta,
                        {
                          backgroundColor:
                            !item.isUnityUser
                              ? colors.border
                              : colors.primaryGlow,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.modalPartnerCtaText,
                          {
                            color:
                              !item.isUnityUser
                                ? colors.text
                                : colors.primary,
                          },
                        ]}
                      >
                        {!item.isUnityUser ? "Invite" : "Chat"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ));
              })()}
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
  safeArea: {
    width: "100%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerGreeting: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  menuBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingBottom: 160,
  },
  ctaContainer: {
    alignItems: "center",
    marginVertical: 32,
  },
  pulseRing: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  ctaButtonWrapper: {
    position: "relative",
    width: 170,
    height: 170,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 28,
  },
  giantCta: {
    width: 130,
    height: 130,
    borderRadius: 65,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      web: {
        boxShadow: "0px 10px 20px rgba(139,92,246,0.35)",
      },
      default: {
        shadowColor: "#8B5CF6",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
        elevation: 8,
      },
    }),
  },
  giantCtaGradient: {
    flex: 1,
    width: "100%",
    height: "100%",
    borderRadius: 65,
    justifyContent: "center",
    alignItems: "center",
  },
  ctaTitle: {
    fontSize: 21,
    fontWeight: "700",
  },
  ctaSubtitle: {
    fontSize: 14,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginLeft: 20,
    marginBottom: 12,
  },
  convList: {
    borderWidth: 1,
    borderRadius: 20,
    marginHorizontal: 20,
    overflow: "hidden",
    ...Platform.select({
      web: {
        boxShadow: "0px 2px 6px rgba(0,0,0,0.02)",
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 6,
        elevation: 1,
      },
    }),
  },
  convCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  avatarContainer: {
    position: "relative",
    marginRight: 14,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  flagBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      web: {
        boxShadow: "0px 1px 2px rgba(0,0,0,0.2)",
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
      },
    }),
    overflow: "hidden",
  },
  flagImage: {
    width: "100%",
    height: "100%",
  },
  flagText: {
    fontSize: 13,
  },
  multiFlagsWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  flagImageMulti: {
    width: 14,
    height: 10,
    borderRadius: 1.5,
  },
  importCard: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  importCardGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  importIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  importInfo: {
    flex: 1,
  },
  importTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  importDesc: {
    fontSize: 12,
    marginTop: 4,
  },
  importSuccessCard: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  importSuccessText: {
    fontSize: 13,
    fontWeight: "600",
  },
  contactStatus: {
    fontSize: 12,
    fontWeight: "500",
  },
  exploreGrid: {
    paddingHorizontal: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  exploreCard: {
    width: (width - 54) / 2,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 14,
    ...Platform.select({
      web: {
        boxShadow: "0px 4px 8px rgba(0,0,0,0.04)",
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
    position: "relative",
  },
  exploreImage: {
    width: "100%",
    height: 120,
  },
  exploreFlagBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      web: {
        boxShadow: "0px 2px 4px rgba(0,0,0,0.15)",
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
    overflow: "hidden",
  },
  exploreCardDetails: {
    padding: 12,
    flex: 1,
    justifyContent: "space-between",
  },
  exploreName: {
    fontSize: 14,
    fontWeight: "700",
  },
  exploreLang: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
    marginBottom: 6,
  },
  exploreBio: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
    height: 32,
  },
  exploreCta: {
    borderRadius: 10,
    overflow: "hidden",
  },
  exploreCtaGradient: {
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  exploreCtaText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  updatesContainer: {
    paddingTop: 8,
  },
  postCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    ...Platform.select({
      web: {
        boxShadow: "0px 4px 8px rgba(0,0,0,0.02)",
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.02,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  postAuthorInfo: {
    marginLeft: 12,
  },
  postAuthorName: {
    fontSize: 15,
    fontWeight: "700",
  },
  postTimeText: {
    fontSize: 11,
    marginTop: 2,
  },
  postContentText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  postImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
  },
  postImageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 4,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
  },
  gridImageWrapper: {
    overflow: "hidden",
  },
  gridItemSingle: {
    width: "100%",
    height: 250,
  },
  gridItemHalf: {
    width: "49.5%",
    height: 250,
  },
  gridItemFullTop: {
    width: "100%",
    height: 200,
  },
  gridItemHalfBottom: {
    width: "49.5%",
    height: 150,
  },
  gridItemQuarter: {
    width: "49.5%",
    height: 125,
  },
  gridImage: {
    width: "100%",
    height: "100%",
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  gridOverlayText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
  postStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: 1,
    marginBottom: 10,
  },
  postStatsText: {
    fontSize: 12,
  },
  postActionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  postActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  postActionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  commentsSection: {
    marginTop: 12,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  commentItem: {
    marginBottom: 8,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: "700",
  },
  commentContent: {
    fontWeight: "400",
  },
  commentInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  commentInput: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 13,
  },
  commentSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  convBodyPress: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  convDetails: {
    flex: 1,
  },
  convHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  partnerName: {
    fontSize: 15,
    fontWeight: "600",
  },
  convTime: {
    fontSize: 11,
  },
  convPreview: {
    fontSize: 13,
  },
  boldPreviewText: {
    fontWeight: "600",
  },
  convArrow: {
    marginLeft: 8,
  },
  groupCtaCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderWidth: 1,
    borderRadius: 18,
    marginHorizontal: 20,
    marginVertical: 16,
  },
  groupCtaIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  groupCtaInfo: {
    flex: 1,
  },
  groupCtaTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  groupCtaDesc: {
    fontSize: 12,
    marginTop: 4,
  },
  groupAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    position: "relative",
  },
  groupAvatarText: {
    fontSize: 14,
    fontWeight: "700",
  },
  flagBadgeMulti: {
    position: "absolute",
    bottom: -4,
    right: -4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  flagTextMulti: {
    fontSize: 11,
  },
  callIndicatorBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  callArrow: {
    color: "white",
    fontSize: 10,
    fontWeight: "800",
  },
  onlineBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10B981",
    borderWidth: 2,
    zIndex: 2,
  },
  onboardingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  onboardingCard: {
    width: "100%",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    ...Platform.select({
      web: {
        boxShadow: "0px 10px 20px rgba(0,0,0,0.15)",
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
      },
    }),
  },
  onboardingHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  promptIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  promptDetails: {
    flex: 1,
  },
  promptTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  promptProgressText: {
    fontSize: 12,
    marginTop: 2,
  },
  closeMiniBtn: {
    padding: 4,
  },
  closeMiniText: {
    fontSize: 22,
    lineHeight: 22,
  },
  progressBarContainer: {
    width: "100%",
    height: 6,
    backgroundColor: "rgba(0,0,0,0.06)",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 16,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
    overflow: "hidden",
  },
  fluidGradientContainer: {
    width: width * 1.5,
    height: "100%",
  },
  progressBarGradient: {
    width: "100%",
    height: "100%",
  },
  promptOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  optionPill: {
    borderWidth: 1,
    borderRadius: 30,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  pillCompleted: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderColor: "rgba(16, 185, 129, 0.25)",
    opacity: 0.6,
  },
  pillLabelCompleted: {
    color: "#10B981",
  },
  highlightPill: {
    backgroundColor: "rgba(79, 70, 229, 0.08)",
    borderColor: "rgba(79, 70, 229, 0.25)",
  },
  highlightLabel: {
    color: "#4F46E5",
  },
  tabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 76,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 10,
    ...Platform.select({
      web: {
        boxShadow: "0px -4px 10px rgba(0,0,0,0.04)",
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 8,
      },
    }),
  },
  fab: {
    position: "absolute",
    right: 24,
    bottom: 70,
    width: 56,
    height: 56,
    borderRadius: 28,
    ...Platform.select({
      web: {
        boxShadow: "0px 4px 6px rgba(79,70,229,0.3)",
      },
      default: {
        shadowColor: "#4F46E5",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
      },
    }),
    zIndex: 10,
  },
  fabGradient: {
    flex: 1,
    width: "100%",
    height: "100%",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  tabBarBtn: {
    alignItems: "center",
    justifyContent: "center",
    width: 70,
  },
  tabIconBg: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
  },
  tabBarLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  shoutoutContainer: {
    padding: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  shoutoutTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#10B981",
    marginBottom: 4,
  },
  shoutoutText: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(10, 6, 18, 0.6)",
    justifyContent: "flex-end",
  },
  startConvModalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    height: "80%",
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitleText: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseBtnText: {
    fontSize: 22,
    lineHeight: 24,
  },
  modalFilterRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  modalFilterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  modalFilterChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  modalSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 0,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 16,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    height: "100%",
    padding: 0,
    outlineStyle: "none",
  },
  modalScrollList: {
    flex: 1,
  },
  modalPartnerCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalAvatarContainer: {
    position: "relative",
  },
  modalAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  modalFlagBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      web: {
        boxShadow: "0px 1px 1px rgba(0,0,0,0.2)",
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
        elevation: 2,
      },
    }),
    overflow: "hidden",
  },
  modalPartnerInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  modalNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalPartnerName: {
    fontSize: 14,
    fontWeight: "700",
  },
  modalPartnerUid: {
    fontSize: 11,
  },
  modalPartnerLang: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  modalPartnerBio: {
    fontSize: 12,
    marginTop: 2,
  },
  modalPartnerCta: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  modalPartnerCtaText: {
    fontSize: 12,
    fontWeight: "700",
  },
  modalEmptyState: {
    paddingVertical: 40,
    alignItems: "center",
  },
  modalEmptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  modalAddContactCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    width: "100%",
    marginTop: 8,
  },
  modalAddContactIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  modalAddContactText: {
    fontSize: 14,
    fontWeight: "700",
  },
  bottomSheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  bottomSheetBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomSheetContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderBottomWidth: 0,
    height: "75%",
  },
  bottomSheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    alignSelf: "center",
    marginVertical: 8,
  },
  bottomSheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  bottomSheetTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  bottomSheetCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  bottomSheetCloseText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: -2,
  },
  bottomSheetScroll: {
    paddingVertical: 16,
    paddingBottom: 40,
  },
  bottomSheetCommentItem: {
    flexDirection: "row",
    marginBottom: 16,
    alignItems: "flex-start",
  },
  bottomSheetCommentAvatarContainer: {
    marginRight: 10,
  },
  bottomSheetCommentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  bottomSheetCommentContentContainer: {
    flex: 1,
  },
  bottomSheetCommentBubble: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bottomSheetCommentAuthor: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 3,
  },
  bottomSheetCommentText: {
    fontSize: 14,
    lineHeight: 19,
  },
  bottomSheetCommentActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginLeft: 12,
  },
  bottomSheetCommentActionText: {
    fontSize: 12,
  },
  bottomSheetCommentActionBullet: {
    fontSize: 12,
    marginHorizontal: 6,
  },
  bottomSheetCommentActionBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  bottomSheetInputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
  },
  bottomSheetInputActionsLeft: {
    marginRight: 8,
  },
  bottomSheetInputIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  bottomSheetInput: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    marginRight: 8,
    fontSize: 14,
  },
  bottomSheetSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  noCommentsContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  noCommentsText: {
    fontSize: 14,
    textAlign: "center",
  },
  createPostModalContent: {
    width: "100%",
    height: "96%",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  postMediaActionRow: {
    flexDirection: "row",
    marginTop: 16,
    marginBottom: 8,
  },
  pickPhotoBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: "dashed",
  },
  pickPhotoBtnText: {
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 8,
  },
  createPostHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  createPostCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  createPostCloseText: {
    fontSize: 22,
    lineHeight: 24,
  },
  createPostTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  createPostSubmitBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createPostSubmitBtnText: {
    fontWeight: "700",
    fontSize: 14,
  },
  createPostBody: {
    flexGrow: 0,
    flexShrink: 1,
  },
  createPostBodyContent: {
    paddingBottom: 4,
  },
  createPostUserRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  createPostUserAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  createPostUserInfo: {
    flex: 1,
  },
  createPostUserName: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  tagFlagsScroll: {
    flexDirection: "row",
    marginTop: 4,
  },
  tagFlagBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    marginRight: 6,
  },
  tagFlagText: {
    fontSize: 14,
  },
  createPostInput: {
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: "top",
    minHeight: 104,
    maxHeight: 156,
    paddingVertical: 8,
  },
  createPostImgPreviewContainer: {
    position: "relative",
    width: 100,
    height: 132,
    borderRadius: 12,
    overflow: "hidden",
    marginVertical: 10,
  },
  createPostImgPreview: {
    width: "100%",
    height: "100%",
  },
  deleteImgBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteImgBtnText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 20,
  },
  attachHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 10,
    marginBottom: 8,
  },
  attachLabel: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  choosePhotoBtn: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  choosePhotoText: {
    fontSize: 12,
    fontWeight: "700",
  },
  presetImagesScroll: {
    flexDirection: "row",
    maxHeight: 78,
  },
  presetImgBtn: {
    width: 72,
    height: 72,
    borderRadius: 10,
    marginRight: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  presetImgThumb: {
    width: "100%",
    height: "100%",
  },
  postHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  postHeaderActionBtn: {
    padding: 4,
  },
  optionsSheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  optionsSheetBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  optionsSheetContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  optionsSheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    alignSelf: "center",
    marginBottom: 20,
  },
  optionsSheetList: {
    marginBottom: 16,
  },
  optionsSheetItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  optionsSheetItemText: {
    fontSize: 15,
    fontWeight: "500",
  },
  deleteOptionItem: {
    borderBottomWidth: 0,
  },
  optionsSheetCancelBtn: {
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  optionsSheetCancelText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
