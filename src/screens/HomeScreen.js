import React, { useContext, useEffect, useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Polygon, Line, Circle } from "react-native-svg";
import { AppContext } from "../context/AppContext";

const { width } = Dimensions.get("window");

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

// Helper to split a string containing flag emojis and other emojis
function getFlagsFromText(text) {
  if (!text) return [];
  const chars = [...text];
  const flags = [];
  let currentFlag = "";
  for (const char of chars) {
    const cp = char.codePointAt(0);
    if (cp >= 127462 && cp <= 127487) {
      currentFlag += char;
      if ([...currentFlag].length === 2) {
        flags.push(currentFlag);
        currentFlag = "";
      }
    } else {
      if (currentFlag) {
        currentFlag = "";
      }
      flags.push(char);
    }
  }
  return flags;
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

// Helper to render multiple flag images side-by-side or standard emoji/text
function renderMultiFlags(text) {
  const items = getFlagsFromText(text);
  return (
    <View style={styles.multiFlagsWrapper}>
      {items.map((item, idx) => {
        const code = getCountryCodeFromFlag(item);
        if (code) {
          return (
            <Image
              key={idx}
              source={{ uri: `https://flagcdn.com/w40/${code}.png` }}
              style={styles.flagImageMulti}
              resizeMode="cover"
            />
          );
        }
        return (
          <Text key={idx} style={styles.flagTextMulti}>
            {item}
          </Text>
        );
      })}
    </View>
  );
}

const INITIAL_CONTACTS = [
  {
    id: "c1",
    name: "Marcus Sterling",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80",
    flag: "🇺🇸",
    langName: "English (US)",
    status: "Busy",
  },
  {
    id: "c2",
    name: "Yuki Tanaka",
    avatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80",
    flag: "🇯🇵",
    langName: "Japanese",
    status: "Available",
  },
  {
    id: "c3",
    name: "Lucas Dupont",
    avatar:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80",
    flag: "🇫🇷",
    langName: "French",
    status: "In a meeting",
  },
];

const IMPORTABLE_CONTACTS = [
  {
    id: "c4",
    name: "Carlos Gomez",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80",
    flag: "🇪🇸",
    langName: "Spanish",
    status: "Hey there! I am using Unity.",
  },
  {
    id: "c5",
    name: "Aisha Diallo",
    avatar:
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=150&h=150&q=80",
    flag: "🇰🇪",
    langName: "Swahili",
    status: "Available",
  },
  {
    id: "c6",
    name: "Chloe Laurent",
    avatar:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&h=100&q=80",
    flag: "🇫🇷",
    langName: "French",
    status: "Out for lunch",
  },
];

const EXPLORE_PEOPLE = [
  {
    id: "e1",
    name: "Amélie Dubois",
    avatar:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&h=300&q=80",
    flag: "🇫🇷",
    langName: "French (France)",
    bio: "Hi! I am a culinary chef in Paris. Let's exchange recipes!",
  },
  {
    id: "e2",
    name: "Hiroshi Sato",
    avatar:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&h=300&q=80",
    flag: "🇯🇵",
    langName: "Japanese (Japan)",
    bio: "Tech enthusiast and history buff. Happy to translate and chat!",
  },
  {
    id: "e3",
    name: "Isabella Silva",
    avatar:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=300&h=300&q=80",
    flag: "🇧🇷",
    langName: "Portuguese (Brazil)",
    bio: "Architect from São Paulo. Looking to make global friends.",
  },
  {
    id: "e4",
    name: "Rajesh Kumar",
    avatar:
      "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=300&h=300&q=80",
    flag: "🇮🇳",
    langName: "Hindi (India)",
    bio: "Software engineer who loves yoga and trekking. Let's connect!",
  },
];

const INITIAL_POSTS = [
  {
    id: "p1",
    authorName: "Sarah Jenkins",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80",
    flag: "🇺🇸",
    time: "2 hours ago",
    content:
      "Just arrived in Tokyo! The translation app has been a lifesaver for ordering food and finding my hotel. Highly recommend it! 🗼🇯🇵",
    image:
      "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=600&q=80",
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
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80",
    flag: "🇪🇸",
    time: "4 hours ago",
    content:
      "Preparando la presentación para la cumbre europea de mañana. Gracias a Dios por la traducción de documentos en tiempo real de Unity, me ahorró horas de trabajo duro. 🇪🇺💼",
    image: null,
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
  {
    id: "p3",
    authorName: "Amara Okoro",
    avatar:
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=150&h=150&q=80",
    flag: "🇰🇪",
    time: "Yesterday",
    content:
      "Beautiful sunset over the savannah today. Nature never ceases to amaze me. 🌅🦁",
    image:
      "https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=600&q=80",
    likes: 45,
    liked: true,
    comments: [],
  },
  {
    id: "p4",
    authorName: "Kenji Sato",
    avatar:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&h=150&q=80",
    flag: "🇯🇵",
    time: "2 days ago",
    content:
      "Practicing English pronunciation tonight. It gets easier when you have an AI listener that corrects you politely! 🗣️📖",
    image: null,
    likes: 18,
    liked: false,
    comments: [
      {
        id: "c4_1",
        author: "Marcus Sterling",
        content: "Keep it up, Kenji! Your English is already excellent.",
      },
    ],
  },
  {
    id: "p5",
    authorName: "Elena Rostova",
    avatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80",
    flag: "🇷🇺",
    time: "3 days ago",
    content:
      "Walking around Red Square in Moscow. The winter air is freezing but the view is magical. ❄️🕌",
    image:
      "https://images.unsplash.com/photo-1513326738677-b964603b136d?auto=format&fit=crop&w=600&q=80",
    likes: 67,
    liked: false,
    comments: [],
  },
];

export default function HomeScreen({ navigation }) {
  const { currentUser, updateSettings, getLangDetails } =
    useContext(AppContext);
  const [activeTab, setActiveTab] = useState("chats");
  const [onboardingVisible, setOnboardingVisible] = useState(true);
  const [contactsFilter, setContactsFilter] = useState("my");
  const [contacts, setContacts] = useState(INITIAL_CONTACTS);
  const [isImporting, setIsImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [posts, setPosts] = useState(INITIAL_POSTS);
  const [expandedComments, setExpandedComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [startConvModalVisible, setStartConvModalVisible] = useState(false);
  const [startConvSearch, setStartConvSearch] = useState("");
  const [startConvFilter, setStartConvFilter] = useState("contacts");

  // Post/Update creation states
  const [postModalVisible, setPostModalVisible] = useState(false);
  const [newPostText, setNewPostText] = useState("");
  const [newPostImage, setNewPostImage] = useState(null);
  const [newPostFlag, setNewPostFlag] = useState("🇺🇸");

  // Bottom Sheet Comments state
  const [activeCommentsPostId, setActiveCommentsPostId] = useState(null);
  const [newCommentText, setNewCommentText] = useState("");

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
  }, []);

  // Helper to find preset index for avatar (returns 1-4)
  const getAvatarIndex = (url) => {
    if (!url) return 1;
    if (url.includes("photo-1534528741775-53994a69daeb")) return 1;
    if (url.includes("photo-1507003211169-0a1dd7228f2d")) return 2;
    if (url.includes("photo-1517841905240-472988babdf9")) return 3;
    if (url.includes("photo-1488426862026-3ee34a7d66df")) return 4;
    return 1;
  };

  // Define onboarding tasks
  const allTasks = [
    {
      id: "avatar1",
      isCompleted:
        currentUser.avatar &&
        currentUser.avatar.includes("photo-1534528741775-53994a69daeb"),
      uncompletedLabel: "Add profile pic [1]",
      completedLabel: "✓ Profile pic [1] Added",
    },
    {
      id: "avatar2",
      isCompleted:
        currentUser.avatar &&
        currentUser.avatar.includes("photo-1507003211169-0a1dd7228f2d"),
      uncompletedLabel: "Add profile pic [2]",
      completedLabel: "✓ Profile pic [2] Added",
    },
    {
      id: "avatar3",
      isCompleted:
        currentUser.avatar &&
        currentUser.avatar.includes("photo-1517841905240-472988babdf9"),
      uncompletedLabel: "Add profile pic [3]",
      completedLabel: "✓ Profile pic [3] Added",
    },
    {
      id: "avatar4",
      isCompleted:
        currentUser.avatar &&
        currentUser.avatar.includes("photo-1488426862026-3ee34a7d66df"),
      uncompletedLabel: "Add profile pic [4]",
      completedLabel: "✓ Profile pic [4] Added",
    },
    {
      id: "username",
      isCompleted: !!(currentUser.name && currentUser.name !== "Amani User"),
      uncompletedLabel: "Change username",
      completedLabel: "✓ Username Changed",
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
      uncompletedLabel: "Train your AI voice",
      completedLabel: "✓ AI Voice Trained",
    },
    {
      id: "secondaryLang",
      isCompleted: currentUser.secondaryLangsSelected === true,
      uncompletedLabel: "Add secondary language",
      completedLabel: "✓ Secondary Language Added",
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
    setStartConvSearch("");
    setStartConvFilter("contacts");
    setStartConvModalVisible(true);
  };

  const handlePartnerClick = (name, avatar, flag) => {
    navigation.navigate("Conversation", {
      partnerName: name,
      partnerAvatar: avatar,
      partnerFlag: flag,
    });
  };

  const handleOpenSettings = (target) => {
    navigation.navigate("Profile", { scrollTo: target });
  };

  const handleImportContacts = () => {
    if (imported || isImporting) return;
    setIsImporting(true);
    setTimeout(() => {
      setContacts((prev) => [...prev, ...IMPORTABLE_CONTACTS]);
      setIsImporting(false);
      setImported(true);
    }, 1200);
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

  const handleCreatePost = () => {
    if (!newPostText.trim()) return;
    const userFlag = currentUser.nativeLang
      ? getLangDetails(currentUser.nativeLang).flag || "🌍"
      : "🌍";
    const newPost = {
      id: `post_${Date.now()}`,
      authorName:
        currentUser.name && currentUser.name !== "Amani User"
          ? currentUser.name
          : "Amani User",
      avatar:
        currentUser.avatar ||
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80",
      flag: newPostFlag || userFlag,
      time: "Just now",
      content: newPostText,
      image: newPostImage,
      likes: 0,
      liked: false,
      comments: [],
    };
    setPosts((prev) => [newPost, ...prev]);
    setPostModalVisible(false);
    setNewPostText("");
    setNewPostImage(null);
  };

  const getAuthorAvatar = (authorName) => {
    if (
      authorName === currentUser.name ||
      authorName === "Amani User" ||
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
    return "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100&q=80";
  };

  const handlePostChat = (post) => {
    const isOwner =
      post.authorName === (currentUser.name || "Amani User") ||
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
          return {
            ...post,
            comments: [
              ...post.comments,
              {
                id: Date.now().toString(),
                author:
                  currentUser.name && currentUser.name !== "Amani User"
                    ? currentUser.name
                    : "Amani User",
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
    ? posts.find((p) => p.id === activeCommentsPostId)
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

  const handleToggleComments = (postId) => {
    setExpandedComments((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  const handleAddComment = (postId) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id === postId) {
          return {
            ...post,
            comments: [
              ...post.comments,
              {
                id: Date.now().toString(),
                author: currentUser.name,
                content: text,
              },
            ],
          };
        }
        return post;
      }),
    );
    setCommentInputs((prev) => ({
      ...prev,
      [postId]: "",
    }));
  };

  // Interpolate animated gradient shifts
  const translateX = gradientAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -width * 0.6],
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
              {/* Partner Card 1 */}
              <TouchableOpacity
                style={[styles.convCard, { borderBottomColor: colors.border }]}
                activeOpacity={0.7}
                onPress={() =>
                  handlePartnerClick(
                    "Sophia Martinez",
                    "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&h=100&q=80",
                    "🇪🇸",
                  )
                }
              >
                <View style={styles.avatarContainer}>
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
                </View>
                <View style={styles.convDetails}>
                  <View style={styles.convHeader}>
                    <Text style={[styles.partnerName, { color: colors.text }]}>
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

              {/* Partner Card 2 */}
              <TouchableOpacity
                style={[styles.convCard, { borderBottomColor: colors.border }]}
                activeOpacity={0.7}
                onPress={() =>
                  handlePartnerClick(
                    "Kenji Sato",
                    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80",
                    "🇯🇵",
                  )
                }
              >
                <View style={styles.avatarContainer}>
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
                </View>
                <View style={styles.convDetails}>
                  <View style={styles.convHeader}>
                    <Text style={[styles.partnerName, { color: colors.text }]}>
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

              {/* Partner Card 3 */}
              <TouchableOpacity
                style={[styles.convCard, { borderBottomWidth: 0 }]}
                activeOpacity={0.7}
                onPress={() =>
                  handlePartnerClick(
                    "Amara Okoro",
                    "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=100&h=100&q=80",
                    "🇰🇪",
                  )
                }
              >
                <View style={styles.avatarContainer}>
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
                </View>
                <View style={styles.convDetails}>
                  <View style={styles.convHeader}>
                    <Text style={[styles.partnerName, { color: colors.text }]}>
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
              <View>
                {!imported ? (
                  <TouchableOpacity
                    style={[
                      styles.importCard,
                      {
                        backgroundColor: colors.cardBg,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={handleImportContacts}
                    activeOpacity={0.8}
                    disabled={isImporting}
                  >
                    <LinearGradient
                      colors={[
                        "rgba(79, 70, 229, 0.08)",
                        "rgba(6, 182, 212, 0.08)",
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.importCardGradient}
                    >
                      <View
                        style={[
                          styles.importIconContainer,
                          { backgroundColor: colors.primaryGlow },
                        ]}
                      >
                        {isImporting ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.primary}
                          />
                        ) : (
                          <Svg
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke={colors.primary}
                            strokeWidth="2.5"
                          >
                            <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </Svg>
                        )}
                      </View>
                      <View style={styles.importInfo}>
                        <Text
                          style={[styles.importTitle, { color: colors.text }]}
                        >
                          {isImporting ? "Syncing..." : "Import Phone Contacts"}
                        </Text>
                        <Text
                          style={[
                            styles.importDesc,
                            { color: colors.textMuted },
                          ]}
                        >
                          {isImporting
                            ? "Reading address book..."
                            : "Quickly sync your local phone contacts"}
                        </Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
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
                      ✓ Successfully synced {IMPORTABLE_CONTACTS.length} phone
                      contacts!
                    </Text>
                  </View>
                )}

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
                  {contacts.map((contact, index) => (
                    <TouchableOpacity
                      key={contact.id}
                      style={[
                        styles.convCard,
                        index === contacts.length - 1
                          ? { borderBottomWidth: 0 }
                          : { borderBottomColor: colors.border },
                      ]}
                      activeOpacity={0.7}
                      onPress={() =>
                        handlePartnerClick(
                          contact.name,
                          contact.avatar,
                          contact.flag,
                        )
                      }
                    >
                      <View style={styles.avatarContainer}>
                        <Image
                          source={{ uri: contact.avatar }}
                          style={styles.avatar}
                        />
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
                            style={[styles.partnerName, { color: colors.text }]}
                          >
                            {contact.name}
                          </Text>
                          <Text
                            style={[
                              styles.contactStatus,
                              { color: colors.accent },
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
                  ))}
                </View>
              </View>
            )}

            {contactsFilter === "explore" && (
              <View>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: colors.textDimmed, marginTop: 12 },
                  ]}
                >
                  Explore Translation Partners
                </Text>

                <View style={styles.exploreGrid}>
                  {EXPLORE_PEOPLE.map((person) => (
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
                        source={{ uri: person.avatar }}
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
                              person.avatar,
                              person.flag,
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
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.textDimmed, marginLeft: 20 },
              ]}
            >
              Recent Updates
            </Text>
            {posts.map((post) => {
              const isCommentsVisible = expandedComments[post.id];
              return (
                <View
                  key={post.id}
                  style={[
                    styles.postCard,
                    {
                      backgroundColor: colors.cardBg,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {/* Post Header */}
                  <View style={styles.postHeader}>
                    <View style={styles.avatarContainer}>
                      <Image
                        source={{ uri: post.avatar }}
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
                        style={[styles.postAuthorName, { color: colors.text }]}
                      >
                        {post.authorName}
                      </Text>
                      <Text
                        style={[
                          styles.postTimeText,
                          { color: colors.textDimmed },
                        ]}
                      >
                        {post.time}
                      </Text>
                    </View>

                    {/* Header Action Icons: Chat + 3-Dot Options */}
                    <View style={styles.postHeaderActions}>
                      <TouchableOpacity
                        onPress={() => handlePostChat(post)}
                        style={styles.postHeaderActionBtn}
                        activeOpacity={0.7}
                      >
                        <Svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={colors.textMuted}
                          strokeWidth="2.2"
                        >
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </Svg>
                      </TouchableOpacity>

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
                          <circle cx="12" cy="12" r="1.5" />
                          <circle cx="6" cy="12" r="1.5" />
                          <circle cx="18" cy="12" r="1.5" />
                        </Svg>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Post Content */}
                  <Text
                    style={[styles.postContentText, { color: colors.text }]}
                  >
                    {post.content}
                  </Text>

                  {/* Post Image */}
                  {post.image && (
                    <Image
                      source={{ uri: post.image }}
                      style={styles.postImage}
                      resizeMode="cover"
                    />
                  )}

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
                        {post.comments.length}{" "}
                        {post.comments.length === 1 ? "Comment" : "Comments"}
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
            <Text style={[styles.sectionTitle, { color: colors.textDimmed }]}>
              Recent Translations
            </Text>

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

      {/* Centered Premium Onboarding Popup Card (adapts to light/dark themes dynamically!) */}
      {onboardingVisible && (
        <View
          style={[
            styles.onboardingOverlay,
            Platform.OS === "web"
              ? { pointerEvents: "none" }
              : { pointerEvents: "box-none" },
          ]}
        >
          <View
            style={[
              styles.onboardingCard,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
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
                onPress={() => setOnboardingVisible(false)}
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
                            backgroundColor: colors.bg,
                            borderColor: colors.border,
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
                          : { color: colors.textMuted },
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
      )}

      {/* Floating Action Button (Teal Gradient Floating Plus) for Contacts Tab */}
      {activeTab === "contacts" && (
        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.8}
          onPress={handleStartConv}
        >
          <LinearGradient
            colors={["#0D9488", "#059669"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          >
            <Svg
              width="24"
              height="24"
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
          style={styles.fab}
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
              width="24"
              height="24"
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
          { backgroundColor: colors.cardBg, borderColor: colors.border },
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
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.createPostModalContent,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
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
                  {currentUser.name || "Amani User"}
                </Text>

                {/* Scrollable Row of Flags to tag post */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.tagFlagsScroll}
                >
                  {[
                    "🇺🇸",
                    "🇪🇸",
                    "🇫🇷",
                    "🇰🇪",
                    "🇯🇵",
                    "🇩🇪",
                    "🇨🇳",
                    "🇸🇦",
                    "🇮🇹",
                    "🇧🇷",
                    "🇷🇺",
                    "🇰🇷",
                    "🇮🇳",
                    "🇹🇷",
                  ].map((flag) => {
                    const isSelected = newPostFlag === flag;
                    return (
                      <TouchableOpacity
                        key={flag}
                        style={[
                          styles.tagFlagBtn,
                          isSelected && {
                            backgroundColor: colors.primaryGlow,
                            borderColor: colors.primary,
                          },
                        ]}
                        onPress={() => setNewPostFlag(flag)}
                      >
                        <Text style={styles.tagFlagText}>{flag}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
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

            {/* Selected image preview */}
            {newPostImage && (
              <View style={styles.createPostImgPreviewContainer}>
                <Image
                  source={{ uri: newPostImage }}
                  style={styles.createPostImgPreview}
                />
                <TouchableOpacity
                  style={[
                    styles.deleteImgBtn,
                    { backgroundColor: colors.danger },
                  ]}
                  onPress={() => setNewPostImage(null)}
                >
                  <Text style={styles.deleteImgBtnText}>&times;</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Photo preset attachments list */}
            <Text style={[styles.attachLabel, { color: colors.textMuted }]}>
              Attach a Photo Preset
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.presetImagesScroll}
            >
              {[
                "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=300&q=80",
                "https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=300&q=80",
                "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=300&q=80",
                "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=300&q=80",
                "https://images.unsplash.com/photo-1472214222541-d510753a4907?auto=format&fit=crop&w=300&q=80",
              ].map((url, idx) => {
                const isSelected = newPostImage === url;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.presetImgBtn,
                      isSelected && {
                        borderColor: colors.primary,
                        borderWidth: 2,
                      },
                    ]}
                    onPress={() => setNewPostImage(url)}
                  >
                    <Image
                      source={{ uri: url }}
                      style={styles.presetImgThumb}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
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
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
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
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
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
                    (currentUser.name || "Amani User") ||
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
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
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
                          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                          <line x1="4" y1="22" x2="4" y2="15" />
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
                Comments ({activePost ? activePost.comments.length : 0})
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
              {activePost && activePost.comments.length > 0 ? (
                activePost.comments.map((comment) => (
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
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
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
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
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

            {/* Filter Tabs / Chips: "From Contact" and "From Global" */}
            <View style={styles.modalFilterRow}>
              <TouchableOpacity
                style={[
                  styles.modalFilterChip,
                  startConvFilter === "contacts"
                    ? {
                        backgroundColor: colors.primaryGlow,
                        borderColor: colors.primary,
                      }
                    : {
                        backgroundColor: colors.bg,
                        borderColor: colors.border,
                      },
                ]}
                onPress={() => setStartConvFilter("contacts")}
              >
                <Text
                  style={[
                    styles.modalFilterChipText,
                    {
                      color:
                        startConvFilter === "contacts"
                          ? colors.primary
                          : colors.textMuted,
                    },
                  ]}
                >
                  From Contacts
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalFilterChip,
                  startConvFilter === "global"
                    ? {
                        backgroundColor: colors.primaryGlow,
                        borderColor: colors.primary,
                      }
                    : {
                        backgroundColor: colors.bg,
                        borderColor: colors.border,
                      },
                ]}
                onPress={() => setStartConvFilter("global")}
              >
                <Text
                  style={[
                    styles.modalFilterChipText,
                    {
                      color:
                        startConvFilter === "global"
                          ? colors.primary
                          : colors.textMuted,
                    },
                  ]}
                >
                  From Global
                </Text>
              </TouchableOpacity>
            </View>

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
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
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
                  startConvFilter === "contacts" ? contacts : EXPLORE_PEOPLE;
                const filtered = sourceList.filter(
                  (item) =>
                    item.name
                      .toLowerCase()
                      .includes(startConvSearch.toLowerCase()) ||
                    item.id
                      .toLowerCase()
                      .includes(startConvSearch.toLowerCase()),
                );

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
                      setStartConvModalVisible(false);
                      handlePartnerClick(item.name, item.avatar, item.flag);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.modalAvatarContainer}>
                      <Image
                        source={{ uri: item.avatar }}
                        style={styles.modalAvatar}
                      />
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
                        { backgroundColor: colors.primaryGlow },
                      ]}
                    >
                      <Text
                        style={[
                          styles.modalPartnerCtaText,
                          { color: colors.primary },
                        ]}
                      >
                        Chat
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
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 8,
  },
  fab: {
    position: "absolute",
    right: 24,
    bottom: 96,
    width: 56,
    height: 56,
    borderRadius: 28,
    shadowColor: "#0D9488",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 10,
  },
  fabGradient: {
    flex: 1,
    width: "100%",
    height: "100%",
    borderRadius: 28,
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
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
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 16,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    height: "100%",
    padding: 0,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 40,
    height: "85%",
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
  createPostUserRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
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
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: "top",
    minHeight: 120,
    paddingVertical: 8,
  },
  createPostImgPreviewContainer: {
    position: "relative",
    width: "100%",
    height: 180,
    borderRadius: 12,
    overflow: "hidden",
    marginVertical: 12,
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
  attachLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 8,
  },
  presetImagesScroll: {
    flexDirection: "row",
    marginBottom: 20,
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
