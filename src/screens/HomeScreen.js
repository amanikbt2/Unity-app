import React, { useState, useContext, useEffect, useRef } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Polygon, Line, Circle } from "react-native-svg";
import { AppContext } from "../context/AppContext";

const { width } = Dimensions.get("window");

export default function HomeScreen({ navigation }) {
  const { currentUser, updateSettings, getLangDetails } =
    useContext(AppContext);
  const [activeTab, setActiveTab] = useState("chats");
  const [onboardingVisible, setOnboardingVisible] = useState(true);
  const [groupsFilter, setGroupsFilter] = useState("my");

  // Gradient shifting animation value
  const gradientAnim = useRef(new Animated.Value(0)).current;

  // Start animated fluid progress bar loop
  useEffect(() => {
    Animated.loop(
      Animated.timing(gradientAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    ).start();
  }, []);

  // Compute onboarding metrics
  const isLanguagesCompleted =
    currentUser.secondaryLangs && currentUser.secondaryLangs.length > 0;
  const isVoiceCompleted = currentUser.micTested === true;
  const isProfileCompleted =
    currentUser.name &&
    currentUser.name !== "Amani User" &&
    currentUser.avatar &&
    !currentUser.avatar.includes("photo-1534528741775-53994a69daeb");

  let completedSteps = 0;
  if (currentUser.name && currentUser.name !== "Amani User") completedSteps++;
  if (
    currentUser.avatar &&
    !currentUser.avatar.includes("photo-1534528741775-53994a69daeb")
  )
    completedSteps++;
  if (currentUser.nativeLang) completedSteps++;
  if (currentUser.secondaryLangs && currentUser.secondaryLangs.length > 0)
    completedSteps++;
  if (currentUser.micTested) completedSteps++;
  if (currentUser.prefVad) completedSteps++;

  const onboardingPct = Math.min(
    100,
    Math.max(20, Math.round((completedSteps / 6) * 100)),
  );

  useEffect(() => {
    if (onboardingPct >= 100) {
      const timer = setTimeout(() => {
        setOnboardingVisible(false);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [onboardingPct]);

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
    navigation.navigate("Conversation", {
      partnerName: "Unity Translation AI",
      partnerAvatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80",
      partnerFlag: "🌍",
    });
  };

  const handlePartnerClick = (name, avatar, flag) => {
    navigation.navigate("Conversation", {
      partnerName: name,
      partnerAvatar: avatar,
      partnerFlag: flag,
    });
  };

  const handleOpenSettings = () => {
    navigation.navigate("Profile");
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
                : activeTab === "groups"
                  ? "Groups"
                  : "Calls"}
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              {activeTab === "chats"
                ? "You're ready to communicate instantly"
                : activeTab === "groups"
                  ? "Multi-language group conversations"
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
              <Text style={[styles.ctaTitle, { color: colors.text }]}>
                Start a Conversation
              </Text>
              <Text style={[styles.ctaSubtitle, { color: colors.textMuted }]}>
                Tap to translate voice in real-time
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
                    <Text style={styles.flagText}>🇪🇸</Text>
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
                    <Text style={styles.flagText}>🇯🇵</Text>
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
                    <Text style={styles.flagText}>🇰🇪</Text>
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

        {activeTab === "groups" && (
          <View>
            <View style={styles.filterContainer}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  groupsFilter === "my"
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
                onPress={() => setGroupsFilter("my")}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    groupsFilter === "my"
                      ? { color: colors.primary, fontWeight: "600" }
                      : { color: colors.textMuted },
                  ]}
                >
                  My Groups
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterChip,
                  groupsFilter === "global"
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
                onPress={() => setGroupsFilter("global")}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    groupsFilter === "global"
                      ? { color: colors.primary, fontWeight: "600" }
                      : { color: colors.textMuted },
                  ]}
                >
                  Global
                </Text>
              </TouchableOpacity>
            </View>

            <Text
              style={[
                styles.sectionTitle,
                { color: colors.textDimmed, marginTop: 12 },
              ]}
            >
              Active Groups
            </Text>

            <View
              style={[
                styles.convList,
                { backgroundColor: colors.cardBg, borderColor: colors.border },
              ]}
            >
              {groupsFilter === "global" && (
                <TouchableOpacity
                  style={[styles.convCard, { borderBottomWidth: 0 }]}
                  activeOpacity={0.7}
                  onPress={handleStartConv}
                >
                  <View
                    style={[
                      styles.groupAvatar,
                      { backgroundColor: colors.primaryGlow },
                    ]}
                  >
                    <Text
                      style={[
                        styles.groupAvatarText,
                        { color: colors.primary },
                      ]}
                    >
                      GL
                    </Text>
                    <View
                      style={[
                        styles.flagBadgeMulti,
                        { backgroundColor: colors.bg },
                      ]}
                    >
                      <Text style={styles.flagTextMulti}>🌍</Text>
                    </View>
                  </View>
                  <View style={styles.convDetails}>
                    <View style={styles.convHeader}>
                      <Text
                        style={[styles.partnerName, { color: colors.text }]}
                      >
                        Global Chat Lounge
                      </Text>
                      <Text
                        style={[styles.convTime, { color: colors.textDimmed }]}
                      >
                        Just now
                      </Text>
                    </View>
                    <Text
                      style={[styles.convPreview, { color: colors.textMuted }]}
                      numberOfLines={1}
                    >
                      <Text style={styles.boldPreviewText}>Sophia: </Text>Hey
                      everyone, welcome!
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              {groupsFilter === "my" && (
                <View>
                  <TouchableOpacity
                    style={[
                      styles.convCard,
                      { borderBottomColor: colors.border },
                    ]}
                    activeOpacity={0.7}
                    onPress={handleStartConv}
                  >
                    <View
                      style={[
                        styles.groupAvatar,
                        { backgroundColor: colors.primaryGlow },
                      ]}
                    >
                      <Text
                        style={[
                          styles.groupAvatarText,
                          { color: colors.primary },
                        ]}
                      >
                        ES
                      </Text>
                      <View
                        style={[
                          styles.flagBadgeMulti,
                          { backgroundColor: colors.bg },
                        ]}
                      >
                        <Text style={styles.flagTextMulti}>🇪🇸🇬🇧</Text>
                      </View>
                    </View>
                    <View style={styles.convDetails}>
                      <View style={styles.convHeader}>
                        <Text
                          style={[styles.partnerName, { color: colors.text }]}
                        >
                          Euro Summit Prep
                        </Text>
                        <Text
                          style={[
                            styles.convTime,
                            { color: colors.textDimmed },
                          ]}
                        >
                          3h ago
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.convPreview,
                          { color: colors.textMuted },
                        ]}
                        numberOfLines={1}
                      >
                        <Text style={styles.boldPreviewText}>Mateo: </Text>El
                        documento está listo.
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.convCard, { borderBottomWidth: 0 }]}
                    activeOpacity={0.7}
                    onPress={handleStartConv}
                  >
                    <View
                      style={[
                        styles.groupAvatar,
                        { backgroundColor: colors.primaryGlow },
                      ]}
                    >
                      <Text
                        style={[
                          styles.groupAvatarText,
                          { color: colors.primary },
                        ]}
                      >
                        FT
                      </Text>
                      <View
                        style={[
                          styles.flagBadgeMulti,
                          { backgroundColor: colors.bg },
                        ]}
                      >
                        <Text style={styles.flagTextMulti}>🤝</Text>
                      </View>
                    </View>
                    <View style={styles.convDetails}>
                      <View style={styles.convHeader}>
                        <Text
                          style={[styles.partnerName, { color: colors.text }]}
                        >
                          Family Trip 2026
                        </Text>
                        <Text
                          style={[
                            styles.convTime,
                            { color: colors.textDimmed },
                          ]}
                        >
                          2 days ago
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.convPreview,
                          { color: colors.textMuted },
                        ]}
                        numberOfLines={1}
                      >
                        <Text style={styles.boldPreviewText}>Mom: </Text>We
                        should book the tour.
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}

        {activeTab === "calls" && (
          <View>
            <View
              style={[
                styles.groupCtaCard,
                { backgroundColor: colors.cardBg, borderColor: colors.border },
              ]}
            >
              <View
                style={[
                  styles.groupCtaIcon,
                  { backgroundColor: "rgba(2, 132, 199, 0.1)" },
                ]}
              >
                <Svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={colors.accent}
                  strokeWidth="2.5"
                >
                  <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </Svg>
              </View>
              <View style={styles.groupCtaInfo}>
                <Text style={[styles.groupCtaTitle, { color: colors.text }]}>
                  Start Voice Call
                </Text>
                <Text
                  style={[styles.groupCtaDesc, { color: colors.textMuted }]}
                >
                  Call any contact with live translation
                </Text>
              </View>
            </View>

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
        <View style={styles.onboardingOverlay} pointerEvents="box-none">
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
            <View style={styles.promptOptions}>
              <TouchableOpacity
                style={[
                  styles.optionPill,
                  isLanguagesCompleted
                    ? styles.pillCompleted
                    : {
                        backgroundColor: colors.bg,
                        borderColor: colors.border,
                      },
                ]}
                disabled={isLanguagesCompleted}
                onPress={handleOpenSettings}
              >
                <Text
                  style={[
                    styles.pillLabel,
                    isLanguagesCompleted
                      ? styles.pillLabelCompleted
                      : { color: colors.textMuted },
                  ]}
                >
                  {isLanguagesCompleted ? "✓ Languages Added" : "Add languages"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.optionPill,
                  isVoiceCompleted
                    ? styles.pillCompleted
                    : {
                        backgroundColor: colors.bg,
                        borderColor: colors.border,
                      },
                ]}
                disabled={isVoiceCompleted}
                onPress={handleOpenSettings}
              >
                <Text
                  style={[
                    styles.pillLabel,
                    isVoiceCompleted
                      ? styles.pillLabelCompleted
                      : { color: colors.textMuted },
                  ]}
                >
                  {isVoiceCompleted
                    ? "✓ Voice Setup Completed"
                    : "Set up voice"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.optionPill,
                  isProfileCompleted
                    ? styles.pillCompleted
                    : styles.highlightPill,
                ]}
                disabled={isProfileCompleted}
                onPress={handleOpenSettings}
              >
                <Text
                  style={[
                    styles.pillLabel,
                    isProfileCompleted
                      ? styles.pillLabelCompleted
                      : styles.highlightLabel,
                  ]}
                >
                  {isProfileCompleted
                    ? "✓ Profile Completed"
                    : "Complete profile"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Floating Action Button (Teal Gradient Floating Plus) for Groups Tab */}
      {activeTab === "groups" && (
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
          onPress={() => setActiveTab("groups")}
        >
          <View
            style={[
              styles.tabIconBg,
              activeTab === "groups" && { backgroundColor: colors.primaryGlow },
            ]}
          >
            <Svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke={
                activeTab === "groups" ? colors.primary : colors.textDimmed
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
                  activeTab === "groups" ? colors.primary : colors.textDimmed,
                fontWeight: activeTab === "groups" ? "600" : "500",
              },
            ]}
          >
            Groups
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
      </View>
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
    width: 170,
    height: 170,
    borderRadius: 85,
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
    marginBottom: 20,
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
  },
  flagText: {
    fontSize: 13,
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
    borderRadius: 6,
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
    gap: 8,
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
    gap: 8,
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
});
