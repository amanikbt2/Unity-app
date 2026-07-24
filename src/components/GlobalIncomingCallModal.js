/* eslint-disable react-hooks/refs, react-hooks/immutability */
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
  Platform,
} from "react-native";
import { useAudioPlayer } from "expo-audio";
import { AppContext } from "../context/AppContext";
import { navigate } from "../utils/navigationRef";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";

const DEFAULT_AVATAR =
  "https://ui-avatars.com/api/?background=8B5CF6&color=fff&size=128&name=User";

/**
 * GlobalIncomingCallModal
 *
 * Polls the backend every 3 seconds for an incoming call directed at the
 * logged-in user.  When one is found it shows a full-screen overlay with
 * Accept / Decline buttons — no matter which screen the user is currently
 * viewing.
 *
 * On Accept  → navigates to ConversationScreen with answeredCallId param so
 *              the screen auto-connects without showing the ring modal again.
 * On Decline → calls /api/calls/reject and dismisses the overlay.
 */
export default function GlobalIncomingCallModal() {
  const { currentUser } = useContext(AppContext);
  const [incomingCall, setIncomingCall] = useState(null);
  const [visible, setVisible] = useState(false);

  // Pulse animation for the avatar ring
  const pulse = useMemo(() => new Animated.Value(1), []);
  const pulseAnim = useRef(null);

  // Ringtone player
  const ringtonePlayer = useAudioPlayer(require("../../assets/ringtone.mp3"));

  // ── Polling ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.uid) return;

    const poll = setInterval(async () => {
      // If a call is already showing, don't poll again until it's dismissed
      if (incomingCall) return;

      try {
        const res = await fetch(
          `${API_URL}/api/calls/poll-active/${encodeURIComponent(
            currentUser.uid,
          )}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.incomingCall) {
          setIncomingCall(data.incomingCall);
          setVisible(true);
        }
      } catch (_) {
        // Silently ignore network errors
      }
    }, 3000);

    return () => clearInterval(poll);
  }, [currentUser?.uid, incomingCall]);

  // ── Ringtone & pulse animation ───────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      // Play looping ringtone
      try {
        if (ringtonePlayer) {
          ringtonePlayer.loop = true;
          const p = ringtonePlayer.play();
          if (p && typeof p.catch === "function") {
            p.catch(() => {});
          }
        }
      } catch (_) {}

      // Start pulse animation
      pulseAnim.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.18,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseAnim.current.start();
    } else {
      // Stop ringtone
      try {
        if (ringtonePlayer) {
          ringtonePlayer.pause();
          ringtonePlayer.seekTo(0);
        }
      } catch (_) {}

      // Stop animation
      if (pulseAnim.current) {
        pulseAnim.current.stop();
      }
      pulse.setValue(1);
    }
  }, [visible]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const stopAndDismiss = () => {
    setIncomingCall(null);
    setVisible(false);
  };

  const handleAccept = async () => {
    if (!incomingCall) return;
    const callId = incomingCall.id;
    const callerId = incomingCall.callerId;
    const callerName = incomingCall.callerName || "User";
    const callerAvatar = incomingCall.callerAvatar || DEFAULT_AVATAR;

    stopAndDismiss();

    // Tell backend we accepted
    try {
      await fetch(`${API_URL}/api/calls/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId }),
      });
    } catch (_) {}

    // Navigate to ConversationScreen — pass answeredCallId so it auto-connects
    navigate("Conversation", {
      partnerId: callerId,
      partnerName: callerName,
      partnerAvatar: callerAvatar,
      partnerFlag: incomingCall.callerFlag || "🌍",
      answeredCallId: callId, // ConversationScreen will auto-connect on mount
    });
  };

  const handleDecline = async () => {
    if (!incomingCall) return;
    const callId = incomingCall.id;
    stopAndDismiss();

    try {
      await fetch(`${API_URL}/api/calls/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId }),
      });
    } catch (_) {}
  };

  if (!currentUser?.uid) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleDecline}
    >
      <View style={styles.overlay}>
        {/* Blurred / tinted background */}
        <View style={styles.backdrop} />

        <View style={styles.card}>
          {/* Top label */}
          <Text style={styles.incomingLabel}>Incoming Call</Text>

          {/* Caller name */}
          <Text style={styles.callerName}>
            {incomingCall?.callerName || "Unknown"}
          </Text>
          <Text style={styles.callerSub}>is calling you…</Text>

          {/* Pulsing avatar ring */}
          <Animated.View
            style={[styles.avatarRing, { transform: [{ scale: pulse }] }]}
          >
            <Image
              source={{
                uri: incomingCall?.callerAvatar || DEFAULT_AVATAR,
              }}
              style={styles.avatar}
            />
          </Animated.View>

          {/* Action buttons */}
          <View style={styles.buttonsRow}>
            {/* Decline */}
            <TouchableOpacity
              style={[styles.btn, styles.declineBtn]}
              onPress={handleDecline}
              activeOpacity={0.85}
            >
              <Text style={styles.btnIcon}>✕</Text>
              <Text style={styles.btnLabel}>Decline</Text>
            </TouchableOpacity>

            {/* Accept */}
            <TouchableOpacity
              style={[styles.btn, styles.acceptBtn]}
              onPress={handleAccept}
              activeOpacity={0.85}
            >
              <Text style={styles.btnIcon}>📞</Text>
              <Text style={styles.btnLabel}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 6, 23, 0.88)",
  },
  card: {
    width: 320,
    borderRadius: 28,
    backgroundColor: "#1E1B4B",
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 28,
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 28,
    elevation: 24,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.35)",
  },
  incomingLabel: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 2,
    color: "#A78BFA",
    textTransform: "uppercase",
    marginBottom: 10,
  },
  callerName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 4,
  },
  callerSub: {
    fontSize: 14,
    color: "#94A3B8",
    marginBottom: 32,
  },
  avatarRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: "#8B5CF6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  buttonsRow: {
    flexDirection: "row",
    gap: 24,
  },
  btn: {
    width: 104,
    paddingVertical: 14,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  declineBtn: {
    backgroundColor: "#EF4444",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  acceptBtn: {
    backgroundColor: "#22C55E",
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  btnIcon: {
    fontSize: 22,
  },
  btnLabel: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
});
