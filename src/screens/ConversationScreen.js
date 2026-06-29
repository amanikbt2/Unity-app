/* eslint-disable react-hooks/immutability */
import React, { useState, useEffect, useRef, useContext } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Animated as RNAnimated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Line, Rect, Polygon } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import {
  useAudioRecorder,
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
} from "expo-audio";
import * as Speech from "expo-speech";
import * as FileSystem from "expo-file-system/legacy";
import { translateText, translateVoice, chatWithAI } from "../services/TranslationService";
import { AppContext } from "../context/AppContext";
import UserProfilePopup from "../components/UserProfilePopup";
import { saveChat, getChats } from "../services/DatabaseService";

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

// Audio recording settings optimized for 16kHz mono voice compression (ideal for AI Speech-to-Text)
const COMPRESSED_AUDIO_OPTIONS = {
  android: {
    extension: ".m4a",
    outputFormat: "mpeg4",
    audioEncoder: "aac",
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: ".m4a",
    audioQuality: AudioQuality.MEDIUM,
    outputFormat: IOSOutputFormat.MPEG4AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: "audio/webm",
    bitsPerSecond: 128000,
  },
  isMeteringEnabled: true,
};

export default function ConversationScreen({ route, navigation }) {
  const { partnerName, partnerAvatar, partnerFlag, partnerId, partnerStatus } =
    route.params || {
      partnerName: "Unity Translation AI",
      partnerAvatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80",
      partnerFlag: "🌍",
      partnerId: "Unity Translation AI",
    };

  const isOnline = partnerId === "unity_ai" 
    ? true
    : partnerStatus 
      ? /online|available|ready to chat|connected|active/.test(partnerStatus.trim().toLowerCase()) 
      : false;

  const { currentUser, getLangDetails, getLangDetailsFromFlag, LANGS } =
    useContext(AppContext);

  const [isKeyboardMode, setIsKeyboardMode] = useState(false);
  const [inputText, setInputText] = useState("");
  const [chatBubbles, setChatBubbles] = useState([]);

  const [subtitleReceived, setSubtitleReceived] = useState(
    "Waiting for speech...",
  );
  const [subtitleUser, setSubtitleUser] = useState("Hold mic to start talking");
  const [profilePopupVisible, setProfilePopupVisible] = useState(false);
  const [profilePopupData, setProfilePopupData] = useState(null);

  // Shared Animation Values for the Orb
  const orbScale = useSharedValue(1);
  const glow1Opacity = useSharedValue(0.1);
  const glow2Opacity = useSharedValue(0.2);
  const waveRotate1 = useSharedValue(0);
  const waveRotate2 = useSharedValue(0);

  const onRecordingStatusUpdate = (status) => {
    if (status.metering !== undefined) {
      const db = status.metering;
      // Normal range of active voice is -60dB to 0dB. Normalize to [0, 1].
      const normalized = Math.max(0, (db + 60) / 60);

      orbScale.value = withTiming(1.0 + normalized * 0.45, { duration: 100 });
      glow1Opacity.value = withTiming(0.1 + normalized * 0.5, {
        duration: 100,
      });
      glow2Opacity.value = withTiming(0.2 + normalized * 0.6, {
        duration: 100,
      });
    }
  };

  const recorder = useAudioRecorder(
    COMPRESSED_AUDIO_OPTIONS,
    onRecordingStatusUpdate,
  );

  const [isRecording, setIsRecording] = useState(false);

  const getLangCodeFromFlag = (flagEmoji) => {
    if (!LANGS) return "en";
    for (const [code, details] of Object.entries(LANGS)) {
      if (details.flag === flagEmoji) {
        return code;
      }
    }
    return "en";
  };

  const openProfilePopup = (profile) => {
    setProfilePopupData(profile);
    setProfilePopupVisible(true);
  };

  const chatScrollViewRef = useRef();
  const isPreparingRef = useRef(false);
  const shouldStopAfterPrepareRef = useRef(false);

  // Clean up recording on unmount
  useEffect(() => {
    return () => {
      // recorder hook automatically cleans up on unmount in expo-audio
    };
  }, []);

  const [shimmerAnim] = useState(() => new RNAnimated.Value(0.3));

  // Shimmer loop for optimistic loading bubbles
  useEffect(() => {
    const animation = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(shimmerAnim, {
          toValue: 1.0,
          duration: 800,
          useNativeDriver: Platform.OS !== "web",
        }),
        RNAnimated.timing(shimmerAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, []);

  // Set up breathing & fluid animations for the center orb
  useEffect(() => {
    // Continuous wave rotations
    waveRotate1.value = withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1,
      false,
    );

    waveRotate2.value = withRepeat(
      withTiming(-360, { duration: 11000, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  // Update orb pulse animation based on recording status
  useEffect(() => {
    if (isRecording) {
      // Keep the current scale while recording; idle breathing resumes after release.
    } else {
      orbScale.value = withRepeat(
        withSequence(
          withTiming(1.15, {
            duration: 1800,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          }),
          withTiming(1.0, {
            duration: 1800,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          }),
        ),
        -1,
        true,
      );
      glow1Opacity.value = withRepeat(
        withSequence(
          withTiming(0.25, { duration: 1200 }),
          withTiming(0.08, { duration: 1200 }),
        ),
        -1,
        true,
      );
      glow2Opacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 1600 }),
          withTiming(0.15, { duration: 1600 }),
        ),
        -1,
        true,
      );
    }
  }, [isRecording]);

  // Animated styles
  const animatedOrbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
  }));

  const animatedGlow1 = useAnimatedStyle(() => ({
    opacity: glow1Opacity.value,
  }));

  const animatedGlow2 = useAnimatedStyle(() => ({
    opacity: glow2Opacity.value,
  }));

  const animatedWave1 = useAnimatedStyle(() => ({
    transform: [{ rotate: `${waveRotate1.value}deg` }],
  }));

  const animatedWave2 = useAnimatedStyle(() => ({
    transform: [{ rotate: `${waveRotate2.value}deg` }],
  }));

  // Theme mapping
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
    primaryGlow: isDark ? "rgba(139, 92, 246, 0.2)" : "rgba(79, 70, 229, 0.15)",
    danger: isDark ? "#EF4444" : "#E11D48",
    chatLogBg: isDark ? "#0A0612" : "#F1F5F9",
    headerBg: isDark ? "rgba(10, 6, 18, 0.85)" : "rgba(241, 245, 249, 0.95)",
    bubbleUserBg: isDark
      ? "linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(109, 40, 217, 0.25) 100%)"
      : "#4F46E5",
  };

  // Request microphone permissions on component mount
  useEffect(() => {
    async function getPermission() {
      const { status } = await AudioModule.requestRecordingPermissionsAsync();
      if (status !== "granted") {
        console.warn("Microphone permission not granted");
      }
    }
    getPermission();
  }, []);

  // Load local chat history or set up welcome message
  useEffect(() => {
    async function loadChatHistory() {
      try {
        const dbChats = await getChats(partnerId);
        if (dbChats && dbChats.length > 0) {
          const formatted = dbChats.map((item) => ({
            id: item.id,
            sender: item.sender,
            avatar: item.sender === "user" ? currentUser.avatar : partnerFlag,
            text: item.text,
            origLang: item.orig_lang,
            transText: item.trans_text,
            transLang: item.trans_lang,
          }));
          setChatBubbles(formatted);
          if (formatted.length > 0) {
            setSubtitleReceived(
              formatted[formatted.length - 1].transText ||
                "Waiting for speech...",
            );
          }
        } else {
          const partnerLang = getLangCodeFromFlag(partnerFlag);
          const partnerLangName = getLangDetails(partnerLang).name;
          const userLangName = getLangDetails(currentUser.nativeLang).name;

          let welcomeText =
            "Hello, welcome! Speak or type, and I will translate for you in real-time.";
          try {
            welcomeText = await translateText(welcomeText, partnerLang);
          } catch (e) {
            console.warn("Welcome translate failed, using fallback:", e);
          }

          const firstMsg = {
            id: "initial_" + Date.now(),
            partner_id: partnerId,
            text: welcomeText,
            trans_text:
              "Hello, welcome! Speak or type, and I will translate for you in real-time.",
            sender: "partner",
            orig_lang: `${partnerLangName} (Original)`,
            trans_lang: `${userLangName} (Translated)`,
            timestamp: Date.now(),
          };

          await saveChat(firstMsg);

          setChatBubbles([
            {
              id: firstMsg.id,
              sender: firstMsg.sender,
              avatar: partnerFlag,
              text: firstMsg.text,
              origLang: firstMsg.orig_lang,
              transText: firstMsg.trans_text,
              transLang: firstMsg.trans_lang,
            },
          ]);
          setSubtitleReceived(welcomeText);
        }
      } catch (e) {
        console.error("Error loading chat history:", e);
      }
    }
    loadChatHistory();
  }, [partnerId]);

  // Scroll to bottom helper
  useEffect(() => {
    if (chatScrollViewRef.current) {
      setTimeout(
        () => chatScrollViewRef.current.scrollToEnd({ animated: true }),
        100,
      );
    }
  }, [chatBubbles, isKeyboardMode]);

  const startRecording = async () => {
    if (isPreparingRef.current || recorder.isRecording || isRecording) {
      console.log("Recording is already preparing or active.");
      return;
    }

    isPreparingRef.current = true;
    shouldStopAfterPrepareRef.current = false;

    try {
      const permission = await AudioModule.getRecordingPermissionsAsync();
      if (permission.status !== "granted") {
        const request = await AudioModule.requestRecordingPermissionsAsync();
        if (request.status !== "granted") {
          alert("Microphone permission is required to use this feature.");
          isPreparingRef.current = false;
          return;
        }
      }

      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log("Starting recording...");

      if (shouldStopAfterPrepareRef.current) {
        console.log(
          "User released button before preparation completed. Cancelling start.",
        );
        isPreparingRef.current = false;
        await AudioModule.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
        return;
      }

      await recorder.prepareToRecordAsync();
      recorder.record();

      if (shouldStopAfterPrepareRef.current) {
        console.log("User released button during preparation. Stopping now.");
        await recorder.stop();
        await AudioModule.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
      } else {
        setIsRecording(true);
        setSubtitleUser("Recording voice...");
      }
    } catch (err) {
      console.error("Failed to start recording", err);
    } finally {
      isPreparingRef.current = false;
    }
  };

  const stopRecording = async () => {
    console.log("Stopping recording...");

    if (isPreparingRef.current) {
      console.log("Still preparing. Setting shouldStopAfterPrepareRef flag.");
      shouldStopAfterPrepareRef.current = true;
      setIsRecording(false);
      setSubtitleUser("Processing voice...");
      setSubtitleReceived("Translating...");
      return;
    }

    if (!recorder.isRecording && !isRecording) {
      console.log("No active recording to stop.");
      return;
    }

    setIsRecording(false);
    setSubtitleUser("Processing voice...");
    setSubtitleReceived("Translating...");

    try {
      await recorder.stop();
      const uri = recorder.uri;

      // Deactivate recording audio mode so speaker output works
      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      if (uri) {
        await handleVoiceMessage(uri);
      }
    } catch (err) {
      console.error("Failed to stop recording", err);
      setSubtitleUser("Recording failed");
      setSubtitleReceived("Error processing voice");
    }
  };

  const handleVoiceMessage = async (audioUri) => {
    const partnerLang = getLangCodeFromFlag(partnerFlag);
    const partnerLangName = partnerId === "unity_ai" 
      ? getLangDetails(currentUser.unityAILang)?.name || "AI"
      : getLangDetails(partnerLang).name;
    const userLangName = getLangDetails(currentUser.nativeLang).name;

    try {
      const result = await translateVoice(audioUri, partnerLang);
      const { transcription, translation } = result;

      // Update subtitle overlays
      setSubtitleUser(transcription);
      setSubtitleReceived(translation);

      // Add user message to chat bubbles
      const userMsgId = "msg_" + Date.now();
      const userMsg = {
        id: userMsgId,
        sender: "user",
        avatar: "🇺🇸",
        text: transcription,
        origLang: `${userLangName} (Original)`,
        transText: translation,
        transLang: `${partnerLangName} ${partnerId === "unity_ai" ? "(AI)" : "(Translated)"}`,
      };
      setChatBubbles((prev) => [...prev, userMsg]);

      // Save user message to SQLite
      await saveChat({
        id: userMsgId,
        partner_id: partnerId,
        text: transcription,
        trans_text: translation,
        sender: "user",
        orig_lang: `${userLangName} (Original)`,
        trans_lang: `${partnerLangName} (Translated)`,
        timestamp: Date.now(),
      });

      // Speak translation out loud (simulating playing on partner's end)
      Speech.speak(translation, { language: partnerLang });

      // Clean up transient audio file immediately
      await FileSystem.deleteAsync(audioUri, { idempotent: true }).catch(
        (err) => console.warn("Failed to delete transient audio file:", err),
      );

      // Simulate partner responding with voice (or AI)
      setTimeout(async () => {
        try {
          let partnerResponseBase = "I heard your voice message! Loud and clear.";
          let partnerSpokenText = "";

          if (partnerId === "unity_ai") {
            const aiReply = await chatWithAI(translation, [], currentUser.unityAILang || "en");
            partnerSpokenText = aiReply;
            partnerResponseBase = await translateText(aiReply, currentUser.nativeLang);
          } else {
            partnerSpokenText = await translateText(
              partnerResponseBase,
              partnerLang,
            );
          }

          const partnerMsgId = "msg_" + (Date.now() + 1);
          const partnerMsg = {
            id: partnerMsgId,
            sender: "partner",
            avatar: partnerFlag,
            text: partnerSpokenText,
            origLang: `${partnerLangName} (Original)`,
            transText: partnerResponseBase,
            transLang: `${userLangName} (Translated)`,
          };

          setSubtitleReceived(partnerSpokenText);
          setSubtitleUser(partnerResponseBase);
          setChatBubbles((prev) => [...prev, partnerMsg]);

          // Save partner response to SQLite
          await saveChat({
            id: partnerMsgId,
            partner_id: partnerId,
            text: partnerSpokenText,
            trans_text: partnerResponseBase,
            sender: "partner",
            orig_lang: `${partnerLangName} (Original)`,
            trans_lang: `${userLangName} (Translated)`,
            timestamp: Date.now(),
          });

          // Speak partner's translated response to the user in their language
          Speech.speak(partnerResponseBase, {
            language: currentUser.nativeLang,
          });
        } catch (err) {
          console.error("Failed to simulate partner response:", err);
        }
      }, 3500);
    } catch (error) {
      console.error("Voice translation error:", error);
      setSubtitleUser("Voice translation failed");
      setSubtitleReceived("Check server or API Key configuration.");

      // Still clean up the file on failure
      await FileSystem.deleteAsync(audioUri, { idempotent: true }).catch(
        (err) => console.warn("Failed to delete transient audio file:", err),
      );
    }
  };

  const handleSendText = async () => {
    if (!inputText.trim()) return;

    const text = inputText.trim();
    setInputText("");
    setSubtitleUser(text);
    setSubtitleReceived("Translating...");

    const partnerLang = getLangCodeFromFlag(partnerFlag);
    const partnerLangName = partnerId === "unity_ai" 
      ? getLangDetails(currentUser.unityAILang)?.name || "AI"
      : getLangDetails(partnerLang).name;
    const userLangName = getLangDetails(currentUser.nativeLang).name;

    // Create temporary bubble while translating
    const userMsgId = "msg_" + Date.now();
    const userMsg = {
      id: userMsgId,
      sender: "user",
      avatar: "🇺🇸", // or get user flag from context
      text: text,
      origLang: `${userLangName} (Original)`,
      transText: "...",
      transLang: `${partnerLangName} ${partnerId === "unity_ai" ? "(AI)" : "(Translated)"}`,
    };
    setChatBubbles((prev) => [...prev, userMsg]);

    try {
      const translation = await translateText(text, partnerLang);

      // Update message with actual translation
      setChatBubbles((prev) =>
        prev.map((msg) =>
          msg.id === userMsgId ? { ...msg, transText: translation } : msg,
        ),
      );
      setSubtitleReceived(translation);

      // Save user message to SQLite
      await saveChat({
        id: userMsgId,
        partner_id: partnerId,
        text: text,
        trans_text: translation,
        sender: "user",
        orig_lang: `${userLangName} (Original)`,
        trans_lang: `${partnerLangName} (Translated)`,
        timestamp: Date.now(),
      });

      // Simulate partner responding with text
      setTimeout(async () => {
        try {
          let partnerResponseBase = "Got your text! Thanks for checking in.";
          let partnerSpokenText = "";

          if (partnerId === "unity_ai") {
            const aiReply = await chatWithAI(translation, [], currentUser.unityAILang || "en");
            partnerSpokenText = aiReply;
            partnerResponseBase = await translateText(aiReply, currentUser.nativeLang);
          } else {
            partnerSpokenText = await translateText(
              partnerResponseBase,
              partnerLang,
            );
          }

          const partnerMsgId = "msg_" + (Date.now() + 1);
          const partnerMsg = {
            id: partnerMsgId,
            sender: "partner",
            avatar: partnerFlag,
            text: partnerSpokenText,
            origLang: `${partnerLangName} (Original)`,
            transText: partnerResponseBase,
            transLang: `${userLangName} (Translated)`,
          };

          setSubtitleReceived(partnerSpokenText);
          setSubtitleUser(partnerResponseBase);
          setChatBubbles((prev) => [...prev, partnerMsg]);

          // Save partner reply to SQLite
          await saveChat({
            id: partnerMsgId,
            partner_id: partnerId,
            text: partnerSpokenText,
            trans_text: partnerResponseBase,
            sender: "partner",
            orig_lang: `${partnerLangName} (Original)`,
            trans_lang: `${userLangName} (Translated)`,
            timestamp: Date.now(),
          });
        } catch (err) {
          console.error("Failed to translate simulated partner reply:", err);
        }
      }, 2000);
    } catch (error) {
      console.error("Text translation error:", error);
      setSubtitleReceived("Translation failed");
    }
  };

  // Render unified bubble headers and dividers
  const renderBubble = (bubble) => {
    const isUser = bubble.sender === "user";
    let senderLabel = "";
    let metaLabel = "";
    let flagEmoji = "";

    if (isUser) {
      senderLabel = "Me";
      const details = getLangDetails(currentUser.nativeLang);
      flagEmoji = details.flag;
      metaLabel = `${flagEmoji} ${details.name} (${details.country})`;
    } else {
      senderLabel = partnerName;
      const flag = bubble.avatar || "🌍";
      flagEmoji = flag;
      const details = getLangDetailsFromFlag(flag);
      metaLabel = `${flag} ${details.name} (${details.country})`;
    }

    return (
      <View
        key={bubble.id}
        style={[
          styles.bubbleWrapper,
          isUser ? styles.bubbleUserWrapper : styles.bubblePartnerWrapper,
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() =>
            openProfilePopup(
              isUser
                ? {
                    name: currentUser.name,
                    avatar: currentUser.avatar,
                    nativeLang: currentUser.nativeLang,
                    uid: currentUser.uid,
                  }
                : {
                    name: partnerName,
                    avatar: partnerAvatar,
                    flag: bubble.avatar || partnerFlag,
                    langName: getLangDetailsFromFlag(
                      bubble.avatar || partnerFlag,
                    ).name,
                    country: getLangDetailsFromFlag(
                      bubble.avatar || partnerFlag,
                    ).country,
                    uid: partnerId,
                  },
            )
          }
          style={[
            styles.bubbleAvatarWrapper,
            { backgroundColor: colors.border },
          ]}
        >
          {renderFlagOrEmoji(flagEmoji)}
        </TouchableOpacity>

        <View
          style={[
            styles.bubbleTextContainer,
            isUser
              ? { backgroundColor: colors.primary }
              : {
                  backgroundColor: colors.cardBg,
                  borderColor: colors.border,
                  borderWidth: 1,
                },
          ]}
        >
          {/* Custom Header at the top (flag, country, language labels) */}
          <View
            style={[
              styles.bubbleHeader,
              {
                borderBottomColor: isUser
                  ? "rgba(255, 255, 255, 0.15)"
                  : "rgba(0, 0, 0, 0.05)",
              },
            ]}
          >
            <Text
              style={[
                styles.bubbleSender,
                isUser ? styles.whiteText : { color: colors.text },
              ]}
            >
              {senderLabel}
            </Text>
            <Text
              style={[
                styles.bubbleMeta,
                isUser ? styles.lightWhiteText : { color: colors.textDimmed },
              ]}
            >
              {metaLabel}
            </Text>
          </View>

          {/* Messages body with middle divider line */}
          <View style={styles.bubbleBody}>
            <Text
              style={[
                styles.bubbleTextOriginal,
                isUser ? styles.whiteText : { color: colors.text },
              ]}
            >
              {bubble.text}
            </Text>
            <View
              style={[
                styles.bubbleDivider,
                {
                  backgroundColor: isUser
                    ? "rgba(255, 255, 255, 0.15)"
                    : "rgba(0, 0, 0, 0.05)",
                },
              ]}
            />
            {bubble.transText === "..." ? (
              <RNAnimated.View
                style={{
                  opacity: shimmerAnim,
                  height: 16,
                  width: 140,
                  borderRadius: 8,
                  overflow: "hidden",
                  marginTop: 4,
                }}
              >
                <LinearGradient
                  colors={[
                    isUser
                      ? "rgba(255, 255, 255, 0.15)"
                      : "rgba(139, 92, 246, 0.1)",
                    isUser
                      ? "rgba(255, 255, 255, 0.45)"
                      : "rgba(139, 92, 246, 0.25)",
                    isUser
                      ? "rgba(255, 255, 255, 0.15)"
                      : "rgba(139, 92, 246, 0.1)",
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ flex: 1 }}
                />
              </RNAnimated.View>
            ) : (
              <Text
                style={[
                  styles.bubbleTextTrans,
                  isUser ? { color: "#93C5FD" } : { color: colors.primary },
                ]}
              >
                {bubble.transText}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: colors.bg }]}
    >
      {/* Header bar */}
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
            style={styles.backBtn}
          >
            <Svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.text}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Line x1="19" y1="12" x2="5" y2="12" />
              <Path d="M12 19l-7-7 7-7" />
            </Svg>
          </TouchableOpacity>

          <View style={styles.partnerInfo}>
            <Text style={[styles.partnerNameText, { color: colors.text }]}>
              {partnerName}
            </Text>
            <Text
              style={[styles.partnerStatusText, { color: colors.textMuted }]}
            >
              Connected 🟢
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() =>
              openProfilePopup({
                name: partnerName,
                avatar: partnerAvatar,
                flag: partnerFlag,
                langName: getLangDetailsFromFlag(partnerFlag).name,
                country: getLangDetailsFromFlag(partnerFlag).country,
                uid: partnerId,
              })
            }
          >
            <View style={styles.headerAvatarContainer}>
              <Image
                source={{ uri: partnerAvatar }}
                style={styles.headerAvatar}
              />
              {isOnline && <View style={styles.onlineBadge} />}
            </View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <UserProfilePopup
        visible={profilePopupVisible}
        profile={profilePopupData}
        onClose={() => setProfilePopupVisible(false)}
        colors={colors}
        getLangDetails={getLangDetails}
        getLangDetailsFromFlag={getLangDetailsFromFlag}
      />

      {/* Dynamic toggle visibility view selection */}
      {!isKeyboardMode && !currentUser.prefShowTranscripts ? (
        /* Voice Call Overlay View */
        <View style={styles.voiceOverlay}>
          {/* Subtitles Box */}
          <View
            style={[
              styles.subtitlesContainer,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
            ]}
          >
            <Text
              style={[styles.subtitleLineReceived, { color: !isOnline ? colors.danger : colors.primary }]}
            >
              {!isOnline ? "The user is currently offline" : subtitleReceived}
            </Text>
            <Text
              style={[styles.subtitleLineUser, { color: colors.textDimmed }]}
            >
              {!isOnline ? "Voice calling is disabled" : subtitleUser}
            </Text>
          </View>

          {/* Centered Glowing Voice Mode Orb */}
          <View style={styles.orbWrapper}>
            <Animated.View
              style={[
                styles.orbGlowOuter,
                { backgroundColor: colors.primary },
                animatedGlow1,
              ]}
            />
            <Animated.View
              style={[
                styles.orbGlowMiddle,
                { backgroundColor: colors.accent },
                animatedGlow2,
              ]}
            />

            <TouchableOpacity
              activeOpacity={0.9}
              onPressIn={startRecording}
              onPressOut={stopRecording}
              style={{ borderRadius: 55 }}
            >
              <Animated.View
                style={[
                  styles.orbCenter,
                  { backgroundColor: colors.primary },
                  animatedOrbStyle,
                ]}
              >
                <LinearGradient
                  colors={[colors.primary, colors.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.orbCenterGradient}
                >
                  {/* Moving Internal Fluid Waves */}
                  <Animated.View
                    style={[styles.waveItem, styles.waveCyan, animatedWave1]}
                  />
                  <Animated.View
                    style={[styles.waveItem, styles.waveBlue, animatedWave2]}
                  />
                </LinearGradient>
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Text Chat Log Transcript View */
        <ScrollView
          ref={chatScrollViewRef}
          style={[styles.chatScrollView, { backgroundColor: colors.chatLogBg }]}
          contentContainerStyle={styles.chatScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.systemMsgContainer}>
            <Text
              style={[
                styles.systemMsgText,
                {
                  color: colors.textDimmed,
                  borderColor: colors.border,
                  backgroundColor: colors.cardBg,
                },
              ]}
            >
              {getLangDetails(currentUser.nativeLang)?.name || "English"} ⇄ {partnerId === "unity_ai" ? getLangDetails(currentUser.unityAILang)?.name || "AI" : getLangDetails(getLangCodeFromFlag(partnerFlag))?.name || "Spanish"} translation active
            </Text>
          </View>

          {chatBubbles.map(renderBubble)}
        </ScrollView>
      )}

      {/* Control Buttons Bar */}
      <SafeAreaView
        style={[
          styles.controlsSafeArea,
          {
            backgroundColor: colors.cardBg,
            borderTopColor: colors.border,
            borderTopWidth: 1,
          },
        ]}
        edges={["bottom", "left", "right"]}
      >
        <View style={styles.controlsBar}>
          {isKeyboardMode ? (
            /* Keyboard Mode Typing Input bar */
            <View style={styles.keyboardInputContainer}>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.bg,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="Type translated message..."
                placeholderTextColor={colors.textDimmed}
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={handleSendText}
              />
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: colors.primary }]}
                onPress={handleSendText}
                activeOpacity={0.8}
              >
                <Svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <Line x1="22" y1="2" x2="11" y2="13" />
                  <Polygon points="22 2 15 22 11 13 2 9 22 2" />
                </Svg>
              </TouchableOpacity>
            </View>
          ) : (
            /* Voice Controls (Mic status) */
            <View style={styles.voiceControlsContainer}>
              <TouchableOpacity
                style={[
                  styles.controlCircle,
                  !isOnline
                    ? { backgroundColor: colors.border }
                    : isRecording
                    ? { backgroundColor: colors.danger }
                    : {
                        backgroundColor: colors.primary,
                      },
                ]}
                onPressIn={isOnline ? startRecording : undefined}
                onPressOut={isOnline ? stopRecording : undefined}
                activeOpacity={0.7}
                disabled={!isOnline}
              >
                <Svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                </Svg>
              </TouchableOpacity>
              <Text
                style={[styles.micStatusLabel, { color: colors.textMuted }]}
              >
                {isOnline 
                  ? (isRecording ? "Recording..." : "Hold mic to speak")
                  : "The user is currently offline"
                }
              </Text>
            </View>
          )}

          {/* Keyboard Toggle Icon (toggles between mic and keyboard modes) */}
          <TouchableOpacity
            style={[
              styles.controlCircle,
              {
                backgroundColor: colors.cardBg,
                borderColor: colors.border,
                borderWidth: 1,
              },
            ]}
            onPress={() => setIsKeyboardMode(!isKeyboardMode)}
            activeOpacity={0.7}
          >
            {isKeyboardMode ? (
              /* SVG Mic Icon (to switch back to voice) */
              <Svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke={colors.textMuted}
                strokeWidth="2"
              >
                <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              </Svg>
            ) : (
              /* SVG Keyboard Icon (to switch to text) */
              <Svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke={colors.textMuted}
                strokeWidth="2"
              >
                <Rect x="3" y="4" width="18" height="12" rx="2" />
                <Path d="M7 8h10M7 12h10M10 16h4" />
              </Svg>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
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
    paddingVertical: 10,
  },
  backBtn: {
    padding: 6,
  },
  partnerInfo: {
    alignItems: "center",
  },
  partnerNameText: {
    fontSize: 16,
    fontWeight: "700",
  },
  partnerStatusText: {
    fontSize: 11,
    marginTop: 2,
  },
  headerAvatarContainer: {
    position: "relative",
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(0,0,0,0.05)",
  },
  onlineBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10B981",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  voiceOverlay: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: "space-between",
    alignItems: "center",
  },
  subtitlesContainer: {
    width: "100%",
    minHeight: 110,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 18,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    ...Platform.select({
      web: {
        boxShadow: "0px 1px 3px rgba(0,0,0,0.08)",
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 3,
      },
    }),
  },
  subtitleLineReceived: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 6,
  },
  subtitleLineUser: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  orbWrapper: {
    width: 200,
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: "auto",
  },
  orbGlowOuter: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    filter: Platform.OS === "ios" ? "blur(16px)" : undefined,
  },
  orbGlowMiddle: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    filter: Platform.OS === "ios" ? "blur(8px)" : undefined,
  },
  orbCenter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    overflow: "hidden",
    ...Platform.select({
      web: {
        boxShadow: "0px 10px 15px rgba(0,0,0,0.12)",
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 15,
      },
    }),
    elevation: 8,
  },
  orbCenterGradient: {
    flex: 1,
    borderRadius: 55,
    position: "relative",
  },
  waveItem: {
    position: "absolute",
    bottom: "-40%",
    left: "-50%",
    width: "200%",
    height: "200%",
    borderRadius: width * 0.38,
  },
  waveCyan: {
    backgroundColor: "rgba(6, 182, 212, 0.3)",
  },
  waveBlue: {
    backgroundColor: "rgba(37, 99, 235, 0.25)",
  },
  chatScrollView: {
    flex: 1,
  },
  chatScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 16,
  },
  systemMsgContainer: {
    alignSelf: "center",
    marginVertical: 4,
  },
  systemMsgText: {
    fontSize: 12,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: "hidden",
  },
  bubbleWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    maxWidth: "85%",
  },
  bubbleUserWrapper: {
    alignSelf: "flex-end",
    flexDirection: "row-reverse",
  },
  bubblePartnerWrapper: {
    alignSelf: "flex-start",
  },
  bubbleAvatarWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 8,
    overflow: "hidden",
  },
  flagImage: {
    width: "100%",
    height: "100%",
  },
  bubbleAvatarText: {
    fontSize: 14,
  },
  bubbleTextContainer: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...Platform.select({
      web: {
        boxShadow: "0px 1px 2px rgba(0,0,0,0.08)",
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
    }),
    elevation: 1,
  },
  bubbleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  bubbleSender: {
    fontSize: 12,
    fontWeight: "700",
  },
  bubbleMeta: {
    fontSize: 11,
    fontWeight: "500",
  },
  bubbleBody: {
    width: "100%",
  },
  bubbleTextOriginal: {
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleDivider: {
    height: 1,
    marginVertical: 6,
  },
  bubbleTextTrans: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  whiteText: {
    color: "#FFFFFF",
  },
  lightWhiteText: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  controlsSafeArea: {
    width: "100%",
  },
  controlsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  keyboardInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 18,
    fontSize: 14,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  voiceControlsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flex: 1,
  },
  controlCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  micStatusLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
});
