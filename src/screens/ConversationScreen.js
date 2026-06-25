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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Line, Rect } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { AppContext } from "../context/AppContext";

const { width } = Dimensions.get("window");

export default function ConversationScreen({ route, navigation }) {
  const { partnerName, partnerAvatar, partnerFlag } = route.params || {
    partnerName: "Unity Translation AI",
    partnerAvatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80",
    partnerFlag: "🌍",
  };

  const { currentUser, getLangDetails, getLangDetailsFromFlag } =
    useContext(AppContext);

  const [isKeyboardMode, setIsKeyboardMode] = useState(false);
  const [isMicActive, setIsMicActive] = useState(true);
  const [inputText, setInputText] = useState("");
  const [chatBubbles, setChatBubbles] = useState([]);

  const [subtitleReceived, setSubtitleReceived] = useState(
    "Waiting for speech...",
  );
  const [subtitleUser, setSubtitleUser] = useState("Tap mic to start talking");

  const chatScrollViewRef = useRef();

  // Shared Animation Values for the Orb
  const orbScale = useSharedValue(1);
  const glow1Opacity = useSharedValue(0.1);
  const glow2Opacity = useSharedValue(0.2);
  const waveRotate1 = useSharedValue(0);
  const waveRotate2 = useSharedValue(0);

  // Set up breathing & fluid animations for the center orb
  useEffect(() => {
    // Breathing scale animation
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

    // Glowing loops
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

  // Simulated conversations script
  useEffect(() => {
    setChatBubbles([
      {
        id: "initial",
        sender: "partner",
        avatar: partnerFlag,
        text: "Hola, ¡bienvenido! La traducción en tiempo real ya está funcionando.",
        origLang: "Spanish (Original)",
        transText:
          "Hello, welcome! The real-time translation is already working.",
        transLang: "English (Translated)",
      },
    ]);

    const timeline = [
      {
        id: "sim-1",
        sender: "user",
        avatar: "🇺🇸",
        text: "That is incredible. The connection took less than a second.",
        origLang: "English (Original)",
        transText: "Eso es increíble. La conexión tardó menos de un segundo.",
        transLang: "Spanish (Translated)",
      },
      {
        id: "sim-2",
        sender: "partner",
        avatar: partnerFlag,
        text: "¡Exacto! El objetivo es comunicarse de inmediato sin barreras de idioma.",
        origLang: "Spanish (Original)",
        transText:
          "Exactly! The goal is to communicate immediately without language barriers.",
        transLang: "English (Translated)",
      },
    ];

    const timers = timeline.map((msg, index) => {
      return setTimeout(
        () => {
          // Update subtitles overlays
          if (msg.sender === "partner") {
            setSubtitleReceived(msg.transText);
          } else {
            setSubtitleUser(msg.text);
          }
          setChatBubbles((prev) => [...prev, msg]);
        },
        (index + 1) * 3500,
      );
    });

    return () => timers.forEach(clearTimeout);
  }, [partnerFlag]);

  // Scroll to bottom helper
  useEffect(() => {
    if (chatScrollViewRef.current) {
      setTimeout(
        () => chatScrollViewRef.current.scrollToEnd({ animated: true }),
        100,
      );
    }
  }, [chatBubbles, isKeyboardMode]);

  const toggleMic = () => {
    setIsMicActive(!isMicActive);
    if (isMicActive) {
      setSubtitleUser("Muted");
    } else {
      setSubtitleUser("Tap mic to start talking");
    }
  };

  const handleSendText = () => {
    if (!inputText.trim()) return;

    const text = inputText.trim();
    setInputText("");
    setSubtitleUser(text);
    setSubtitleReceived("Translating...");

    const userMsg = {
      id: Date.now().toString(),
      sender: "user",
      avatar: "🇺🇸",
      text: text,
      origLang: "English (Original)",
      transText: "...",
      transLang: "Spanish (Translated)",
    };

    setChatBubbles((prev) => [...prev, userMsg]);

    // Simulate translation reply
    setTimeout(() => {
      setSubtitleReceived(
        "Understood. Message received and translated correctly.",
      );

      const partnerReply = {
        id: (Date.now() + 1).toString(),
        sender: "partner",
        avatar: partnerFlag,
        text: "Entendido. Mensaje recibido y traducido correctamente.",
        origLang: "Spanish (Original)",
        transText: "Understood. Message received and translated correctly.",
        transLang: "English (Translated)",
      };

      setChatBubbles((prev) => [...prev, partnerReply]);
    }, 1200);
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
        <View
          style={[
            styles.bubbleAvatarWrapper,
            { backgroundColor: colors.border },
          ]}
        >
          <Text style={styles.bubbleAvatarText}>{flagEmoji}</Text>
        </View>

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
            <Text
              style={[
                styles.bubbleTextTrans,
                isUser ? { color: "#93C5FD" } : { color: colors.primary },
              ]}
            >
              {bubble.transText}
            </Text>
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

          <Image source={{ uri: partnerAvatar }} style={styles.headerAvatar} />
        </View>
      </SafeAreaView>

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
              style={[styles.subtitleLineReceived, { color: colors.primary }]}
            >
              {subtitleReceived}
            </Text>
            <Text
              style={[styles.subtitleLineUser, { color: colors.textDimmed }]}
            >
              {subtitleUser}
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
              English ⇄ Spanish translation active
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
                  isMicActive
                    ? { backgroundColor: colors.danger }
                    : {
                        backgroundColor: colors.cardBg,
                        borderColor: colors.border,
                        borderWidth: 1,
                      },
                ]}
                onPress={toggleMic}
                activeOpacity={0.7}
              >
                <Svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={isMicActive ? "white" : colors.textMuted}
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
                {isMicActive ? "Listening..." : "Muted"}
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
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(0,0,0,0.05)",
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
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
  },
  bubbleAvatarText: {
    fontSize: 14,
  },
  bubbleTextContainer: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
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
