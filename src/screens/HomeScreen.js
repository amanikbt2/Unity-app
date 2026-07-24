/* eslint-disable react-hooks/refs */
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
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
  Share,
  RefreshControl,
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
import { fetchLatestNews } from "../services/NewsService";
import { scheduleLocalNotification } from "../services/NotificationService";
import {
  initDatabase,
  getContacts as getDbContacts,
  saveContacts as saveDbContacts,
  getNewsArticles as getDbNewsArticles,
  saveNewsArticles as saveDbNewsArticles,
  toggleNewsBookmark as toggleDbNewsBookmark,
  toggleNewsLike as toggleDbNewsLike,
  incrementNewsView as incrementDbNewsView,
  saveAdminArticle as saveDbAdminArticle,
  deleteNewsArticle as deleteDbNewsArticle,
  getExploreProfiles as getDbExplore,
  saveExploreProfiles as saveDbExplore,
  getCallLogs as getDbCallLogs,
  getRecentConversationsMap as getDbRecentConversationsMap,
  clearContactUnread as clearDbContactUnread,
  hasUnsyncedContacts,
  getUnsyncedContactsCount,
  incrementContactUnread,
  saveChat,
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
const getCurrentTimestamp = () => Date.now();

import { getSafeAvatarSource, DEFAULT_AVATARS } from "../utils/avatarUtils";

const getDefaultAvatar = (seed) => getSafeAvatarSource(null, seed);

// Helper to check if a news article is related to a specific country
function isArticleRelatedToCountry(art, country) {
  if (!art || !country) return false;
  const c = country.toLowerCase();
  const title = (art.title || "").toLowerCase();
  const summary = (art.summary || "").toLowerCase();
  const category = (art.category || "").toLowerCase();
  const tags = (art.tags || []).map(t => String(t).toLowerCase());

  if (title.includes(c) || summary.includes(c) || category.includes(c) || tags.includes(c)) {
    return true;
  }

  // Handle common country aliases/related terms
  if (c === "kenya") {
    return title.includes("nairobi") || summary.includes("nairobi") || tags.includes("nairobi") || title.includes("savannah");
  }
  if (c === "united states") {
    return title.includes("us ") || title.includes("usa") || title.includes("america") || tags.includes("usa") || tags.includes("us");
  }
  if (c === "united kingdom") {
    return title.includes("uk ") || title.includes("london") || tags.includes("uk") || tags.includes("gb");
  }
  if (c === "japan") {
    return title.includes("tokyo") || tags.includes("tokyo");
  }
  if (c === "germany") {
    return title.includes("munich") || title.includes("berlin") || tags.includes("munich");
  }
  if (c === "spain") {
    return title.includes("madrid") || title.includes("barcelona") || tags.includes("spain");
  }
  if (c === "france") {
    return title.includes("paris") || tags.includes("paris");
  }
  return false;
}

// Helper function to calculate a location relevance match score
function getCountryScore(art, country) {
  if (!art || !country) return 0;
  const c = country.toLowerCase();
  let score = 0;
  
  const title = (art.title || "").toLowerCase();
  const summary = (art.summary || "").toLowerCase();
  const category = (art.category || "").toLowerCase();
  const tags = (art.tags || []).map(t => String(t).toLowerCase());

  if (title.includes(c)) score += 10;
  if (tags.includes(c)) score += 8;
  if (summary.includes(c)) score += 5;
  if (category.includes(c)) score += 3;

  // Handle aliases/region terms
  if (c === "kenya") {
    if (title.includes("nairobi") || title.includes("savannah")) score += 6;
    if (summary.includes("nairobi")) score += 3;
  } else if (c === "united states") {
    if (title.includes("us ") || title.includes("usa") || title.includes("america")) score += 6;
    if (summary.includes("us ") || summary.includes("usa") || summary.includes("america")) score += 3;
  } else if (c === "germany") {
    if (title.includes("munich") || title.includes("berlin")) score += 6;
  } else if (c === "spain") {
    if (title.includes("madrid") || title.includes("barcelona")) score += 6;
  }
  return score;
}

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
    name: "Xaylite AI",
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
    isUnityUser: true,
  },
  {
    id: "e2",
    name: "Hiroshi Sato",
    avatar: require("../../assets/default-avatar-1.jpg"),
    flag: "🇯🇵",
    langName: "Japanese (Japan)",
    bio: "Tech enthusiast and history buff. Happy to translate and chat!",
    isUnityUser: true,
  },
  {
    id: "dev@gmail.com",
    name: "Mr Man",
    avatar: require("../../assets/default-avatar-2.jpg"),
    flag: "🇺🇸",
    langName: "English (US)",
    bio: "System Administrator",
    isUnityUser: true,
  },
];

const SERVER_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";

export default function HomeScreen({ route, navigation }) {
  const { currentUser, getLangDetails, getLangDetailsFromFlag, LANGS } =
    useContext(AppContext);
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState("chats");
  const [callsFilter, setCallsFilter] = useState("all");
  const [callLogs, setCallLogs] = useState([]);
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [contactsFilter, setContactsFilter] = useState("my");
  const [contacts, setContacts] = useState(INITIAL_CONTACTS);
  const [syncedCount, setSyncedCount] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const handleImportContactsRef = useRef(null);
  const [imported, setImported] = useState(false);
  const [showImportSuccess, setShowImportSuccess] = useState(false);
  const [contactSearchText, setContactSearchText] = useState("");
  const [exploreSearchText, setExploreSearchText] = useState("");
  const [newsSearchText, setNewsSearchText] = useState("");
  const [newsArticles, setNewsArticles] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedNews, setSelectedNews] = useState(null);
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsAdminModalVisible, setNewsAdminModalVisible] = useState(false);
  const [adminEditingId, setAdminEditingId] = useState(null);
  const [adminTitle, setAdminTitle] = useState("");
  const [adminSummary, setAdminSummary] = useState("");
  const [adminContent, setAdminContent] = useState("");
  const [adminHeroImage, setAdminHeroImage] = useState("");
  const [adminCategory, setAdminCategory] = useState("Technology");
  const [shareNewsTargetArticle, setShareNewsTargetArticle] = useState(null);
  const [shareSearchText, setShareSearchText] = useState("");
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselRef = useRef(null);
  const [newsBadgeCount, setNewsBadgeCount] = useState(0);
  // Infinite-scroll pagination
  const [newsDisplayCount, setNewsDisplayCount] = useState(8);
  const [newsLoadingMore, setNewsLoadingMore] = useState(false);
  const newsShimmerPos = useMemo(() => new Animated.Value(-1), []);
  // News count ref (keeps filtered count without causing re-renders)
  const filteredNewsCountRef = useRef(0);
  // Scroll position tracking — used to restore position on back navigation
  const mainScrollRef = useRef(null);
  const scrollOffsetRef = useRef(0);
  const [exploreProfiles, setExploreProfiles] = useState(EXPLORE_PEOPLE);
  const [startConvModalVisible, setStartConvModalVisible] = useState(false);
  const [startConvSearch, setStartConvSearch] = useState("");
  const [startConvFilter, setStartConvFilter] = useState("contacts");
  const [profilePopupVisible, setProfilePopupVisible] = useState(false);
  const [profilePopupData, setProfilePopupData] = useState(null);
  const [detectedCountry, setDetectedCountry] = useState(null);
  const [recentConversations, setRecentConversations] = useState([]);

  // Non-blocking IP Geo-location lookup with a strict timeout
  useEffect(() => {
    let active = true;
    const fetchGeoIp = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        console.log("[Location] Non-blocking geo-IP lookup initiated...");
        const response = await fetch("https://ipapi.co/json/", { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (active && data && data.country_name) {
            console.log("[Location] Detected country from IP:", data.country_name);
            setDetectedCountry(data.country_name);
          }
        }
      } catch (err) {
        console.warn("[Location] Geo-IP lookup error/timeout (falling back to settings):", err.message);
      }
    };
    fetchGeoIp();
    return () => {
      active = false;
    };
  }, []);

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

  // Sliding shimmer loop – powers the Facebook-style skeleton cards
  useEffect(() => {
    const shimAnim = Animated.loop(
      Animated.timing(newsShimmerPos, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    shimAnim.start();
    return () => shimAnim.stop();
  }, [newsShimmerPos]);

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
   * Auto-sync contacts on app open (weekly interval or upon new login/signup).
   * Runs silently in the background. Shows inline success/fail.
   */
  useEffect(() => {
    let isActive = true;

    const autoSync = async () => {
      try {
        const justLoggedIn = route?.params?.justLoggedIn;
        const lastSyncTime = await getLastAutoSyncDate();
        let lastSyncMs = 0;
        if (lastSyncTime) {
          const parsed = Number(lastSyncTime);
          if (!isNaN(parsed) && parsed > 0) {
            lastSyncMs = parsed;
          } else {
            lastSyncMs = new Date(lastSyncTime).getTime() || 0;
          }
        }

        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
        const isWeeklyDue = !lastSyncMs || (getCurrentTimestamp() - lastSyncMs > SEVEN_DAYS_MS);

        if (!justLoggedIn && !isWeeklyDue) {
          console.log("[Contacts] App open: Using static DB contacts (synced within last 7 days).");
          const existing = await getDbContacts();
          if (existing && existing.length > 0) setContacts(existing);
          return;
        }

        console.log("[Contacts] Starting contact sync (Login/Account creation or 7-day interval)...");
        if (handleImportContactsRef.current) {
          await handleImportContactsRef.current(true);
        }
      } catch (err) {
        console.error("[Contacts] Auto-sync trigger error:", err);
      }
    };

    if (isActive) autoSync();

    return () => {
      isActive = false;
    };
  }, [route?.params?.justLoggedIn]);

  // NOTE: Auto-translation disabled — users tap 'See Translation' per post (Facebook style)
  // The postTranslations state is populated on-demand via handleSeeTranslation()


  // Background Pre-fetching function
  const preFetchServerData = async () => {
    try {
      console.log("[HomeScreen] Silently pre-fetching news & explore profiles...");
      const news = await fetchLatestNews("All");
      setNewsArticles(news);

      // Fetch Explore Profiles from Server
      const exploreResponse = await fetch(`${SERVER_URL}/api/explore`);
      if (exploreResponse.ok) {
        const remoteExplore = await exploreResponse.json();
        const exploreWithCachedMedia = await Promise.all(
          remoteExplore.map(async (profile) => {
            const localAvatar = profile.avatar
              ? await cacheRemoteImage(profile.avatar, "avatar")
              : null;
            return {
              ...profile,
              avatar_local_path: localAvatar || "",
              isUnityUser: true,
            };
          }),
        );
        await saveDbExplore(exploreWithCachedMedia);
        const updatedExplore = await getDbExplore();
        setExploreProfiles(updatedExplore);
      }
    } catch (err) {
      console.warn("[HomeScreen] News/Explore pre-fetch failed:", err.message);
    }
  };

  // Load offline data and pre-fetch server data on mount
  useEffect(() => {
    async function loadLocalData() {
      try {
        const dbSuccess = await initDatabase();
        if (!dbSuccess) {
          console.warn("[HomeScreen] Database initialization failed. Skipping local data load.");
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
          await saveDbContacts(INITIAL_CONTACTS);
          const initialWithTime = await getDbContacts();
          setContacts(initialWithTime);
        }

        // 2. Load News Articles
        const localNews = await getDbNewsArticles();
        if (localNews && localNews.length > 0) {
          setNewsArticles(localNews);
        } else {
          const news = await fetchLatestNews("All");
          setNewsArticles(news);
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
          console.warn("Background backup check failed:", err.message)
        );
      } catch (e) {
        console.error("Error loading local DB data on mount:", e);
      }
    }
    loadLocalData();
  }, [currentUser?.uid]);

  // Handle News Article Deep Linking
  useEffect(() => {
    if (route.params?.openNewsId) {
      const articleId = route.params.openNewsId;
      console.log("[HomeScreen] Deep-linked newsId received:", articleId);
      navigation.setParams({ openNewsId: undefined });

      async function findAndOpen() {
        const found = newsArticles.find(art => art.id === articleId);
        if (found) {
          setActiveTab("updates");
          setNewsBadgeCount(0);
          setSelectedNews(found);
          await incrementDbNewsView(articleId);
          found.views = (Number(found.views) || 0) + 1;
        } else {
          const cached = await getDbNewsArticles();
          const dbFound = cached.find(art => art.id === articleId);
          if (dbFound) {
            setActiveTab("updates");
            setNewsBadgeCount(0);
            setSelectedNews(dbFound);
            await incrementDbNewsView(articleId);
            dbFound.views = (Number(dbFound.views) || 0) + 1;
          }
        }
      }
      findAndOpen();
    }
  }, [route.params?.openNewsId, newsArticles]);

  useEffect(() => {
    // Show 9+ badge after 5 minutes, recurring every 5 minutes if not on updates tab
    const interval = setInterval(() => {
      setActiveTab((currentTab) => {
        if (currentTab !== "updates") {
          setNewsBadgeCount("9+");
        }
        return currentTab;
      });
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const loadRecentConversationsData = async () => {
    try {
      const { latestChatsMap, latestCallsMap } = await getDbRecentConversationsMap();
      const currentContacts = await getDbContacts();
      const baseContacts = currentContacts && currentContacts.length > 0 ? currentContacts : INITIAL_CONTACTS;

      const hasAI = baseContacts.some(c => c.id === "unity_ai");
      const candidates = hasAI ? [...baseContacts] : [INITIAL_CONTACTS[0], ...baseContacts];

      const merged = candidates.map(c => {
        const pId = c.id;
        const latestChat = latestChatsMap[pId];
        const latestCall = latestCallsMap[pId];

        let lastMsgText = "";
        let timestamp = Number(c.last_message_time || 0);

        const chatTime = latestChat ? Number(latestChat.timestamp || 0) : 0;
        const callTime = latestCall ? Number(latestCall.timestamp || 0) : 0;

        if (callTime > chatTime && callTime > timestamp) {
          timestamp = callTime;
          if (latestCall.status === "missed") {
            lastMsgText = "📞 Missed call";
          } else if (latestCall.callType === "outgoing") {
            lastMsgText = `📞 Outgoing call (${latestCall.duration || 0}s)`;
          } else {
            lastMsgText = `📞 Incoming call (${latestCall.duration || 0}s)`;
          }
        } else if (chatTime > 0 && chatTime >= timestamp) {
          timestamp = chatTime;
          const raw = latestChat.text || latestChat.trans_text || "";
          lastMsgText = raw || "New message";
        } else if (pId === "unity_ai") {
          lastMsgText = "AI companion is ready to chat!";
          timestamp = timestamp || (Date.now() - 3600000);
        } else {
          lastMsgText = c.status || "Tap to chat";
        }

        return {
          ...c,
          lastMsgText,
          timestamp,
          unreadCount: Number(c.unread_count || 0),
        };
      });

      // Filter to items with active conversations or AI
      const activeConvs = merged.filter(c =>
        c.id === "unity_ai" || c.timestamp > 0 || c.unreadCount > 0 || c.isUnityUser
      );

      // Sort strictly by timestamp DESC (latest activity at top!)
      activeConvs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      setRecentConversations(activeConvs);
    } catch (err) {
      console.warn("[HomeScreen] loadRecentConversationsData failed:", err);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      async function refreshData() {
        try {
          const latestContacts = await getDbContacts();
          if (latestContacts && latestContacts.length > 0) {
            setContacts(latestContacts);
          }
        } catch (e) {
          console.error("Failed to refresh contacts on focus:", e);
        }
        try {
          const logs = await getDbCallLogs();
          setCallLogs(logs);
        } catch (e) {
          console.error("Failed to refresh call logs on focus:", e);
        }
        loadRecentConversationsData();
        try {
          const latestNews = await getDbNewsArticles();
          if (latestNews && latestNews.length > 0) {
            setNewsArticles(latestNews);
          }
        } catch (e) {
          console.error("Failed to refresh news on focus:", e);
        }
      }
      refreshData();

      // Restore scroll position after returning from another screen
      const savedY = route.params?.scrollY;
      if (savedY && savedY > 0 && mainScrollRef.current) {
        // Small delay to allow layout to settle before scrolling
        const t = setTimeout(() => {
          try {
            mainScrollRef.current?.scrollTo({ y: savedY, animated: false });
          } catch (_) {}
        }, 80);
        return () => clearTimeout(t);
      }
    }, [route.params?.scrollY]),
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
      isCompleted: !!(
        currentUser.unityAILang && currentUser.unityAILang.trim() !== ""
      ),
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

  const isDev = currentUser?.email === "dev@gmail.com" || currentUser?.email === "dev@mail.com";

  const handleStartConv = () => {
    trackEvent("opened_start_conversation", currentUser, {});
    setStartConvSearch("");
    setStartConvFilter("global");
    setStartConvModalVisible(true);
  };

  const handlePartnerClick = async (
    name,
    avatar,
    flag,
    id,
    status,
    lang,
    langName,
  ) => {
    if (id) {
      try {
        await clearDbContactUnread(id);
        setContacts((prev) =>
          prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c))
        );
        setRecentConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
        );
      } catch (_) {}
    }
    trackEvent("started_chat", currentUser, {
      partnerName: name,
      partnerId: id,
    });
    navigation.navigate("Conversation", {
      partnerName: name,
      partnerAvatar: avatar,
      partnerFlag: flag,
      partnerId: id,
      partnerStatus: status,
      partnerLang: lang,
      partnerLangName: langName,
      originScrollY: scrollOffsetRef.current,
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
    const targetStr = typeof target === "string" ? target : "menu";
    trackEvent("opened_settings", currentUser, { target: targetStr });
    setOnboardingVisible(false);
    try {
      await AsyncStorage.setItem("@onboarding_dismissed", "true");
    } catch (e) {
      console.error("Failed to mark onboarding as dismissed", e);
    }
    navigation.navigate("Profile", { scrollTo: targetStr });
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



  const handleNewsLike = async (articleId) => {
    setNewsArticles((prev) =>
      prev.map((art) => {
        if (art.id === articleId) {
          const nextLiked = !art.liked;
          const nextLikes = nextLiked ? art.likes + 1 : art.likes - 1;
          toggleDbNewsLike(articleId, nextLiked, nextLikes);
          return { ...art, liked: nextLiked, likes: nextLikes };
        }
        return art;
      })
    );
    if (selectedNews && selectedNews.id === articleId) {
      setSelectedNews((prev) => {
        const nextLiked = !prev.liked;
        const nextLikes = nextLiked ? prev.likes + 1 : prev.likes - 1;
        return { ...prev, liked: nextLiked, likes: nextLikes };
      });
    }
  };

  const handleNewsBookmark = async (articleId) => {
    setNewsArticles((prev) =>
      prev.map((art) => {
        if (art.id === articleId) {
          const nextBookmarked = !art.bookmarked;
          toggleDbNewsBookmark(articleId, nextBookmarked);
          return { ...art, bookmarked: nextBookmarked };
        }
        return art;
      })
    );
    if (selectedNews && selectedNews.id === articleId) {
      setSelectedNews((prev) => ({ ...prev, bookmarked: !prev.bookmarked }));
    }
  };

  const handleNewsOpenDetails = async (article) => {
    setSelectedNews(article);
    await incrementDbNewsView(article.id);
    setNewsArticles((prev) =>
      prev.map((art) => (art.id === article.id ? { ...art, views: art.views + 1 } : art))
    );
  };

  const handleNewsShare = (article) => {
    setShareNewsTargetArticle(article);
    setShareSearchText("");
  };

  // Compute filtered news articles reactively
  const filteredNewsArticles = useMemo(() => {
    const userLangDetails = getLangDetails(currentUser?.nativeLang || "en");
    const userCountry = detectedCountry || userLangDetails?.country || "Kenya";

    const filtered = newsArticles.filter((art) => {
      const matchesCategory =
        selectedCategory.toLowerCase() === "all" ||
        art.category.toLowerCase() === selectedCategory.toLowerCase() ||
        (selectedCategory.toLowerCase() === "trending" && art.trending) ||
        (userCountry && selectedCategory.toLowerCase() === userCountry.toLowerCase() && isArticleRelatedToCountry(art, userCountry));

      const matchesBookmark = !showBookmarksOnly || art.bookmarked;

      let matchesSearch = true;
      if (newsSearchText.trim()) {
        const q = newsSearchText.toLowerCase().trim();
        matchesSearch =
          art.title.toLowerCase().includes(q) ||
          art.summary.toLowerCase().includes(q) ||
          art.category.toLowerCase().includes(q) ||
          art.publisher.toLowerCase().includes(q);
      }

      return matchesCategory && matchesBookmark && matchesSearch;
    });

    if (userCountry) {
      filtered.sort((a, b) => {
        const scoreA = getCountryScore(a, userCountry);
        const scoreB = getCountryScore(b, userCountry);
        if (scoreA !== scoreB) {
          return scoreB - scoreA;
        }
        return (b.timestamp || 0) - (a.timestamp || 0);
      });
    } else {
      filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }

    return filtered;
  }, [newsArticles, selectedCategory, showBookmarksOnly, newsSearchText, currentUser?.nativeLang, detectedCountry]);

  // Keep the ref in sync so external logic can read filtered count without a re-render
  useEffect(() => {
    filteredNewsCountRef.current = filteredNewsArticles.length;
  }, [filteredNewsArticles]);

  // Load the next page of news cards with a natural staggered delay
  const handleNewsLoadMore = () => {
    if (newsLoadingMore || newsDisplayCount >= filteredNewsArticles.length) return;
    setNewsLoadingMore(true);
    const delay = 700 + Math.random() * 600;
    setTimeout(() => {
      setNewsDisplayCount((prev) => prev + 5);
      setNewsLoadingMore(false);
    }, delay);
  };

  const handleCarouselScroll = (e) => {
    const slideSize = e.nativeEvent.layoutMeasurement.width;
    const offset = e.nativeEvent.contentOffset.x;
    const index = Math.round(offset / slideSize);
    setCarouselIndex(index);
  };

  const breakingArticles = newsArticles.filter((art) => art.breaking);

  // Auto-scroll Breaking News Carousel every 4 seconds
  useEffect(() => {
    if (activeTab !== "updates") return;
    if (!breakingArticles || breakingArticles.length <= 1) return;

    const interval = setInterval(() => {
      setCarouselIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % breakingArticles.length;
        if (carouselRef.current) {
          carouselRef.current.scrollTo({
            x: nextIndex * (width - 40),
            animated: true,
          });
        }
        return nextIndex;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [activeTab, breakingArticles.length]);

  const handleNewsShareNative = async (article) => {
    try {
      const shareUrl = `${SERVER_URL}/news/${article.slug || article.id}`;
      await Share.share({
        title: article.title,
        message: `${article.title}\n\n${article.summary}\n\nRead on XayLite: ${shareUrl}`,
      });
    } catch (e) {
      console.warn("[HomeScreen] Native share failed:", e);
    }
  };

  const handleNewsShareToContact = async (contact) => {
    if (!shareNewsTargetArticle) return;
    try {
      const payload = {
        id: shareNewsTargetArticle.id,
        title: shareNewsTargetArticle.title,
        summary: shareNewsTargetArticle.summary,
        heroImage: shareNewsTargetArticle.heroImage,
      };
      
      const messageText = `[NEWS_SHARE]:${JSON.stringify(payload)}`;
      const msgId = `msg_${getCurrentTimestamp()}`;
      
      await saveChat({
        id: msgId,
        partner_id: contact.id,
        text: messageText,
        trans_text: messageText,
        sender: "user",
        orig_lang: currentUser.nativeLang || "en",
        trans_lang: contact.nativeLang || "en",
        timestamp: getCurrentTimestamp(),
      });
      
      const chatBody = {
        sender: "user",
        text: messageText,
        origLang: currentUser.nativeLang || "en",
        userKey: currentUser.email || currentUser.name || "Me",
        partnerKey: contact.email || contact.id,
      };
      
      fetch(`${SERVER_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chatBody),
      }).catch((e) => console.warn("[NewsShare] Failed to sync share message to backend:", e));

      Alert.alert("Shared", `News shared successfully with ${contact.name}!`);
      setShareNewsTargetArticle(null);
    } catch (err) {
      console.error("[NewsShare] Failed to share:", err);
    }
  };

  const handleImportContacts = async (isAuto = false) => {
    if (isImporting) return;
    setIsImporting(true);
    trackEvent("started_contact_import", currentUser, { auto: isAuto });
    try {
      // Weekly check: skip if already synced within last 7 days (only for auto mode without fresh login)
      if (isAuto && !route?.params?.justLoggedIn) {
        const lastSyncTime = await getLastAutoSyncDate();
        let lastSyncMs = 0;
        if (lastSyncTime) {
          const parsed = Number(lastSyncTime);
          if (!isNaN(parsed) && parsed > 0) {
            lastSyncMs = parsed;
          } else {
            lastSyncMs = new Date(lastSyncTime).getTime() || 0;
          }
        }
        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
        if (lastSyncMs > 0 && (getCurrentTimestamp() - lastSyncMs < SEVEN_DAYS_MS)) {
          console.log("[Contacts] Already auto-synced within last 7 days, skipping.");
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
          `[Contacts] Found ${data.length} device contacts. Syncing in background...`,
        );

        // Extract all phone numbers for a single fast backend check
        const phoneNumbers = data
          .map((item) =>
            item.phoneNumbers && item.phoneNumbers.length > 0
              ? item.phoneNumbers[0].number
              : "",
          )
          .filter((num) => num !== "");

        let unityUserMap = {};
        try {
          console.log("[Contacts] Checking backend for Xaylite accounts...");
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

        // Process in batches of 15 to keep UI perfectly smooth and responsive
        const batchSize = 15;
        let processedCount = 0;

        for (let i = 0; i < data.length; i += batchSize) {
          const batch = data.slice(i, i + batchSize);
          
          const formattedBatch = batch.map((item, idx) => {
            const phone =
              item.phoneNumbers && item.phoneNumbers.length > 0
                ? item.phoneNumbers[0].number
                : "";
            const email =
              item.emails && item.emails.length > 0 ? item.emails[0].email : "";

            const unityInfo = unityUserMap[phone];
            const isUnityUser = !!(
              unityInfo &&
              (unityInfo.hasUnityAccount || unityInfo.hasAccount)
            );

            let flag = "";
            let lang = "";
            let name = item.name || "Unnamed Contact";
            let localAvatar = "";

            if (!isUnityUser) {
              flag = getLangDetails(currentUser.nativeLang)?.flag || "🌍";
              lang = getLangDetails(currentUser.nativeLang)?.name || "English";
              
              if (item.image && item.image.uri) {
                localAvatar = item.image.uri; // Direct local URI reference
              } else {
                localAvatar = getDefaultAvatar(item.name || `user_${idx}`);
              }
            } else {
              name = unityInfo?.name || unityInfo?.username || item.name || "Unnamed Contact";
              flag = unityInfo?.flag || unityInfo?.nativeLangFlag || "";
              lang = unityInfo?.lang || unityInfo?.nativeLang || "";

              if (!flag || !lang) {
                if (phone.includes("+33")) {
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
                  flag = getLangDetails(currentUser.nativeLang)?.flag || "🌍";
                  lang = getLangDetails(currentUser.nativeLang)?.name || "English";
                }
              }

              if (unityInfo?.avatar) {
                localAvatar = unityInfo.avatar;
              } else if (item.image && item.image.uri) {
                localAvatar = item.image.uri;
              } else {
                localAvatar = getDefaultAvatar(name || `user_${idx}`);
              }
            }

            return {
              id: item.id || `c_device_${Date.now()}_${processedCount + idx}`,
              name: name,
              phone: phone,
              email: email,
              flag: flag,
              langName: lang,
              status: isUnityUser ? "Available on Xaylite" : "Not on Xaylite",
              is_synced: 1,
              avatar: localAvatar,
              isUnityUser: isUnityUser ? 1 : 0,
            };
          });

          processedCount += batch.length;

          // Save batch to database in background
          await saveDbContacts(formattedBatch);

          // Update contacts state incrementally in UI
          const currentContacts = await getDbContacts();
          setContacts(currentContacts);
          setSyncedCount(processedCount);

          // Yield UI thread rendering cycles (30ms sleep)
          await new Promise((resolve) => setTimeout(resolve, 30));
        }

        setImported(true);

        if (processedCount > 0) {
          setShowImportSuccess(true);
          setTimeout(() => setShowImportSuccess(false), 15000);
        }

        // Mark timestamp as synced
        await saveLastAutoSyncDate(String(getCurrentTimestamp()));
        await saveLastImportCheckTime(getCurrentTimestamp());
        console.log(
          `[Contacts] Sync complete: ${processedCount} contacts`,
        );
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
  useEffect(() => {
    handleImportContactsRef.current = handleImportContacts;
  });

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
              status: "Hey there! I am using Xaylite.",
            };
            setContacts((prev) => [...prev, newContact]);
            setStartConvModalVisible(false);
            handlePartnerClick(
              newContact.name,
              newContact.avatar,
              newContact.flag,
              newContact.id
            );
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleAdminSaveArticle = async () => {
    if (!adminTitle.trim() || !adminSummary.trim() || !adminContent.trim()) {
      Alert.alert("Validation Error", "Please fill in title, summary, and full content.");
      return;
    }
    
    const articleId = adminEditingId || `admin_${Date.now()}`;
    const newArticle = {
      id: articleId,
      title: adminTitle.trim(),
      slug: adminTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      summary: adminSummary.trim(),
      fullContent: adminContent.trim(),
      heroImage: adminHeroImage.trim() || "https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=1000&auto=format&fit=crop",
      galleryImages: [],
      publisher: currentUser.name || "XayLite Admin",
      publisherAvatar: currentUser.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100",
      category: adminCategory,
      tags: [adminCategory.toLowerCase(), "admin"],
      publishedAt: "Just now",
      readingTime: `${Math.max(1, Math.round(adminContent.split(/\s+/).length / 180))} min read`,
      likes: 0,
      views: 0,
      bookmarked: false,
      liked: false,
      featured: false,
      breaking: false,
      trending: false,
      timestamp: Date.now(),
    };

    try {
      await saveDbAdminArticle(newArticle);
      
      setNewsArticles((prev) => {
        const filtered = prev.filter((a) => a.id !== articleId);
        return [newArticle, ...filtered];
      });

      setAdminTitle("");
      setAdminSummary("");
      setAdminContent("");
      setAdminHeroImage("");
      setAdminCategory("Technology");
      setAdminEditingId(null);
      setNewsAdminModalVisible(false);
      
      Alert.alert("Success", "Article saved successfully!");
    } catch (e) {
      console.error("[AdminNews] Failed to save:", e);
    }
  };

  const handleAdminEditPress = (article) => {
    setAdminEditingId(article.id);
    setAdminTitle(article.title);
    setAdminSummary(article.summary);
    setAdminContent(article.fullContent || article.full_content || "");
    setAdminHeroImage(article.heroImage || article.hero_image || "");
    setAdminCategory(article.category || "Technology");
    setNewsAdminModalVisible(true);
  };

  const handleAdminDeleteArticle = (articleId) => {
    Alert.alert(
      "Delete Article",
      "Are you sure you want to delete this article? This action is permanent.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDbNewsArticle(articleId);
              setNewsArticles((prev) => prev.filter((a) => a.id !== articleId));
              if (selectedNews && selectedNews.id === articleId) {
                setSelectedNews(null);
              }
              Alert.alert("Deleted", "Article deleted successfully.");
            } catch (err) {
              console.error("[AdminNews] Failed to delete:", err);
            }
          },
        },
      ]
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

  const isOnlineContact = (item) => {
    if (item?.isMe || item?.id === "unity_ai") return true;
    if (typeof item?.isOnline === "boolean") return item.isOnline;
    if (item?.lastActive) {
      const lastActiveTs = new Date(item.lastActive).getTime();
      return (getCurrentTimestamp() - lastActiveTs) <= 300000;
    }
    return isOnlineStatus(item?.status);
  };

  const filteredContacts = contacts.filter((c) => {
    if (c.id === "unity_ai") return true;
    if (c.id === "c1" || c.id === "c2") return isDev;
    return true;
  });

  const normalizeProfileObj = (person) => {
    if (!person) return null;
    return {
      ...person,
      avatar: person.avatar_local_path || person.avatar || getDefaultAvatar(person.name || "user"),
    };
  };

  const displayedContacts = [
    myProfile,
    ...filteredContacts.map(normalizeProfileObj).filter((c) => c && c.id !== "me"),
  ];

  const filteredExploreProfiles = exploreProfiles.filter((e) => {
    if (e.id === "e1" || e.id === "e2") return isDev;
    return true;
  });

  const displayedExplore = [
    myProfile,
    ...filteredExploreProfiles.map(normalizeProfileObj).filter((e) => e && e.id !== "me"),
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
                  ? "News"
                  : activeTab === "contacts"
                    ? "Contacts"
                    : "Calls"}
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              {activeTab === "chats"
                ? "You're ready to communicate instantly"
                : activeTab === "updates"
                  ? "Sleek discoveries and premium world news"
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
        ref={mainScrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => {
          scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
        }}
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
              {(() => {
                // Compute or fallback list of recent conversations
                const activeList =
                  recentConversations.length > 0
                    ? recentConversations
                    : displayedContacts;

                if (!activeList || activeList.length === 0) {
                  return (
                    <View style={{ padding: 24, alignItems: "center" }}>
                      <Text style={{ color: colors.textDimmed, fontSize: 13 }}>
                        No recent conversations yet.
                      </Text>
                    </View>
                  );
                }

                return activeList.map((contact, index) => {
                  const isAI = contact.id === "unity_ai";
                  const isLast = index === activeList.length - 1;
                  const partnerFlag =
                    contact.flag ||
                    (isAI ? LANGS[currentUser.unityAILang]?.flag || "🌍" : "🇺🇸");
                  const partnerLang =
                    contact.lang || (isAI ? currentUser.unityAILang || "en" : "en");
                  const partnerLangName =
                    contact.langName ||
                    (isAI ? LANGS[currentUser.unityAILang]?.name || "English" : "English");

                  // Format relative timestamp
                  let timeDisplay = "Just now";
                  if (isAI && (!contact.timestamp || contact.timestamp <= 0)) {
                    timeDisplay = "Always Online";
                  } else if (contact.timestamp > 0) {
                    const diff = Date.now() - contact.timestamp;
                    if (diff < 60000) timeDisplay = "Just now";
                    else if (diff < 3600000) timeDisplay = `${Math.floor(diff / 60000)}m ago`;
                    else if (diff < 86400000) {
                      timeDisplay = new Date(contact.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                    } else if (diff < 172800000) timeDisplay = "Yesterday";
                    else timeDisplay = new Date(contact.timestamp).toLocaleDateString([], { month: "short", day: "numeric" });
                  }

                  const previewText =
                    contact.lastMsgText ||
                    (isAI ? "AI is ready to chat!" : contact.status || "Tap to chat");

                  return (
                    <View
                      key={contact.id || `conv_${index}`}
                      style={[
                        styles.convCard,
                        !isLast ? { borderBottomColor: colors.border, borderBottomWidth: 1 } : { borderBottomWidth: 0 },
                      ]}
                    >
                      <TouchableOpacity
                        activeOpacity={0.85}
                        hitSlop={8}
                        onPress={() => openProfilePopup(contact)}
                        style={styles.avatarContainer}
                      >
                        <Image
                          source={getSafeAvatarSource(contact.avatar, contact.name || "User")}
                          style={styles.avatar}
                        />
                        <View style={[styles.flagBadge, { backgroundColor: colors.bg }]}>
                          {renderFlagOrEmoji(partnerFlag)}
                        </View>
                        {isOnlineStatus(contact.status) && (
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
                            contact.name,
                            contact.avatar,
                            partnerFlag,
                            contact.id,
                            contact.status,
                            partnerLang,
                            partnerLangName,
                          )
                        }
                        style={styles.convBodyPress}
                      >
                        <View style={styles.convDetails}>
                          <View style={styles.convHeader}>
                            <Text
                              style={[
                                styles.partnerName,
                                { color: colors.text, fontWeight: isAI ? "700" : "600" },
                              ]}
                              numberOfLines={1}
                            >
                              {contact.name}
                            </Text>
                            <Text
                              style={[
                                styles.convTime,
                                { color: contact.unreadCount > 0 ? colors.primary : colors.textDimmed, fontWeight: contact.unreadCount > 0 ? "700" : "400" },
                              ]}
                            >
                              {timeDisplay}
                            </Text>
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
                            <Text
                              style={[
                                styles.convPreview,
                                {
                                  color: isAI
                                    ? colors.primary
                                    : contact.unreadCount > 0
                                    ? colors.text
                                    : colors.textMuted,
                                  fontWeight: contact.unreadCount > 0 ? "600" : "400",
                                  flex: 1,
                                },
                              ]}
                              numberOfLines={1}
                            >
                              {previewText}
                            </Text>

                            {/* WhatsApp-style Unread Message Count Badge */}
                            {contact.unreadCount > 0 && (
                              <View
                                style={{
                                  backgroundColor: isDark ? "#8B5CF6" : "#4F46E5",
                                  borderRadius: 12,
                                  minWidth: 20,
                                  height: 20,
                                  paddingHorizontal: 6,
                                  alignItems: "center",
                                  justifyContent: "center",
                                  marginLeft: 8,
                                }}
                              >
                                <Text
                                  style={{
                                    color: "#FFFFFF",
                                    fontSize: 11,
                                    fontWeight: "700",
                                  }}
                                >
                                  {contact.unreadCount > 99 ? "99+" : contact.unreadCount}
                                </Text>
                              </View>
                            )}
                          </View>
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
                  );
                });
              })()}

              {isDev && (
                <>
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
                </>
              )}
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
                  {filteredContacts
                    .filter((c) => {
                      const q = contactSearchText.toLowerCase();
                      return (
                        (c.name || "").toLowerCase().includes(q) ||
                        (c.id || "").toLowerCase().includes(q) ||
                        (c.uid || "").toLowerCase().includes(q)
                      );
                    })
                    .sort((a, b) => {
                      const aVal =
                        a.isUnityUser === true || a.isUnityUser === 1 ? 1 : 0;
                      const bVal =
                        b.isUnityUser === true || b.isUnityUser === 1 ? 1 : 0;
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
                              "🤯 I'm talking to people in different languages with Xaylite. You should try it too! Download: https://elitestore.keysire.com/app/com.amanikbt1.xaylite";
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
                        <TouchableOpacity
                          activeOpacity={0.85}
                          hitSlop={6}
                          onPress={(e) => {
                            e.stopPropagation && e.stopPropagation();
                            openProfilePopup(contact);
                          }}
                          style={styles.avatarContainer}
                        >
                          <Image
                            source={getSafeAvatarSource(contact.avatar, contact.name || "User")}
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
                        </TouchableOpacity>
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
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => openProfilePopup(person)}
                        style={{ position: 'relative' }}
                      >
                        <Image
                          source={getSafeAvatarSource(person.avatar_local_path || person.avatar, person.name || "User")}
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
                      </TouchableOpacity>
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
          <View style={styles.newsContainer}>
            {/* News Header & Search Bar */}
            <View style={styles.newsSearchHeader}>
              <View style={[styles.newsSearchBar, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10 }}>
                  <Circle cx="11" cy="11" r="8" />
                  <Path d="M21 21l-4.35-4.35" />
                </Svg>
                <TextInput
                  style={[styles.newsSearchInput, { color: colors.text }]}
                  placeholder="Search news... e.g. Kenyan news"
                  placeholderTextColor={colors.textMuted}
                  value={newsSearchText}
                  onChangeText={(txt) => setNewsSearchText(txt)}
                />
                {newsSearchText.length > 0 && (
                  <TouchableOpacity onPress={() => setNewsSearchText("")} style={{ padding: 4 }}>
                    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <Line x1="18" y1="6" x2="6" y2="18" />
                      <Line x1="6" y1="6" x2="18" y2="18" />
                    </Svg>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Smart Category Chips with Bookmark Toggle */}
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginBottom: 16 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingRight: 10 }}
                style={{ flex: 1 }}
              >
                {(() => {
                  const userLangDetails = getLangDetails(currentUser?.nativeLang || "en");
                  const userCountry = detectedCountry || userLangDetails?.country || "Kenya";
                  const defaultCategories = ["All", "Trending", "World", "AI", "Android", "Cybersecurity", "Gaming", "Business", "Education", "Science"];
                  
                  // Construct smart category list: place user's country right after Trending
                  const categories = [...defaultCategories];
                  const insertIndex = 2;
                  if (userCountry) {
                    if (!categories.map(c => c.toLowerCase()).includes(userCountry.toLowerCase())) {
                      categories.splice(insertIndex, 0, userCountry);
                    } else {
                      // Move existing one to the priority index
                      const idx = categories.findIndex(c => c.toLowerCase() === userCountry.toLowerCase());
                      if (idx > -1) {
                        categories.splice(idx, 1);
                      }
                      categories.splice(insertIndex, 0, userCountry);
                    }
                  }
                  return categories;
                })().map((cat) => {
                  const isSelected = selectedCategory === cat && !showBookmarksOnly;
                  return (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => {
                        setShowBookmarksOnly(false);
                        setSelectedCategory(cat);
                      }}
                      style={[
                        styles.categoryChip,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.cardBg,
                          borderColor: isSelected ? colors.primary : colors.border,
                        }
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          {
                            color: isSelected ? "#FFFFFF" : colors.text,
                            fontWeight: isSelected ? "700" : "500",
                          }
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                onPress={() => setShowBookmarksOnly(!showBookmarksOnly)}
                style={[
                  styles.bookmarkFilterBtn,
                  {
                    backgroundColor: showBookmarksOnly ? colors.primary : colors.cardBg,
                    borderColor: showBookmarksOnly ? colors.primary : colors.border,
                  }
                ]}
              >
                <Svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill={showBookmarksOnly ? "#FFFFFF" : "none"}
                  stroke={showBookmarksOnly ? "#FFFFFF" : colors.text}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </Svg>
              </TouchableOpacity>
            </View>

            {/* Main News Scroll Container */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={200}
              onScroll={(e) => {
                const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
                if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 350) {
                  handleNewsLoadMore();
                }
              }}
              contentContainerStyle={{ paddingBottom: 100 }}
              refreshControl={
                <RefreshControl
                  refreshing={newsLoading}
                  onRefresh={async () => {
                    setNewsLoading(true);
                    try {
                      const fresh = await fetchLatestNews(showBookmarksOnly ? "All" : selectedCategory);
                      setNewsArticles(fresh);
                    } catch (_) {}
                    setNewsLoading(false);
                  }}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                />
              }
            >
              {/* Empty state conditional */}
              {(() => {
                const userLangDetails = getLangDetails(currentUser?.nativeLang || "en");
                const userCountry = detectedCountry || userLangDetails?.country || "Kenya";

                const filtered = filteredNewsArticles;

                if (filtered.length === 0) {
                  return (
                    <View style={styles.newsEmptyState}>
                      <Svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={colors.textDimmed} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}>
                        <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <Path d="M16 8h2" />
                        <Path d="M16 12h2" />
                        <Path d="M16 16h2" />
                        <Path d="M6 8h6v8H6z" />
                        <Line x1="2" y1="2" x2="22" y2="22" stroke={colors.primary} strokeWidth="2.5" />
                      </Svg>
                      <Text style={[styles.newsEmptyTitle, { color: colors.text }]}>
                        {showBookmarksOnly
                          ? "No Bookmarked Articles"
                          : newsSearchText.trim()
                            ? "No Search Results"
                            : "No News Available"}
                      </Text>
                      <Text style={[styles.newsEmptyText, { color: colors.textDimmed }]}>
                        {showBookmarksOnly
                          ? "Bookmark articles in XayLite News to view them offline."
                          : newsSearchText.trim()
                            ? "Try checking spelling or using broader search terms."
                            : "Pull down to refresh or check your internet connection."}
                      </Text>
                    </View>
                  );
                }

                const breakingArticles = filtered.filter(art => art.breaking);
                const trendingArticles = filtered.filter(art => art.trending);

                const showHeaderFeatures = !newsSearchText.trim() && !showBookmarksOnly;

                return (
                  <View>
                    {/* Breaking News Carousel */}
                    {showHeaderFeatures && breakingArticles.length > 0 && (
                      <View style={{ marginBottom: 20 }}>
                        <Text style={[styles.newsSectionTitle, { color: colors.text }]}>Breaking News</Text>
                        <ScrollView
                          ref={carouselRef}
                          horizontal
                          pagingEnabled
                          showsHorizontalScrollIndicator={false}
                          onScroll={handleCarouselScroll}
                          scrollEventThrottle={16}
                          style={styles.carouselContainer}
                        >
                          {breakingArticles.map((art) => (
                            <TouchableOpacity
                              key={art.id}
                              activeOpacity={0.9}
                              onPress={() => handleNewsOpenDetails(art)}
                              style={[styles.carouselCard, { width: width - 40 }]}
                            >
                              <Image source={{ uri: art.heroImage }} style={styles.carouselImage} />
                              <LinearGradient
                                colors={["transparent", "rgba(2, 6, 23, 0.95)"]}
                                style={styles.carouselOverlay}
                              >
                                <View style={styles.carouselContent}>
                                  <View style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
                                    <View style={[styles.carouselBadge, { backgroundColor: colors.primary }]}>
                                      <Text style={styles.carouselBadgeText}>{art.category.toUpperCase()}</Text>
                                    </View>
                                    {userCountry && getCountryScore(art, userCountry) > 0 && (
                                      <View style={[styles.carouselBadge, { backgroundColor: "#10B981" }]}>
                                        <Text style={styles.carouselBadgeText}>
                                          {getLangDetails(currentUser?.nativeLang || "en")?.flag || "🌍"} REGIONAL
                                        </Text>
                                      </View>
                                    )}
                                  </View>
                                  <Text style={styles.carouselHeadline} numberOfLines={2}>
                                    {art.title}
                                  </Text>
                                  <Text style={styles.carouselMeta}>
                                    {art.publisher} • {art.publishedAt}
                                  </Text>
                                </View>
                              </LinearGradient>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                        {/* Pagination Dots */}
                        <View style={styles.carouselDots}>
                          {breakingArticles.map((_, i) => (
                            <View
                              key={i}
                              style={[
                                styles.carouselDot,
                                {
                                  backgroundColor: i === carouselIndex ? colors.primary : colors.textMuted,
                                  width: i === carouselIndex ? 16 : 6,
                                }
                              ]}
                            />
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Hot Right Now Section */}
                    {showHeaderFeatures && trendingArticles.length > 0 && (
                      <View style={{ marginBottom: 20 }}>
                        <Text style={[styles.newsSectionTitle, { color: colors.text }]}>Hot Right Now</Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
                        >
                          {trendingArticles.map((art) => (
                            <TouchableOpacity
                              key={art.id}
                              activeOpacity={0.85}
                              onPress={() => handleNewsOpenDetails(art)}
                              style={[styles.hotCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                            >
                              <Image source={{ uri: art.heroImage }} style={styles.hotImage} />
                              <View style={styles.hotContent}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                  <Text style={[styles.hotBadge, { color: colors.primary }]}>
                                    {art.category}
                                  </Text>
                                  {userCountry && getCountryScore(art, userCountry) > 0 && (
                                    <Text style={{ fontSize: 10, fontWeight: "bold", color: "#10B981" }}>
                                      {getLangDetails(currentUser?.nativeLang || "en")?.flag || "🌍"} Local
                                    </Text>
                                  )}
                                </View>
                                <Text style={[styles.hotHeadline, { color: colors.text }]} numberOfLines={2}>
                                  {art.title}
                                </Text>
                                <Text style={[styles.hotTime, { color: colors.textDimmed }]}>
                                  {art.publishedAt}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}

                    {/* Main Feed News Cards */}
                    <Text style={[styles.newsSectionTitle, { color: colors.text, marginBottom: 12 }]}>
                      {showBookmarksOnly ? "Bookmarked News" : "Latest News"}
                    </Text>
                    <View style={{ paddingHorizontal: 20, gap: 16 }}>
                      {filtered.slice(0, newsDisplayCount).map((art) => {
                        const isAdmin = currentUser.email === "admin@gmail.com" || currentUser.name === "Admin" || currentUser.email === "dev@gmail.com";
                        return (
                          <View
                            key={art.id}
                            style={[
                              styles.newsCard,
                              { backgroundColor: colors.cardBg, borderColor: colors.border }
                            ]}
                          >
                            {/* Publisher Header */}
                            <View style={styles.newsCardHeader}>
                              <Image source={{ uri: art.publisherAvatar || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=100" }} style={styles.publisherAvatar} />
                              <View style={{ flex: 1, marginLeft: 8 }}>
                                <View style={{ flexDirection: "row", alignItems: "center" }}>
                                  <Text style={[styles.publisherName, { color: colors.text }]} numberOfLines={1}>
                                    {art.publisher}
                                  </Text>
                                  {userCountry && getCountryScore(art, userCountry) > 0 && (
                                    <View style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      backgroundColor: colors.primary + "1A",
                                      paddingHorizontal: 6,
                                      paddingVertical: 2,
                                      borderRadius: 6,
                                      marginLeft: 8,
                                    }}>
                                      <Text style={{ fontSize: 10, fontWeight: "600", color: colors.primary }}>
                                        {getLangDetails(currentUser?.nativeLang || "en")?.flag || "🌍"} Local Priority
                                      </Text>
                                    </View>
                                  )}
                                </View>
                                <Text style={[styles.newsCardTime, { color: colors.textDimmed }]}>
                                  {art.publishedAt} • {art.readingTime}
                                </Text>
                              </View>
                              {isAdmin && (
                                <View style={{ flexDirection: "row", gap: 8 }}>
                                  <TouchableOpacity onPress={() => handleAdminEditPress(art)} style={{ padding: 4 }}>
                                    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                      <Path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </Svg>
                                  </TouchableOpacity>
                                  <TouchableOpacity onPress={() => handleAdminDeleteArticle(art.id)} style={{ padding: 4 }}>
                                    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <Polyline points="3 6 5 6 21 6" />
                                      <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                      <Line x1="10" y1="11" x2="10" y2="17" />
                                      <Line x1="14" y1="11" x2="14" y2="17" />
                                    </Svg>
                                  </TouchableOpacity>
                                </View>
                              )}
                            </View>

                            {/* Cover Image */}
                            <TouchableOpacity
                              activeOpacity={0.9}
                              onPress={() => handleNewsOpenDetails(art)}
                            >
                              <Image source={{ uri: art.heroImage }} style={styles.newsCardImage} />
                            </TouchableOpacity>

                            {/* Card Content */}
                            <TouchableOpacity
                              activeOpacity={0.9}
                              onPress={() => handleNewsOpenDetails(art)}
                              style={styles.newsCardBody}
                            >
                              <Text style={[styles.newsCardTitle, { color: colors.text }]} numberOfLines={2}>
                                {art.title}
                              </Text>
                              <Text style={[styles.newsCardSummary, { color: colors.textDimmed }]} numberOfLines={3}>
                                {art.summary}
                              </Text>
                            </TouchableOpacity>

                            {/* Actions bar */}
                            <View style={[styles.newsCardActions, { borderTopColor: colors.border }]}>
                              <TouchableOpacity
                                onPress={() => handleNewsLike(art.id)}
                                style={styles.newsActionBtn}
                                activeOpacity={0.7}
                              >
                                <Svg
                                  width="18"
                                  height="18"
                                  viewBox="0 0 24 24"
                                  fill={art.liked ? "#EF4444" : "none"}
                                  stroke={art.liked ? "#EF4444" : colors.textMuted}
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                </Svg>
                                <Text style={[styles.newsActionCount, { color: colors.textMuted }]}>
                                  {art.likes}
                                </Text>
                              </TouchableOpacity>

                              <View style={styles.newsActionBtn}>
                                <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                  <Circle cx="12" cy="12" r="3" />
                                </Svg>
                                <Text style={[styles.newsActionCount, { color: colors.textMuted }]}>
                                  {art.views}
                                </Text>
                              </View>

                              <TouchableOpacity
                                onPress={() => handleNewsBookmark(art.id)}
                                style={styles.newsActionBtn}
                                activeOpacity={0.7}
                              >
                                <Svg
                                  width="18"
                                  height="18"
                                  viewBox="0 0 24 24"
                                  fill={art.bookmarked ? colors.primary : "none"}
                                  stroke={art.bookmarked ? colors.primary : colors.textMuted}
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                                </Svg>
                              </TouchableOpacity>

                              <TouchableOpacity
                                onPress={() => handleNewsShare(art)}
                                style={styles.newsActionBtn}
                                activeOpacity={0.7}
                              >
                                <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <Circle cx="18" cy="5" r="3" />
                                  <Circle cx="6" cy="12" r="3" />
                                  <Circle cx="18" cy="19" r="3" />
                                  <Line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                                  <Line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                                </Svg>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>

                    {/* ─── Facebook-style sliding shimmer skeleton ─── */}
                    {newsLoadingMore && (() => {
                      const shimTX = newsShimmerPos.interpolate({ inputRange: [-1, 1], outputRange: [-300, 300] });
                      const bg = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";
                      const grad = isDark
                        ? ["transparent", "rgba(255,255,255,0.13)", "transparent"]
                        : ["transparent", "rgba(255,255,255,0.75)", "transparent"];
                      return (
                        <View style={{ paddingHorizontal: 20, gap: 16, marginTop: 4 }}>

                          {/* ── Skeleton card 1 ── */}
                          <View style={[styles.newsCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                            <View style={{ flexDirection: "row", alignItems: "center", padding: 12, gap: 10 }}>
                              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: bg, overflow: "hidden" }}>
                                <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: -200, width: 200, transform: [{ translateX: shimTX }] }}>
                                  <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
                                </Animated.View>
                              </View>
                              <View style={{ flex: 1, gap: 6 }}>
                                <View style={{ height: 11, borderRadius: 6, backgroundColor: bg, width: "58%", overflow: "hidden" }}>
                                  <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: -200, width: 200, transform: [{ translateX: shimTX }] }}>
                                    <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
                                  </Animated.View>
                                </View>
                                <View style={{ height: 9, borderRadius: 5, backgroundColor: bg, width: "38%", overflow: "hidden" }}>
                                  <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: -200, width: 200, transform: [{ translateX: shimTX }] }}>
                                    <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
                                  </Animated.View>
                                </View>
                              </View>
                            </View>
                            <View style={{ height: 180, backgroundColor: bg, overflow: "hidden" }}>
                              <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: -200, width: 250, transform: [{ translateX: shimTX }] }}>
                                <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
                              </Animated.View>
                            </View>
                            <View style={{ padding: 14, gap: 9 }}>
                              <View style={{ height: 13, borderRadius: 7, backgroundColor: bg, overflow: "hidden" }}>
                                <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: -200, width: 200, transform: [{ translateX: shimTX }] }}>
                                  <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
                                </Animated.View>
                              </View>
                              <View style={{ height: 13, borderRadius: 7, backgroundColor: bg, width: "80%", overflow: "hidden" }}>
                                <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: -200, width: 200, transform: [{ translateX: shimTX }] }}>
                                  <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
                                </Animated.View>
                              </View>
                              <View style={{ height: 11, borderRadius: 6, backgroundColor: bg, width: "55%", overflow: "hidden", marginTop: 2 }}>
                                <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: -200, width: 200, transform: [{ translateX: shimTX }] }}>
                                  <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
                                </Animated.View>
                              </View>
                            </View>
                            <View style={{ flexDirection: "row", justifyContent: "space-around", paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                              {[44, 32, 24, 24].map((w, i) => (
                                <View key={i} style={{ width: w, height: 10, borderRadius: 5, backgroundColor: bg, overflow: "hidden" }}>
                                  <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: -100, width: 100, transform: [{ translateX: shimTX }] }}>
                                    <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
                                  </Animated.View>
                                </View>
                              ))}
                            </View>
                          </View>

                          {/* ── Skeleton card 2 ── */}
                          <View style={[styles.newsCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                            <View style={{ flexDirection: "row", alignItems: "center", padding: 12, gap: 10 }}>
                              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: bg, overflow: "hidden" }}>
                                <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: -200, width: 200, transform: [{ translateX: shimTX }] }}>
                                  <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
                                </Animated.View>
                              </View>
                              <View style={{ flex: 1, gap: 6 }}>
                                <View style={{ height: 11, borderRadius: 6, backgroundColor: bg, width: "72%", overflow: "hidden" }}>
                                  <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: -200, width: 200, transform: [{ translateX: shimTX }] }}>
                                    <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
                                  </Animated.View>
                                </View>
                                <View style={{ height: 9, borderRadius: 5, backgroundColor: bg, width: "45%", overflow: "hidden" }}>
                                  <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: -200, width: 200, transform: [{ translateX: shimTX }] }}>
                                    <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
                                  </Animated.View>
                                </View>
                              </View>
                            </View>
                            <View style={{ height: 180, backgroundColor: bg, overflow: "hidden" }}>
                              <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: -200, width: 250, transform: [{ translateX: shimTX }] }}>
                                <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
                              </Animated.View>
                            </View>
                            <View style={{ padding: 14, gap: 9 }}>
                              <View style={{ height: 13, borderRadius: 7, backgroundColor: bg, overflow: "hidden" }}>
                                <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: -200, width: 200, transform: [{ translateX: shimTX }] }}>
                                  <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
                                </Animated.View>
                              </View>
                              <View style={{ height: 13, borderRadius: 7, backgroundColor: bg, width: "65%", overflow: "hidden" }}>
                                <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: -200, width: 200, transform: [{ translateX: shimTX }] }}>
                                  <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
                                </Animated.View>
                              </View>
                              <View style={{ height: 11, borderRadius: 6, backgroundColor: bg, width: "42%", overflow: "hidden", marginTop: 2 }}>
                                <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: -200, width: 200, transform: [{ translateX: shimTX }] }}>
                                  <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
                                </Animated.View>
                              </View>
                            </View>
                            <View style={{ flexDirection: "row", justifyContent: "space-around", paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                              {[44, 32, 24, 24].map((w, i) => (
                                <View key={i} style={{ width: w, height: 10, borderRadius: 5, backgroundColor: bg, overflow: "hidden" }}>
                                  <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: -100, width: 100, transform: [{ translateX: shimTX }] }}>
                                    <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
                                  </Animated.View>
                                </View>
                              ))}
                            </View>
                          </View>

                          {/* ── Skeleton card 3 ── */}
                          <View style={[styles.newsCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                            <View style={{ flexDirection: "row", alignItems: "center", padding: 12, gap: 10 }}>
                              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: bg, overflow: "hidden" }}>
                                <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: -200, width: 200, transform: [{ translateX: shimTX }] }}>
                                  <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
                                </Animated.View>
                              </View>
                              <View style={{ flex: 1, gap: 6 }}>
                                <View style={{ height: 11, borderRadius: 6, backgroundColor: bg, width: "85%", overflow: "hidden" }}>
                                  <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: -200, width: 200, transform: [{ translateX: shimTX }] }}>
                                    <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
                                  </Animated.View>
                                </View>
                                <View style={{ height: 9, borderRadius: 5, backgroundColor: bg, width: "52%", overflow: "hidden" }}>
                                  <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: -200, width: 200, transform: [{ translateX: shimTX }] }}>
                                    <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
                                  </Animated.View>
                                </View>
                              </View>
                            </View>
                            <View style={{ height: 180, backgroundColor: bg, overflow: "hidden" }}>
                              <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: -200, width: 250, transform: [{ translateX: shimTX }] }}>
                                <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
                              </Animated.View>
                            </View>
                            <View style={{ padding: 14, gap: 9 }}>
                              <View style={{ height: 13, borderRadius: 7, backgroundColor: bg, overflow: "hidden" }}>
                                <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: -200, width: 200, transform: [{ translateX: shimTX }] }}>
                                  <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
                                </Animated.View>
                              </View>
                              <View style={{ height: 13, borderRadius: 7, backgroundColor: bg, width: "74%", overflow: "hidden" }}>
                                <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: -200, width: 200, transform: [{ translateX: shimTX }] }}>
                                  <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
                                </Animated.View>
                              </View>
                              <View style={{ height: 11, borderRadius: 6, backgroundColor: bg, width: "60%", overflow: "hidden", marginTop: 2 }}>
                                <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: -200, width: 200, transform: [{ translateX: shimTX }] }}>
                                  <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
                                </Animated.View>
                              </View>
                            </View>
                            <View style={{ flexDirection: "row", justifyContent: "space-around", paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                              {[44, 32, 24, 24].map((w, i) => (
                                <View key={i} style={{ width: w, height: 10, borderRadius: 5, backgroundColor: bg, overflow: "hidden" }}>
                                  <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: -100, width: 100, transform: [{ translateX: shimTX }] }}>
                                    <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
                                  </Animated.View>
                                </View>
                              ))}
                            </View>
                          </View>

                        </View>
                      );
                    })()}

                    {/* ─── All caught up footer ─── */}
                    {!newsLoadingMore && filteredNewsArticles.length > 0 && newsDisplayCount >= filteredNewsArticles.length && (
                      <View style={{ alignItems: "center", paddingVertical: 36, paddingHorizontal: 20 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 }}>
                          <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
                          <Text style={{ fontSize: 12, color: colors.textDimmed, fontWeight: "500", letterSpacing: 0.4 }}>
                            {"You're all caught up"}
                          </Text>
                          <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
                        </View>
                        <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: "center" }}>
                          Pull down to refresh for fresh stories
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })()}
            </ScrollView>
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

            {(() => {
              const displayedCallLogs = callLogs.filter((log) => {
                if (callsFilter === "all") return true;
                if (callsFilter === "missed") return log.callType === "missed" || log.status === "rejected" || log.status === "missed";
                if (callsFilter === "outgoing") return log.callType === "outgoing";
                if (callsFilter === "incoming") return log.callType === "incoming" && log.status !== "rejected" && log.status !== "missed";
                return true;
              });

              const formatCallDuration = (seconds) => {
                if (!seconds || seconds <= 0) return "0s";
                const mins = Math.floor(seconds / 60);
                const secs = seconds % 60;
                return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
              };

              if (displayedCallLogs.length > 0) {
                return (
                  <View
                    style={[
                      styles.convList,
                      { backgroundColor: colors.cardBg, borderColor: colors.border },
                    ]}
                  >
                    {displayedCallLogs.map((log, index) => {
                      const isMissed = log.callType === "missed" || log.status === "rejected" || log.status === "missed";
                      const isOutgoing = log.callType === "outgoing";
                      const badgeColor = isMissed ? "#EF4444" : isOutgoing ? "#8B5CF6" : "#10B981";
                      const arrowIcon = isMissed ? "↙" : isOutgoing ? "↗" : "↙";

                      let timeAgo = "Just now";
                      if (log.timestamp) {
                        const diffMins = Math.floor((Date.now() - log.timestamp) / 60000);
                        if (diffMins < 1) timeAgo = "Just now";
                        else if (diffMins < 60) timeAgo = `${diffMins}m ago`;
                        else if (diffMins < 1440) timeAgo = `${Math.floor(diffMins / 60)}h ago`;
                        else timeAgo = new Date(log.timestamp).toLocaleDateString([], { month: "short", day: "numeric" });
                      }

                      let subtitle = "";
                      if (isMissed) {
                        subtitle = "Missed call";
                      } else if (isOutgoing) {
                        subtitle = `Outgoing call • ${formatCallDuration(log.duration)}`;
                      } else {
                        subtitle = `Incoming call • ${formatCallDuration(log.duration)}`;
                      }

                      return (
                        <TouchableOpacity
                          key={log.id || `call_${index}`}
                          onPress={() =>
                            navigation.navigate("Conversation", {
                              partnerId: log.partnerId,
                              partnerName: log.partnerName,
                              partnerAvatar: log.partnerAvatar,
                              originScrollY: scrollOffsetRef.current,
                            })
                          }
                          style={[
                            styles.convCard,
                            {
                              borderBottomColor: colors.border,
                              borderBottomWidth: index === displayedCallLogs.length - 1 ? 0 : 1,
                            },
                          ]}
                        >
                          <View style={styles.avatarContainer}>
                            <Image
                              source={getSafeAvatarSource(log.partnerAvatar, log.partnerName || "User")}
                              style={styles.avatar}
                            />
                            <View
                              style={[
                                styles.callIndicatorBadge,
                                { backgroundColor: badgeColor },
                              ]}
                            >
                              <Text style={styles.callArrow}>{arrowIcon}</Text>
                            </View>
                          </View>
                          <View style={styles.convDetails}>
                            <View style={styles.convHeader}>
                              <Text style={[styles.partnerName, { color: isMissed ? "#EF4444" : colors.text }]}>
                                {log.partnerName || "User"}
                              </Text>
                              <Text style={[styles.convTime, { color: colors.textDimmed }]}>
                                {timeAgo}
                              </Text>
                            </View>
                            <Text style={[styles.convPreview, { color: isMissed ? "#EF4444" : colors.textMuted }]}>
                              {subtitle}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() =>
                              navigation.navigate("Conversation", {
                                partnerId: log.partnerId,
                                partnerName: log.partnerName,
                                partnerAvatar: log.partnerAvatar,
                                originScrollY: scrollOffsetRef.current,
                              })
                            }
                            style={{ padding: 10 }}
                          >
                            <Ionicons name="call-outline" size={20} color={colors.primary} />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              }

              return (
                <View
                  style={{
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: 40,
                    paddingHorizontal: 20,
                    backgroundColor: colors.cardBg,
                    borderRadius: 24,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: colors.text,
                      marginBottom: 6,
                    }}
                  >
                    No call history
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      color: colors.textMuted,
                      textAlign: "center",
                    }}
                  >
                    {callsFilter === "all"
                      ? "Your call history will appear here (up to 15 latest calls saved in phone storage)."
                      : `No ${callsFilter} calls found.`}
                  </Text>
                </View>
              );
            })()}
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

      {/* Floating Action Button (Teal Gradient Floating Plus) for My Contacts Sub-Tab */}
      {activeTab === "contacts" && contactsFilter === "my" && (
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
          onPress={() => {
            setActiveTab("updates");
            setNewsBadgeCount(0);
          }}
        >
          <View
            style={[
              styles.tabIconBg,
              activeTab === "updates" && {
                backgroundColor: colors.primaryGlow,
              },
            ]}
          >
            {!!newsBadgeCount && (
              <View
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  backgroundColor: "#EF4444",
                  borderRadius: 8,
                  minWidth: 16,
                  height: 16,
                  justifyContent: "center",
                  alignItems: "center",
                  paddingHorizontal: 3,
                  zIndex: 10,
                }}
              >
                <Text style={{ color: "white", fontSize: 9, fontWeight: "900", lineHeight: 12 }}>
                  {newsBadgeCount}
                </Text>
              </View>
            )}
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
              <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <Path d="M16 8h2" />
              <Path d="M16 12h2" />
              <Path d="M16 16h2" />
              <Path d="M6 8h6v8H6z" />
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
            News
          </Text>
        </TouchableOpacity>
      </View>

      {/* News Details Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={selectedNews !== null}
        onRequestClose={() => setSelectedNews(null)}
      >
        {selectedNews && (
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
            {/* Reading progress bar */}
            <View style={{ height: 4, backgroundColor: colors.border, width: "100%" }}>
              <View style={{ height: "100%", backgroundColor: colors.primary, width: "70%" }} />
            </View>

            {/* Sticky Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <TouchableOpacity onPress={() => setSelectedNews(null)} style={{ padding: 4 }}>
                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <Line x1="19" y1="12" x2="5" y2="12" />
                  <Polyline points="12 19 5 12 12 5" />
                </Svg>
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, flex: 1, textAlign: "center", marginHorizontal: 12 }} numberOfLines={1}>
                {selectedNews.category}
              </Text>
              <View style={{ flexDirection: "row", gap: 16 }}>
                <TouchableOpacity onPress={() => handleNewsBookmark(selectedNews.id)} style={{ padding: 4 }}>
                  <Svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill={selectedNews.bookmarked ? colors.primary : "none"}
                    stroke={selectedNews.bookmarked ? colors.primary : colors.text}
                    strokeWidth="2.2"
                  >
                    <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </Svg>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleNewsShare(selectedNews)} style={{ padding: 4 }}>
                  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <Circle cx="18" cy="5" r="3" />
                    <Circle cx="6" cy="12" r="3" />
                    <Circle cx="18" cy="19" r="3" />
                    <Line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <Line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </Svg>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {/* Hero Image */}
              <Image source={{ uri: selectedNews.heroImage }} style={{ width: "100%", height: 240 }} resizeMode="cover" />

              {/* Title & Metadata */}
              <View style={{ padding: 20 }}>
                <Text style={{ fontSize: 24, fontWeight: "800", color: colors.text, lineHeight: 32, marginBottom: 12 }}>
                  {selectedNews.title}
                </Text>

                {/* Publisher info row */}
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
                  <Image source={{ uri: selectedNews.publisherAvatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                      {selectedNews.publisher}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textDimmed, marginTop: 2 }}>
                      {selectedNews.publishedAt} • {selectedNews.readingTime} • {selectedNews.views} views
                    </Text>
                  </View>
                </View>

                {/* Summary Box */}
                <View style={{ backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 20 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text, lineHeight: 22 }}>
                    {selectedNews.summary}
                  </Text>
                </View>

                {/* Article Content */}
                <Text style={{ fontSize: 16, color: colors.text, lineHeight: 26, marginBottom: 30 }}>
                  {selectedNews.fullContent || selectedNews.full_content || selectedNews.summary}
                </Text>

                {/* Like / Views footer */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 20, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 20, marginBottom: 30 }}>
                  <TouchableOpacity onPress={() => handleNewsLike(selectedNews.id)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill={selectedNews.liked ? "#EF4444" : "none"}
                      stroke={selectedNews.liked ? "#EF4444" : colors.textMuted}
                      strokeWidth="2.2"
                    >
                      <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </Svg>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textMuted }}>
                      {selectedNews.likes} Likes
                    </Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2.2">
                      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <Circle cx="12" cy="12" r="3" />
                    </Svg>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textMuted }}>
                      {selectedNews.views} Views
                    </Text>
                  </View>
                </View>

                {/* Related Articles */}
                {(() => {
                  const related = newsArticles.filter(art => art.category === selectedNews.category && art.id !== selectedNews.id).slice(0, 3);
                  if (related.length === 0) return null;
                  return (
                    <View>
                      <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 12 }}>
                        Related News
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                        {related.map(art => (
                          <TouchableOpacity
                            key={art.id}
                            onPress={() => setSelectedNews(art)}
                            style={{ width: 220, backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1, borderRadius: 12, overflow: "hidden" }}
                          >
                            <Image source={{ uri: art.heroImage }} style={{ width: "100%", height: 100 }} />
                            <View style={{ padding: 12 }}>
                              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }} numberOfLines={2}>
                                {art.title}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  );
                })()}
              </View>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>

      {/* News Share Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={shareNewsTargetArticle !== null}
        onRequestClose={() => setShareNewsTargetArticle(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.startConvModalContent, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitleText, { color: colors.text }]}>Share via XayLite</Text>
              <TouchableOpacity onPress={() => setShareNewsTargetArticle(null)} style={[styles.modalCloseBtn, { backgroundColor: colors.bg }]}>
                <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2.5">
                  <Line x1="18" y1="6" x2="6" y2="18" />
                  <Line x1="6" y1="6" x2="18" y2="18" />
                </Svg>
              </TouchableOpacity>
            </View>

            {/* Target Article Preview */}
            {shareNewsTargetArticle && (
              <View style={{ flexDirection: "row", padding: 12, backgroundColor: colors.bg, borderRadius: 12, marginHorizontal: 20, marginBottom: 16 }}>
                <Image source={{ uri: shareNewsTargetArticle.heroImage }} style={{ width: 60, height: 60, borderRadius: 8 }} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }} numberOfLines={1}>
                    {shareNewsTargetArticle.title}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textDimmed, marginTop: 4 }} numberOfLines={2}>
                    {shareNewsTargetArticle.summary}
                  </Text>
                </View>
              </View>
            )}

            {/* Contacts Search Bar */}
            <View style={[styles.startConvSearchBar, { backgroundColor: colors.bg, borderColor: colors.border, marginHorizontal: 20, marginBottom: 12 }]}>
              <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2.5" style={{ marginRight: 8 }}>
                <Circle cx="11" cy="11" r="8" />
                <Path d="M21 21l-4.35-4.35" />
              </Svg>
              <TextInput
                style={{ flex: 1, color: colors.text, fontSize: 14, outlineStyle: "none", borderWidth: 0 }}
                placeholder="Search contact..."
                placeholderTextColor={colors.textMuted}
                value={shareSearchText}
                onChangeText={setShareSearchText}
              />
            </View>

            {/* Contacts List */}
            <ScrollView style={{ flex: 1, paddingHorizontal: 20 }}>
              {contacts
                .filter((c) => {
                  if (c.id === "unity_ai") return false;
                  if (!shareSearchText.trim()) return true;
                  return c.name.toLowerCase().includes(shareSearchText.toLowerCase());
                })
                .map((contact) => (
                  <View key={contact.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Image source={{ uri: contact.avatar }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                      <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text, marginLeft: 12 }}>
                        {contact.name}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleNewsShareToContact(contact)}
                      style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16 }}
                    >
                      <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>Send</Text>
                    </TouchableOpacity>
                  </View>
                ))}
            </ScrollView>

            {/* Native Share button */}
            <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: colors.border }}>
              <TouchableOpacity
                onPress={() => {
                  handleNewsShareNative(shareNewsTargetArticle);
                  setShareNewsTargetArticle(null);
                }}
                style={{ backgroundColor: "#1E293B", paddingVertical: 12, borderRadius: 12, alignItems: "center" }}
              >
                <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>Share via Phone sheet...</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* News Admin Creation/Edit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={newsAdminModalVisible}
        onRequestClose={() => setNewsAdminModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={[styles.createPostModalContent, { backgroundColor: colors.cardBg, borderColor: colors.border, maxHeight: height - 100 }]}
          >
            {/* Modal Header */}
            <View style={[styles.createPostHeader, { borderBottomColor: colors.border, padding: 16 }]}>
              <TouchableOpacity onPress={() => setNewsAdminModalVisible(false)}>
                <Text style={{ color: colors.textMuted, fontSize: 15, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
                {adminEditingId ? "Edit Article" : "Create Article"}
              </Text>
              <TouchableOpacity onPress={handleAdminSaveArticle} style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16 }}>
                <Text style={{ color: "white", fontSize: 13, fontWeight: "700" }}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ gap: 16 }}>
              {/* Category Selector */}
              <View>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textDimmed, marginBottom: 6 }}>CATEGORY</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {["Technology", "AI", "Kenya", "World", "Cybersecurity", "Gaming", "Business", "Education", "Science"].map(cat => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setAdminCategory(cat)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 16,
                        backgroundColor: adminCategory === cat ? colors.primary : colors.bg,
                        borderWidth: 1,
                        borderColor: adminCategory === cat ? colors.primary : colors.border
                      }}
                    >
                      <Text style={{ color: adminCategory === cat ? "white" : colors.text, fontSize: 12, fontWeight: "600" }}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Title */}
              <View>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textDimmed, marginBottom: 6 }}>TITLE</Text>
                <TextInput
                  style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 14 }}
                  placeholder="Enter article title..."
                  placeholderTextColor={colors.textMuted}
                  value={adminTitle}
                  onChangeText={setAdminTitle}
                />
              </View>

              {/* Hero Image URL */}
              <View>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textDimmed, marginBottom: 6 }}>HERO IMAGE URL</Text>
                <TextInput
                  style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 14 }}
                  placeholder="Paste image URL (or leave empty for default)..."
                  placeholderTextColor={colors.textMuted}
                  value={adminHeroImage}
                  onChangeText={setAdminHeroImage}
                />
              </View>

              {/* Summary */}
              <View>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textDimmed, marginBottom: 6 }}>SUMMARY</Text>
                <TextInput
                  style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 14, minHeight: 60 }}
                  placeholder="Brief summary of the article..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  value={adminSummary}
                  onChangeText={setAdminSummary}
                />
              </View>

              {/* Full Content */}
              <View>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textDimmed, marginBottom: 6 }}>FULL ARTICLE CONTENT</Text>
                <TextInput
                  style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 14, minHeight: 180, textAlignVertical: "top" }}
                  placeholder="Write the full content of the article..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  value={adminContent}
                  onChangeText={setAdminContent}
                />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
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
                  const aiContact = displayedContacts.find(
                    (c) => c.id === "unity_ai",
                  ) || {
                    id: "unity_ai",
                    name: "Xaylite AI",
                    avatar: require("../../assets/icon.png"),
                    flag: "🌍",
                    langName: "AI Companion",
                    status: "Ready to chat",
                    isUnityUser: true,
                  };
                  const matchesSearch =
                    aiContact.name
                      .toLowerCase()
                      .includes(startConvSearch.toLowerCase()) ||
                    aiContact.id
                      .toLowerCase()
                      .includes(startConvSearch.toLowerCase());
                  if (matchesSearch) {
                    filtered = [aiContact, ...filtered];
                  }
                }

                // Unity AI always first, then Xaylite-available users
                filtered.sort((a, b) => {
                  if (a.id === "unity_ai") return -1;
                  if (b.id === "unity_ai") return 1;
                  const aVal =
                    a.isUnityUser === true || a.isUnityUser === 1 ? 1 : 0;
                  const bVal =
                    b.isUnityUser === true || b.isUnityUser === 1 ? 1 : 0;
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
                        const message = "";
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
                      const targetName = item.name;
                      const targetAvatar = item.avatar_local_path || item.avatar;
                      const targetFlag = item.flag;
                      const targetId = item.id;
                      setTimeout(() => {
                        handlePartnerClick(targetName, targetAvatar, targetFlag, targetId);
                      }, 0);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.modalAvatarContainer}>
                      <Image
                        source={getSafeAvatarSource(item.avatar_local_path || item.avatar, item.name || "User")}
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
                          backgroundColor: !item.isUnityUser
                            ? colors.border
                            : colors.primaryGlow,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.modalPartnerCtaText,
                          {
                            color: !item.isUnityUser
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
  newsContainer: {
    flex: 1,
  },
  newsSearchHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },
  newsSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderRadius: 24,
    height: 48,
    borderWidth: 1,
  },
  newsSearchInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 10,
    paddingVertical: 8,
  },
  newsCategoryList: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  newsCategoryContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryChipActive: {
    borderWidth: 0,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  bookmarkFilterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  newsEmptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  newsEmptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  newsEmptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  newsSectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
  },
  carouselContainer: {
    height: 220,
    marginBottom: 16,
  },
  carouselCard: {
    width: width - 40,
    height: 220,
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  carouselImage: {
    width: "100%",
    height: "100%",
  },
  carouselOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "70%",
    padding: 16,
    justifyContent: "flex-end",
  },
  carouselBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  carouselBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  carouselHeadline: {
    color: "white",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
    marginBottom: 6,
  },
  carouselMeta: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 11,
    fontWeight: "500",
  },
  carouselDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
    marginBottom: 16,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  carouselDotActive: {
    width: 16,
  },
  hotCard: {
    width: 280,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
  },
  hotImage: {
    width: "100%",
    height: 140,
  },
  hotContent: {
    padding: 12,
  },
  hotBadge: {
    alignSelf: "flex-start",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  hotHeadline: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
    marginBottom: 6,
  },
  hotTime: {
    fontSize: 11,
  },
  newsCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  newsCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  publisherAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  publisherName: {
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 8,
    flex: 1,
  },
  newsCardTime: {
    fontSize: 11,
  },
  newsCardImage: {
    width: "100%",
    height: 180,
  },
  newsCardBody: {
    padding: 16,
  },
  newsCardCategory: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  newsCardTitle: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
    marginBottom: 8,
  },
  newsCardSummary: {
    fontSize: 13,
    lineHeight: 18,
  },
  newsCardActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 12,
  },
  newsCardLeftActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  newsActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  newsActionCount: {
    fontSize: 12,
    fontWeight: "600",
  },
});
