import React, { useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
} from "react-native";

const { width } = Dimensions.get("window");

const DEFAULT_PROFILE = {
  name: "Unknown User",
  avatar: "",
  country: "",
  language: "Unknown",
  uid: "UID-UNKNOWN",
};

const getProfileUtid = (profile) => {
  if (!profile) return "wH5I7";
  if (profile.utid && typeof profile.utid === "string" && !profile.utid.includes("@")) {
    return profile.utid;
  }
  const rawId = profile.uid || profile.id || profile.email || "";
  if (!rawId || rawId.includes("@") || rawId.startsWith("UID-") || rawId.startsWith("UID_") || rawId === "UID-UNKNOWN") {
    const fallbackStr = profile.email || profile.name || "User";
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let hash = 0;
    for (let i = 0; i < fallbackStr.length; i++) {
      hash = (hash << 5) - hash + fallbackStr.charCodeAt(i);
      hash |= 0;
    }
    let utid = "";
    for (let i = 0; i < 5; i++) {
      const idx = Math.abs((hash * (i + 1) * 31) % chars.length);
      utid += chars.charAt(idx);
    }
    return utid;
  }
  return rawId.replace(/^UID-/i, "");
};

const getJoinedDate = (profile) => {
  if (profile && profile.dateJoined) return profile.dateJoined;
  const fallbackStr = (profile && (profile.email || profile.name)) || "User";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let hash = 0;
  for (let i = 0; i < fallbackStr.length; i++) {
    hash = (hash << 5) - hash + fallbackStr.charCodeAt(i);
    hash |= 0;
  }
  const monthIdx = Math.abs(hash % 12);
  const year = 2025 - Math.abs(hash % 2);
  return `${months[monthIdx]} ${year}`;
};

const getCountryLabel = (profile, getLangDetails, getLangDetailsFromFlag) => {
  if (!profile) return "";
  if (profile.country) return profile.country;
  if (profile.flag && getLangDetailsFromFlag) {
    return getLangDetailsFromFlag(profile.flag)?.country || "";
  }
  if (profile.nativeLang && getLangDetails) {
    return getLangDetails(profile.nativeLang)?.country || "";
  }
  return "";
};

const getLanguageLabel = (profile, getLangDetails) => {
  if (!profile) return DEFAULT_PROFILE.language;
  if (profile.langName) return profile.langName;
  if (profile.nativeLang && getLangDetails) {
    return getLangDetails(profile.nativeLang)?.name || DEFAULT_PROFILE.language;
  }
  if (profile.flag && getLangDetails) {
    return getLangDetails(profile.flag)?.name || DEFAULT_PROFILE.language;
  }
  return DEFAULT_PROFILE.language;
};

export default function UserProfilePopup({
  visible,
  profile,
  onClose,
  colors,
  getLangDetails,
  getLangDetailsFromFlag,
}) {
  const [showFullImage, setShowFullImage] = useState(false);

  const resolvedProfile = useMemo(() => {
    const base = profile || DEFAULT_PROFILE;
    return {
      ...DEFAULT_PROFILE,
      ...base,
      utid: getProfileUtid(base),
      dateJoined: getJoinedDate(base),
      country: getCountryLabel(base, getLangDetails, getLangDetailsFromFlag),
      language: getLanguageLabel(base, getLangDetails),
    };
  }, [profile, getLangDetails, getLangDetailsFromFlag]);

  const avatarUri =
    resolvedProfile.avatar ||
    resolvedProfile.avatar_local_path ||
    resolvedProfile.image ||
    "";

  const closeAll = () => {
    setShowFullImage(false);
    onClose?.();
  };

  return (
    <>
      <Modal
        animationType="fade"
        transparent
        visible={visible}
        onRequestClose={closeAll}
      >
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.cardBg }]}>
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: colors.text }]}>
                Profile
              </Text>
              <TouchableOpacity onPress={closeAll} style={styles.closeBtn}>
                <Text style={[styles.closeText, { color: colors.textMuted }]}>
                  &times;
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setShowFullImage(true)}
              style={styles.heroWrap}
            >
              <Image source={typeof avatarUri === "number" ? avatarUri : { uri: avatarUri }} style={styles.heroAvatar} />
              {profile?.status &&
                /online|available|ready to chat|connected|active/.test(
                  profile.status.trim().toLowerCase(),
                ) && (
                  <View
                    style={[styles.onlineBadge, { borderColor: colors.cardBg }]}
                  />
                )}
              <View
                style={[
                  styles.heroBadge,
                  {
                    backgroundColor: colors.primary,
                    borderColor: colors.cardBg,
                  },
                ]}
              >
                <Text style={styles.heroBadgeText}>Show in full</Text>
              </View>
            </TouchableOpacity>

            <Text style={[styles.name, { color: colors.text }]}>
              {resolvedProfile.name}
            </Text>

            <View style={styles.infoGrid}>
              <View
                style={[
                  styles.infoCard,
                  { backgroundColor: colors.bg, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.infoLabel, { color: colors.textDimmed }]}>
                  Country
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {resolvedProfile.country || "Unknown"}
                </Text>
              </View>

              <View
                style={[
                  styles.infoCard,
                  { backgroundColor: colors.bg, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.infoLabel, { color: colors.textDimmed }]}>
                  Language
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {resolvedProfile.language}
                </Text>
              </View>

              <View
                style={[
                  styles.infoCard,
                  { backgroundColor: colors.bg, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.infoLabel, { color: colors.textDimmed }]}>
                  UTID
                </Text>
                <Text
                  style={[styles.infoValue, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {resolvedProfile.utid}
                </Text>
              </View>

              <View
                style={[
                  styles.infoCard,
                  { backgroundColor: colors.bg, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.infoLabel, { color: colors.textDimmed }]}>
                  Date Joined
                </Text>
                <Text
                  style={[styles.infoValue, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {resolvedProfile.dateJoined}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={showFullImage}
        onRequestClose={() => setShowFullImage(false)}
      >
        <View style={styles.fullBackdrop}>
          <TouchableOpacity
            style={styles.fullCloseBtn}
            onPress={() => setShowFullImage(false)}
          >
            <Text style={styles.fullCloseText}>&times;</Text>
          </TouchableOpacity>
          <Image source={typeof avatarUri === "number" ? avatarUri : { uri: avatarUri }} style={styles.fullImage} />
          <Text style={styles.fullName}>{resolvedProfile.name}</Text>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.58)",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  sheet: {
    borderRadius: 28,
    padding: 18,
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  closeText: {
    fontSize: 28,
    lineHeight: 28,
  },
  heroWrap: {
    alignItems: "center",
    marginBottom: 16,
  },
  heroAvatar: {
    width: width * 0.42,
    height: width * 0.42,
    maxWidth: 168,
    maxHeight: 168,
    minWidth: 120,
    minHeight: 120,
    borderRadius: 999,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.85)",
  },
  onlineBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#10B981", // Emerald 500
    borderWidth: 3,
  },
  heroBadge: {
    marginTop: -18,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 2,
  },
  heroBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  name: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 14,
  },
  infoGrid: {
    gap: 10,
  },
  infoCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: "700",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  fullBackdrop: {
    flex: 1,
    backgroundColor: "#020617",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  fullCloseBtn: {
    position: "absolute",
    top: 50,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  fullCloseText: {
    color: "#FFFFFF",
    fontSize: 30,
    lineHeight: 30,
  },
  fullImage: {
    width: "100%",
    maxWidth: 360,
    aspectRatio: 1,
    borderRadius: 28,
  },
  fullName: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 18,
  },
});
