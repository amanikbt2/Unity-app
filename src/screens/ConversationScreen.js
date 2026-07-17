/* eslint-disable react-hooks/immutability */
import React, {
  useState,
  useEffect,
  useRef,
  useContext,
  useCallback,
} from "react";
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
  Alert,
  AppState,
  Keyboard,
  Modal,
} from "react-native";
import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Line, Rect, Polygon } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
import {
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
} from "expo-audio";
import * as Speech from "expo-speech";
import * as FileSystem from "expo-file-system/legacy";
import { trackEvent } from "../utils/Analytics";
import {
  translateText,
  translateVoice,
  chatWithAI,
} from "../services/TranslationService";
import { AppContext } from "../context/AppContext";
import * as Notifications from "expo-notifications";
import { scheduleLocalNotification, setActiveChatPartnerId } from "../services/NotificationService";
import UserProfilePopup from "../components/UserProfilePopup";
import {
  saveChat,
  getChats,
  clearContactUnread,
  updateContactLastMessageTime,
  saveContacts,
} from "../services/DatabaseService";
import { messageQueue } from "../services/MessageQueue";

const { width } = Dimensions.get("window");

const DEFAULT_AVATAR_REQ = require("../../assets/default-avatar-2.jpg");

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
  isMeteringEnabled: true,
  android: {
    extension: ".m4a",
    outputFormat: "mpeg4",
    audioEncoder: "aac",
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
    isMeteringEnabled: true,
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
    isMeteringEnabled: true,
  },
  web: {
    mimeType: "audio/webm",
    bitsPerSecond: 128000,
  },
};

const Dot = ({ anim, color }) => (
  <RNAnimated.View
    style={{
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: color || "#9CA3AF",
      marginHorizontal: 3,
      transform: [{ translateY: anim }],
    }}
  />
);

const TypingIndicator = ({ color }) => {
  const [dot1] = useState(() => new RNAnimated.Value(0));
  const [dot2] = useState(() => new RNAnimated.Value(0));
  const [dot3] = useState(() => new RNAnimated.Value(0));

  useEffect(() => {
    const animateDot = (dot) => {
      return RNAnimated.sequence([
        RNAnimated.timing(dot, {
          toValue: -5,
          duration: 250,
          useNativeDriver: true,
        }),
        RNAnimated.timing(dot, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]);
    };

    const animation = RNAnimated.loop(
      RNAnimated.stagger(150, [
        animateDot(dot1),
        animateDot(dot2),
        animateDot(dot3),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [dot1, dot2, dot3]);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        paddingVertical: 12,
      }}
    >
      <Dot anim={dot1} color={color} />
      <Dot anim={dot2} color={color} />
      <Dot anim={dot3} color={color} />
    </View>
  );
};

const getCurrentTimestamp = () => Date.now();

export default function ConversationScreen({ route, navigation }) {
  const getAssetUri = (asset) =>
    Image.resolveAssetSource ? Image.resolveAssetSource(asset).uri : asset;

  const DEFAULT_AVATAR = getAssetUri(DEFAULT_AVATAR_REQ);

  const { partnerName, partnerAvatar, partnerFlag, partnerId, partnerStatus } =
    route.params || {
      partnerName: "unity Translation AI",
      partnerAvatar:
        DEFAULT_AVATAR,
      partnerFlag: "🌍",
      partnerId: "unity Translation AI",
    };

  const { currentUser, getLangDetails, getLangDetailsFromFlag, LANGS } =
    useContext(AppContext);
  const insets = useSafeAreaInsets();

  const isSelfChat =
    partnerId === currentUser?.uid ||
    partnerId === currentUser?.id ||
    partnerId === "Me" ||
    partnerName === currentUser?.name;

  const isOnline =
    isSelfChat || partnerId === "unity_ai"
      ? true
      : partnerStatus
        ? /online|available|ready to chat|connected|active/.test(
            partnerStatus.trim().toLowerCase(),
          )
        : false;

  const [isKeyboardMode, setIsKeyboardMode] = useState(isSelfChat ? true : false);
  const [inputText, setInputText] = useState("");
  const [chatBubbles, setChatBubbles] = useState([]);

  const [subtitleReceived, setSubtitleReceived] = useState(
    "Waiting for speech...",
  );
  const [subtitleUser, setSubtitleUser] = useState("Tap mic to start talking");
  const [profilePopupVisible, setProfilePopupVisible] = useState(false);
  const [profilePopupData, setProfilePopupData] = useState(null);
  const [isConnected, setIsConnected] = useState(true);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // WebRTC-like Calling States
  const [micMenuVisible, setMicMenuVisible] = useState(false);
  const [isRealTimeCall, setIsRealTimeCall] = useState(false);
  const [callStatus, setCallStatus] = useState("disconnected"); // 'connecting' | 'ringing' | 'connected' | 'ended'
  const [callDuration, setCallDuration] = useState(0);
  const [callMuted, setCallMuted] = useState(false);
  const [callSpeakerActive, setCallSpeakerActive] = useState(false);
  const [activeCallId, setActiveCallId] = useState(null);
  const [incomingCallData, setIncomingCallData] = useState(null);

  const [isRecording, setIsRecording] = useState(false);
  const [handsFreeActive, setHandsFreeActive] = useState(false);
  const handsFreeActiveRef = useRef(false);
  const isSpeakingRef = useRef(false);

  // Calling Refs
  const callDurationTimerRef = useRef(null);
  const callStatusPollIntervalRef = useRef(null);
  const callAudioPollIntervalRef = useRef(null);
  const lastAudioTimestampRef = useRef(0);
  const callAudioRecorderRef = useRef(null);
  const ringtonePlayerRef = useRef(null);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? true);
    });
    return () => unsubscribe();
  }, []);

  // Shared Animation Values for the Orb
  const orbScale = useSharedValue(1);
  const glow1Opacity = useSharedValue(0.1);
  const glow2Opacity = useSharedValue(0.2);
  const waveRotate1 = useSharedValue(0);
  const waveRotate2 = useSharedValue(0);

  const onRecordingStatusUpdate = useCallback(
    (status) => {
      if (status.metering !== undefined) {
        const db = status.metering;

        // Smart dynamic calibration
        // Update noise floor
        if (db < noiseFloorRef.current) {
          noiseFloorRef.current = db; // Snap instantly to new quietest sound
        } else {
          noiseFloorRef.current += 0.01; // Drift up slower (0.1 dB/sec) to keep threshold sensitive
        }

        // Clamp noise floor to prevent loud environments from deafening the VAD
        if (noiseFloorRef.current > -55) {
          noiseFloorRef.current = -55;
        }

        // Update speech peak
        if (db > speechPeakRef.current) {
          speechPeakRef.current = db; // Snap instantly to new loudest sound
        } else {
          speechPeakRef.current -= 0.8; // Recover 8x faster from loud spikes/blows (8 dB/sec)
        }

        // Enforce a minimum dynamic range so thresholding doesn't break in absolute silence
        if (speechPeakRef.current - noiseFloorRef.current < 15) {
          speechPeakRef.current = noiseFloorRef.current + 15;
        }

        const currentNoiseFloor = noiseFloorRef.current;
        const currentPeak = speechPeakRef.current;
        const range = currentPeak - currentNoiseFloor;

        // Map db to 0-1 range dynamically
        let normalized = Math.max(0, (db - currentNoiseFloor) / range);
        normalized = Math.pow(normalized, 2.5); // Apply exponential curve for punchiness

        orbScale.value = withTiming(1.0 + normalized * 0.45, { duration: 100 });
        glow1Opacity.value = withTiming(0.1 + normalized * 0.5, {
          duration: 100,
        });
        glow2Opacity.value = withTiming(0.2 + normalized * 0.6, {
          duration: 100,
        });

        if (handsFreeActiveRef.current) {
          // Dynamic speech threshold is 22% above the noise floor for higher sensitivity
          const dynamicThreshold = currentNoiseFloor + range * 0.22;

          if (db > dynamicThreshold) {
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
            if (!isSpeakingRef.current) {
              isSpeakingRef.current = true;
              setSubtitleUser("Speaking...");
              Speech.stop();
            }
          } else {
            if (isSpeakingRef.current) {
              setSubtitleUser("Silent... waiting");
              if (!silenceTimerRef.current) {
                silenceTimerRef.current = setTimeout(async () => {
                  isSpeakingRef.current = false;
                  silenceTimerRef.current = null;
                  await processSmartRecording();
                }, 2500);
              }
            }
          }
        }
      }
    },
    [
      glow1Opacity,
      glow2Opacity,
      orbScale,
      setSubtitleUser,
      processSmartRecording,
    ],
  );

  async function processSmartRecording() {
    setSubtitleUser("Processing voice...");
    setSubtitleReceived(`Waiting for ${partnerName}...`);

    let uri = null;
    try {
      await recorder.stop();
      uri = recorder.uri;
    } catch (err) {
      console.error("Error stopping recorder:", err);
    }

    // Immediately restart listening so the user isn't blocked
    if (handsFreeActive) {
      try {
        await recorder.prepareToRecordAsync(COMPRESSED_AUDIO_OPTIONS);
        await recorder.record();
        setSubtitleUser("Listening...");
      } catch (e) {
        console.error("Restart recording failed", e);
      }
    }

    // Process the voice chunk in the background
    if (uri) {
      handleVoiceMessage(uri).catch(console.error);
    }
  };

  // Load ringtone audio player
  const ringtonePlayer = useAudioPlayer(require("../../assets/ringtone.mp3"));

  // Play/Stop Ringtone
  const playRingtone = () => {
    try {
      if (ringtonePlayer) {
        ringtonePlayer.loop = true;
        ringtonePlayer.play();
      }
    } catch (err) {
      console.warn("[Calls] Failed to play ringtone:", err);
    }
  };

  const stopRingtone = () => {
    try {
      if (ringtonePlayer) {
        ringtonePlayer.pause();
        ringtonePlayer.seekTo(0);
      }
    } catch (err) {
      console.warn("[Calls] Failed to stop ringtone:", err);
    }
  };

  // Poll call status from backend
  const startStatusPolling = (callId) => {
    if (callStatusPollIntervalRef.current) clearInterval(callStatusPollIntervalRef.current);
    
    callStatusPollIntervalRef.current = setInterval(async () => {
      try {
        const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";
        const res = await fetch(`${API_URL}/api/calls/status/${callId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            console.log(`[Calls] Polled status for ${callId}:`, data.status);
            if (data.status === "connected" && callStatus !== "connected") {
              setCallStatus("connected");
              clearInterval(callStatusPollIntervalRef.current);
              callStatusPollIntervalRef.current = null;
              connectCall(callId);
            } else if (data.status === "rejected" || data.status === "ended") {
              setCallStatus(data.status);
              clearInterval(callStatusPollIntervalRef.current);
              callStatusPollIntervalRef.current = null;
              endCall(callId, data.status === "rejected" ? "Call Rejected" : "Call Ended");
            }
          }
        }
      } catch (err) {
        console.warn("[Calls] Status poll error:", err.message);
      }
    }, 2000);
  };

  // Initiate an outgoing call
  const startOutgoingCall = async () => {
    setMicMenuVisible(false);
    setIsRealTimeCall(true);
    setCallStatus("connecting");
    setCallDuration(0);
    setCallMuted(false);
    setCallSpeakerActive(false);

    try {
      // connecting phase -> ringing
      setTimeout(() => {
        setCallStatus("ringing");
        playRingtone();
      }, 1000);

      const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";
      const res = await fetch(`${API_URL}/api/calls/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callerId: currentUser.uid,
          partnerId: partnerId,
          callerName: currentUser.name,
          callerAvatar: currentUser.avatar || ""
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.callId) {
          setActiveCallId(data.callId);
          startStatusPolling(data.callId);
        } else {
          throw new Error("Failed to initialize call session");
        }
      } else {
        throw new Error("Initiate endpoint failed");
      }
    } catch (err) {
      console.error("[Calls] Outgoing call initiation failed:", err);
      Alert.alert("Call failed", "Unable to start the call. Please try again.");
      setIsRealTimeCall(false);
      setCallStatus("disconnected");
      stopRingtone();
    }
  };

  // Accept an incoming call
  const acceptIncomingCall = async () => {
    if (!incomingCallData) return;
    const callId = incomingCallData.id;
    setIncomingCallData(null);
    setIsRealTimeCall(true);
    setCallStatus("connected");
    setCallDuration(0);
    setCallMuted(false);
    setCallSpeakerActive(false);
    setActiveCallId(callId);
    stopRingtone();

    try {
      const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";
      await fetch(`${API_URL}/api/calls/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId })
      });
      connectCall(callId);
    } catch (err) {
      console.error("[Calls] Accept call error:", err);
      endCall(callId, "Failed to connect call");
    }
  };

  // Reject an incoming call
  const rejectIncomingCall = async () => {
    if (!incomingCallData) return;
    const callId = incomingCallData.id;
    setIncomingCallData(null);
    stopRingtone();

    try {
      const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";
      await fetch(`${API_URL}/api/calls/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId })
      });
    } catch (err) {
      console.error("[Calls] Reject call error:", err);
    }
  };

  // Connect the call
  const connectCall = async (callId) => {
    stopRingtone();
    setCallStatus("connected");

    // Start call duration timer
    if (callDurationTimerRef.current) clearInterval(callDurationTimerRef.current);
    callDurationTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    // Audio polling loop (Receiver side)
    lastAudioTimestampRef.current = getCurrentTimestamp();
    if (callAudioPollIntervalRef.current) clearInterval(callAudioPollIntervalRef.current);
    
    callAudioPollIntervalRef.current = setInterval(async () => {
      try {
        const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";
        const res = await fetch(`${API_URL}/api/calls/poll-audio/${callId}/${encodeURIComponent(currentUser.uid)}/${lastAudioTimestampRef.current}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.chunks && data.chunks.length > 0) {
            console.log(`[Calls] Polled ${data.chunks.length} audio chunks`);
            for (const chunk of data.chunks) {
              if (chunk.timestamp > lastAudioTimestampRef.current) {
                lastAudioTimestampRef.current = chunk.timestamp;
              }
              // Play base64 audio chunk immediately
              playAudioChunk(chunk.audio);
            }
          }
        }
      } catch (err) {
        console.warn("[Calls] Audio polling failed:", err.message);
      }
    }, 1500);

    // Audio streaming/recording loop (Sender side)
    startAudioStreaming(callId);
  };

  // Helper to play base64 audio chunk dynamically
  const playAudioChunk = async (base64Audio) => {
    try {
      const chunkPath = `${FileSystem.cacheDirectory}call_chunk_${Date.now()}.mp3`;
      await FileSystem.writeAsStringAsync(chunkPath, base64Audio, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const chunkPlayer = AudioModule.createPlayer(chunkPath);
      chunkPlayer.play();
    } catch (err) {
      console.warn("[Calls] Failed to play audio chunk:", err.message);
    }
  };

  // Streaming audio recording loop
  const startAudioStreaming = async (callId) => {
    try {
      const permission = await AudioModule.getRecordingPermissionsAsync();
      if (permission.status !== "granted") {
        await AudioModule.requestRecordingPermissionsAsync();
      }

      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Simple low-latency recording loop
      const streamRecord = async () => {
        if (callStatus !== "connected" && callStatusPollIntervalRef.current === null && activeCallId === null) return;
        
        try {
          const streamRecorder = AudioModule.createRecorder(COMPRESSED_AUDIO_OPTIONS);
          callAudioRecorderRef.current = streamRecorder;
          await streamRecorder.prepareToRecordAsync(COMPRESSED_AUDIO_OPTIONS);
          await streamRecorder.record();

          setTimeout(async () => {
            try {
              await streamRecorder.stop();
              const uri = streamRecorder.uri;
              if (uri && !callMuted) {
                const base64 = await FileSystem.readAsStringAsync(uri, {
                  encoding: FileSystem.EncodingType.Base64,
                });
                
                // Upload chunk to server
                const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";
                fetch(`${API_URL}/api/calls/stream`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    callId,
                    senderId: currentUser.uid,
                    audio: base64
                  })
                }).catch(err => console.warn("[Calls] Failed to post audio chunk:", err.message));
              }
              // Clean up local temp file
              if (uri) await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
            } catch (err) {
              console.warn("[Calls] Recording chunk error:", err.message);
            }
            
            // Recurse to keep recording next chunk
            if (isRealTimeCall) {
              streamRecord();
            }
          }, 1500);
        } catch (err) {
          console.error("[Calls] Recording stream initialization error:", err);
        }
      };

      streamRecord();
    } catch (err) {
      console.error("[Calls] Audio streaming configuration error:", err);
    }
  };

  // End / Hang up the call
  const endCall = async (callId = activeCallId, statusText = "Call Ended") => {
    stopRingtone();
    setCallStatus("ended");
    setIsRealTimeCall(false);
    setActiveCallId(null);
    setIncomingCallData(null);

    // Clear duration timer
    if (callDurationTimerRef.current) {
      clearInterval(callDurationTimerRef.current);
      callDurationTimerRef.current = null;
    }

    // Clear polling intervals
    if (callStatusPollIntervalRef.current) {
      clearInterval(callStatusPollIntervalRef.current);
      callStatusPollIntervalRef.current = null;
    }
    if (callAudioPollIntervalRef.current) {
      clearInterval(callAudioPollIntervalRef.current);
      callAudioPollIntervalRef.current = null;
    }

    // Stop and clean up recording
    try {
      if (callAudioRecorderRef.current) {
        await callAudioRecorderRef.current.stop();
        callAudioRecorderRef.current = null;
      }
    } catch (_) {}

    // Notify backend
    if (callId) {
      try {
        const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";
        await fetch(`${API_URL}/api/calls/end`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callId })
        });
      } catch (err) {
        console.warn("[Calls] Failed to end call on backend:", err.message);
      }
    }

    // Restore standard audio settings
    try {
      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
    } catch (_) {}

    // Briefly alert user of status
    Alert.alert("Call Status", statusText, [{ text: "OK" }], { cancelable: true });
  };

  // Foreground incoming call poll
  useEffect(() => {
    if (!currentUser || !currentUser.uid) return;

    const pollInterval = setInterval(async () => {
      // Don't poll if we are already in call view, or translation mode, or displaying an incoming call
      if (isRealTimeCall || handsFreeActive || incomingCallData) return;

      try {
        const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";
        const res = await fetch(`${API_URL}/api/calls/poll-active/${encodeURIComponent(currentUser.uid)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.incomingCall) {
            console.log("[Calls] Detected incoming call signal:", data.incomingCall);
            setIncomingCallData(data.incomingCall);
            playRingtone();
          }
        }
      } catch (err) {
        console.warn("[Calls] Foreground call signaling error:", err.message);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [currentUser, isRealTimeCall, handsFreeActive, incomingCallData]);

  // Handle call answered from background notification on mount/focus
  useEffect(() => {
    const checkPendingAnswer = async () => {
      try {
        const pendingCallId = await AsyncStorage.getItem("amani_pending_answer_call_id");
        if (pendingCallId) {
          console.log("[Calls] Found pending answered call from background:", pendingCallId);
          await AsyncStorage.removeItem("amani_pending_answer_call_id");
          
          setIsRealTimeCall(true);
          setCallStatus("connected");
          setCallDuration(0);
          setCallMuted(false);
          setCallSpeakerActive(false);
          setActiveCallId(pendingCallId);
          
          // Connect call
          connectCall(pendingCallId);
        }
      } catch (err) {
        console.warn("[Calls] Check pending answer error:", err);
      }
    };

    checkPendingAnswer();
  }, []);

  const recorder = useAudioRecorder(COMPRESSED_AUDIO_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 100);

  useEffect(() => {
    if (recorderState) {
      onRecordingStatusUpdate(recorderState);
    }
  }, [onRecordingStatusUpdate, recorderState]);

  // Stop microphone recording when leaving the screen or unmounting
  useEffect(() => {
    let unsubscribe = null;
    try {
      unsubscribe = navigation.addListener("blur", () => {
        console.log("[ConversationScreen] Navigation blur: stopping audio recorder...");
        try {
          if (recorder) {
            recorder.stop().catch((err) =>
              console.warn("[ConversationScreen] Failed to stop recorder on blur:", err)
            );
          }
        } catch (err) {
          console.warn("[ConversationScreen] Sync error stopping recorder on blur:", err);
        }
        setIsRecording(false);
        setHandsFreeActive(false);
        handsFreeActiveRef.current = false;
        isSpeakingRef.current = false;
      });
    } catch (err) {
      console.warn("[ConversationScreen] Failed to add blur listener:", err);
    }

    return () => {
      if (unsubscribe && typeof unsubscribe === "function") {
        try { unsubscribe(); } catch (_) {}
      }
      console.log("[ConversationScreen] Screen unmount: stopping audio recorder & Speech...");
      try {
        Speech.stop();
      } catch (err) {
        console.warn("[ConversationScreen] Failed to stop Speech on unmount:", err);
      }
      try {
        if (recorder) {
          recorder.stop().catch((err) =>
            console.warn("[ConversationScreen] Failed to stop recorder on unmount:", err)
          );
        }
      } catch (err) {
        console.warn("[ConversationScreen] Sync error stopping recorder on unmount:", err);
      }
    };
  }, [navigation, recorder]);

  // Suppress incoming/reminder notifications while actively inside this chat view
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      try {
        if (nextAppState === "active") {
          setActiveChatPartnerId(partnerId);
        } else {
          setActiveChatPartnerId(null);
          // Stop recording when app goes to background to prevent hot mic
          try {
            if (recorder) {
              recorder.stop().catch(() => {});
            }
          } catch (_) {}
          setIsRecording(false);
          setHandsFreeActive(false);
          handsFreeActiveRef.current = false;
          isSpeakingRef.current = false;
        }
      } catch (err) {
        console.error(err);
      }
    };

    let appStateSub = null;
    try {
      appStateSub = AppState.addEventListener("change", handleAppStateChange);
    } catch (err) {
      console.warn("Failed to add AppState listener:", err);
    }
    
    try {
      setActiveChatPartnerId(partnerId);
    } catch (err) {
      console.error(err);
    }

    let focusUnsubscribe = null;
    let blurUnsubscribe = null;
    try {
      focusUnsubscribe = navigation.addListener("focus", () => {
        try { setActiveChatPartnerId(partnerId); } catch (_) {}
      });
      blurUnsubscribe = navigation.addListener("blur", () => {
        try { setActiveChatPartnerId(null); } catch (_) {}
      });
    } catch (err) {
      console.warn("Failed to add focus/blur listener for notifications:", err);
    }

    return () => {
      try {
        if (appStateSub && typeof appStateSub.remove === "function") {
          appStateSub.remove();
        } else if (AppState.removeEventListener) {
          AppState.removeEventListener("change", handleAppStateChange);
        }
      } catch (err) {
        console.warn("Failed to remove AppState listener:", err);
      }
      
      try {
        if (focusUnsubscribe && typeof focusUnsubscribe === "function") {
          focusUnsubscribe();
        }
      } catch (_) {}
      
      try {
        if (blurUnsubscribe && typeof blurUnsubscribe === "function") {
          blurUnsubscribe();
        }
      } catch (_) {}

      try {
        setActiveChatPartnerId(null);
      } catch (err) {
        console.error(err);
      }
    };
  }, [navigation, partnerId, recorder]);

  const silenceTimerRef = useRef(null);

  const noiseFloorRef = useRef(-60);
  const speechPeakRef = useRef(-25);

  const [ttsVoices, setTtsVoices] = useState({ female: {}, male: {} });

  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const voices = await Speech.getAvailableVoicesAsync();

        const getVoiceId = (langPrefix, type) => {
          const matchLang = voices.filter((v) =>
            v.language.startsWith(langPrefix),
          );

          if (type === "female") {
            const female = matchLang.find(
              (v) =>
                v.name.toLowerCase().includes("female") ||
                v.name.toLowerCase().includes("siri") ||
                v.name.toLowerCase().includes("zira") ||
                v.identifier.toLowerCase().includes("female"),
            );
            return female
              ? female.identifier
              : matchLang[0]?.identifier || undefined;
          } else {
            const male = matchLang.find(
              (v) =>
                v.name.toLowerCase().includes("male") ||
                v.name.toLowerCase().includes("david") ||
                v.identifier.toLowerCase().includes("male"),
            );
            return male
              ? male.identifier
              : matchLang[0]?.identifier || undefined;
          }
        };

        setTtsVoices({
          female: {
            en: getVoiceId("en", "female"),
            es: getVoiceId("es", "female"),
          },
          male: {
            en: getVoiceId("en", "male"),
            es: getVoiceId("es", "male"),
          },
        });
      } catch (e) {
        console.log("Could not fetch voices:", e);
      }
    };
    fetchVoices();
  }, []);

  const getLangCodeFromFlag = useCallback(
    (flagEmoji) => {
      if (!LANGS) return "en";
      for (const [code, details] of Object.entries(LANGS)) {
        if (details.flag === flagEmoji) {
          return code;
        }
      }
      return "en";
    },
    [LANGS],
  );

  const openProfilePopup = (profile) => {
    setProfilePopupData(profile);
    setProfilePopupVisible(true);
  };

  const chatScrollViewRef = useRef();

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
  }, [shimmerAnim]);

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
  }, [waveRotate1, waveRotate2]);

  // Update orb pulse animation based on recording status
  useEffect(() => {
    if (isRecording) {
      // Cancel idle breathing animations while recording active voice
      cancelAnimation(orbScale);
      cancelAnimation(glow1Opacity);
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
  }, [isRecording, orbScale, glow1Opacity, glow2Opacity]);

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

  useEffect(() => {
    async function loadChatHistory() {
      try {
        await saveContacts([
          {
            id: partnerId,
            name: partnerName,
            phone: "",
            email: partnerId.includes("@") ? partnerId : "",
            flag: partnerFlag,
            status: partnerStatus || "Available on Unity",
            avatar: partnerAvatar || "",
            isUnityUser: true,
          },
        ]);
        await clearContactUnread(partnerId);
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
            transLang: `${userLangName} (Translated)`,
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
              transLang: firstMsg.transLang,
            },
          ]);
          setSubtitleReceived(welcomeText);
        }
      } catch (e) {
        console.error("Error loading chat history:", e);
      }
    }

    loadChatHistory();

    // Subscribe to new messages from MessageQueue
    const unsubscribe = messageQueue.subscribe((event) => {
      if (event.isUserUpdate && event.userMsgId) {
        setChatBubbles((prev) =>
          prev.map((msg) =>
            msg.id === event.userMsgId
              ? { ...msg, text: event.text || msg.text, transText: event.transText }
              : msg,
          ),
        );
      } else if (event.success && event.partnerMsgId) {
        setChatBubbles((prev) =>
          prev.map((msg) =>
            msg.id === event.partnerMsgId
              ? {
                  ...msg,
                  transText: event.replyText,
                  text: event.partnerSpokenText,
                }
              : msg,
          ),
        );
      }
    });

    return () => {
      unsubscribe();
      clearContactUnread(partnerId);
    };
  }, [
    partnerId,
    currentUser.avatar,
    currentUser.nativeLang,
    getLangCodeFromFlag,
    getLangDetails,
    partnerFlag,
  ]);

  // Scroll to bottom helper
  useEffect(() => {
    if (chatScrollViewRef.current) {
      setTimeout(
        () => chatScrollViewRef.current.scrollToEnd({ animated: true }),
        100,
      );
    }
  }, [chatBubbles, isKeyboardMode]);

  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recorder) {
        recorder.stop().catch(() => {});
      }
    };
  }, [recorder]);

  const toggleHandsFree = async () => {
    if (handsFreeActive) {
      setHandsFreeActive(false);
      handsFreeActiveRef.current = false;
      setIsRecording(false);
      setSubtitleUser("Microphone muted");

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      isSpeakingRef.current = false;

      try {
        await recorder.stop();
        await AudioModule.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
      } catch (error) {
        console.warn("Failed to stop hands-free recording", error);
      }
    } else {
      setHandsFreeActive(true);
      handsFreeActiveRef.current = true;
      setIsRecording(true);
      setSubtitleUser("Listening...");

      try {
        const permission = await AudioModule.getRecordingPermissionsAsync();
        if (permission.status !== "granted") {
          const request = await AudioModule.requestRecordingPermissionsAsync();
          if (request.status !== "granted") {
            alert("Microphone permission required.");
            setHandsFreeActive(false);
            return;
          }
        }

        await AudioModule.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        await recorder.prepareToRecordAsync(COMPRESSED_AUDIO_OPTIONS);
        await recorder.record();
      } catch (err) {
        console.error(err);
        setHandsFreeActive(false);
        setIsRecording(false);
      }
    }
  };

  const handleVoiceMessage = async (audioUri) => {
    trackEvent("sent_voice_message", currentUser, { partnerId });
    const partnerLang = getLangCodeFromFlag(partnerFlag);
    const partnerLangName =
      partnerId === "unity_ai"
        ? getLangDetails(currentUser.unityAILang)?.name || "AI"
        : getLangDetails(partnerLang).name;
    const userLangName = getLangDetails(currentUser.nativeLang).name;
    const isSameLanguage = currentUser.nativeLang === partnerLang;

    if (!isConnected) {
      // Clean up the file immediately
      await FileSystem.deleteAsync(audioUri, { idempotent: true }).catch(
        (err) => console.warn("Failed to delete transient audio file:", err),
      );
      return;
    }

    try {
      // Transcribe in user's native language if same language, otherwise translate to partner language
      const result = await translateVoice(audioUri, isSameLanguage ? currentUser.nativeLang : partnerLang);
      const { transcription, translation } = result;

      // Update subtitle overlays
      setSubtitleUser(transcription);
      setSubtitleReceived(isSameLanguage ? "" : translation);

      // Add user message to chat bubbles
      const userMsgId = "msg_" + Date.now();
      const userMsg = {
        id: userMsgId,
        sender: "user",
        avatar: "🇺🇸",
        text: transcription,
        origLang: `${userLangName} (Original)`,
        transText: isSameLanguage ? transcription : translation,
        transLang: isSameLanguage ? "" : `${partnerLangName} ${partnerId === "unity_ai" ? "(AI)" : "(Translated)"}`,
      };
      setChatBubbles((prev) => [...prev, userMsg]);

      // Save user message to SQLite
      await saveChat({
        id: userMsgId,
        partner_id: partnerId,
        text: transcription,
        trans_text: isSameLanguage ? transcription : translation,
        sender: "user",
        orig_lang: `${userLangName} (Original)`,
        trans_lang: isSameLanguage ? "" : `${partnerLangName} (Translated)`,
        timestamp: Date.now(),
      });
      await updateContactLastMessageTime(partnerId, Date.now());

      if (partnerId !== "unity_ai") {
        const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";
        fetch(`${API_URL}/api/push-message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientId: partnerId,
            senderName: currentUser.name || "Xaylite User",
            messageText: transcription,
            type: "chat"
          })
        }).catch(err => console.warn("[Push] Failed to send push message:", err.message));
      }

      // Clean up transient audio file immediately
      await FileSystem.deleteAsync(audioUri, { idempotent: true }).catch(
        (err) => console.warn("Failed to delete transient audio file:", err),
      );

      if (partnerId === "unity_ai") {
        // Add temporary typing bubble instantly
        const partnerMsgId = "msg_" + (Date.now() + 1);
        const tempPartnerMsg = {
          id: partnerMsgId,
          sender: "partner",
          avatar: partnerFlag,
          text: "...",
          origLang: `${partnerLangName} (Original)`,
          transText: "...",
          transLang: `${userLangName} (Translated)`,
        };
        setChatBubbles((prev) => [...prev, tempPartnerMsg]);

        // Simulate AI responding
        setTimeout(async () => {
          try {
            let partnerResponseBase = "";
            let partnerSpokenText = "";

            const aiReply = await chatWithAI(
              isSameLanguage ? transcription : translation,
              [],
              currentUser.unityAILang || "en",
            );
            partnerSpokenText = aiReply;
            partnerResponseBase = isSameLanguage
              ? aiReply
              : await translateText(aiReply, currentUser.nativeLang);

            const partnerMsg = {
              ...tempPartnerMsg,
              text: partnerSpokenText,
              transText: partnerResponseBase,
            };

            setSubtitleReceived(`${partnerName} is talking...`);
            setChatBubbles((prev) =>
              prev.map((msg) => (msg.id === partnerMsgId ? partnerMsg : msg)),
            );

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
            await updateContactLastMessageTime(partnerId, Date.now());

            const userLangCode = currentUser.nativeLang || "en";
            const aiVoiceId = userLangCode.startsWith("en")
              ? ttsVoices.female.en
              : ttsVoices.female.es;

            Speech.speak(partnerResponseBase, {
              language: userLangCode,
              voice: aiVoiceId,
              rate: currentUser.aiVoiceRate || 1.0,
              pitch: currentUser.aiVoicePitch || 1.1,
            });

            // Count consecutive partner messages before scheduling reply reminder
            let consecutivePartnerMsgs = 0;
            for (let idx = chatBubbles.length - 1; idx >= 0; idx--) {
              if (chatBubbles[idx].sender === "partner") {
                consecutivePartnerMsgs++;
              } else if (chatBubbles[idx].sender === "user") {
                break;
              }
            }
            consecutivePartnerMsgs += 1;

            if (consecutivePartnerMsgs >= 2) {
              scheduleLocalNotification(
                "Waiting for Reply",
                `${partnerName} is waiting for your reply, maybe you forgot?`,
                { seconds: 120 },
                partnerId
              );
            }
          } catch (err) {
            console.error(
              "Failed to translate simulated partner voice response:",
              err,
            );
          }
        }, 3500);
      }
    } catch (error) {
      console.error("Voice translation error:", error);
      setSubtitleUser("Voice translation failed");
      const errorMessage = error.message || "Unknown error occurred.";
      setSubtitleReceived(`Error: ${errorMessage}`);

      // Still clean up the file on failure
      await FileSystem.deleteAsync(audioUri, { idempotent: true }).catch(
        (err) => console.warn("Failed to delete transient audio file:", err),
      );
    }
  };

  const handleSendText = async () => {
    if (!inputText.trim()) return;
    trackEvent("sent_text_message", currentUser, { partnerId });

    // Clear any pending 2-minute reminders when user replies
    if (Platform.OS !== "web") {
      Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
    }

    const text = inputText.trim();
    setInputText("");
    setSubtitleUser(text);

    const partnerLang = getLangCodeFromFlag(partnerFlag);
    const partnerLangName =
      partnerId === "unity_ai"
        ? getLangDetails(currentUser.unityAILang)?.name || "AI"
        : getLangDetails(partnerLang).name;
    const userLangName = getLangDetails(currentUser.nativeLang).name;
    const isSameLanguage = currentUser.nativeLang === partnerLang;

    if (partnerId === "unity_ai") {
      const waitMessages = [
        `Waiting for ${partnerName}...`,
        `${partnerName} is typing...`,
      ];
      setSubtitleReceived(
        waitMessages[Math.floor(Math.random() * waitMessages.length)],
      );
    } else {
      setSubtitleReceived(partnerStatus || "Online");
    }

    try {
      // Create user message with pending translation
      const userMsgId = "msg_" + Date.now();
      const userMsg = {
        id: userMsgId,
        sender: "user",
        avatar: "🇺🇸", // or get user flag from context
        text: text,
        origLang: `${userLangName} (Original)`,
        transText: isSameLanguage ? text : "...",
        transLang: isSameLanguage ? "" : `${partnerLangName} ${partnerId === "unity_ai" ? "(AI)" : "(Translated)"}`,
      };
      setChatBubbles((prev) => [...prev, userMsg]);

      try {
        await saveChat({
          id: userMsgId,
          partner_id: partnerId,
          text: text,
          trans_text: isSameLanguage ? text : "...",
          sender: "user",
          orig_lang: `${userLangName} (Original)`,
          trans_lang: isSameLanguage ? "" : `${partnerLangName} (Translated)`,
          timestamp: Date.now(),
        });
        await updateContactLastMessageTime(partnerId, Date.now());
      } catch (dbError) {
        console.warn("Skipping SQLite save on Web:", dbError.message);
      }

      if (partnerId !== "unity_ai") {
        const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";
        fetch(`${API_URL}/api/push-message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientId: partnerId,
            senderName: currentUser.name || "Xaylite User",
            messageText: text,
            type: "chat"
          })
        }).catch(err => console.warn("[Push] Failed to send push message:", err.message));
      }

      if (partnerId === "unity_ai") {
        // Create a temporary partner typing bubble
        const partnerMsgId = "msg_" + (Date.now() + 1);
        const tempPartnerMsg = {
          id: partnerMsgId,
          sender: "partner",
          avatar: partnerFlag,
          text: "...",
          origLang: `${partnerLangName} (Original)`,
          transText: "...",
          transLang: `${userLangName} (Translated)`,
        };
        setChatBubbles((prev) => [...prev, tempPartnerMsg]);

        // Enqueue job to get real AI response in background
        await messageQueue.enqueue({
          id: "job_" + Date.now(),
          type: "ai",
          partnerId,
          partnerMsgId,
          userMsgId,
          partnerName: "Unity AI",
          partnerAvatarUrl: partnerAvatar,
          partnerLangName,
          userLangName,
          payload: {
            text: text,
            partnerLang,
            userLang: currentUser.nativeLang,
            targetLang: currentUser.unityAILang || "en", // For AI
            history: [], // Omitted for brevity
          },
        });
      } else if (!isSameLanguage) {
        // Human contact & different language: translate user message in background for local reference
        translateText(text, partnerLang)
          .then(async (translatedText) => {
            setChatBubbles((prev) =>
              prev.map((msg) =>
                msg.id === userMsgId ? { ...msg, transText: translatedText } : msg
              )
            );
            try {
              await saveChat({
                id: userMsgId,
                partner_id: partnerId,
                text: text,
                trans_text: translatedText,
                sender: "user",
                orig_lang: `${userLangName} (Original)`,
                trans_lang: `${partnerLangName} (Translated)`,
                timestamp: Date.now(),
              });
            } catch (dbErr) {
              console.warn(dbErr);
            }
          })
          .catch((err) => console.warn(err));
      }
    } catch (error) {
      console.error("Text send error:", error);
      setSubtitleUser("Text send failed");
    }
  };

  const renderBubble = (bubble) => {
    const isUser = bubble.sender === "user";
    const partnerLang = getLangCodeFromFlag(partnerFlag);
    const isSameLanguage = currentUser.nativeLang === partnerLang;

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

        {!isUser && bubble.transText === "..." ? (
          <View style={{ marginLeft: 8, justifyContent: "center" }}>
            <TypingIndicator color={colors.textMuted} />
          </View>
        ) : (
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
                {isUser ? bubble.text : (isSameLanguage ? bubble.text : bubble.transText)}
              </Text>

              {!isUser && !isSameLanguage && (
                <>
                  <View
                    style={[
                      styles.bubbleDivider,
                      {
                        backgroundColor: "rgba(0, 0, 0, 0.05)",
                      },
                    ]}
                  />

                  {/* Bottom Text (Partner's Original Text) */}
                  <Text
                    style={[styles.bubbleTextTrans, { color: colors.primary }]}
                  >
                    {bubble.text}
                  </Text>
                </>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
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
            {isConnected ? (
              <Text
                style={[styles.partnerStatusText, { color: colors.textMuted }]}
              >
                Connected 🟢
              </Text>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text
                  style={[
                    styles.partnerStatusText,
                    { color: colors.danger, marginRight: 4 },
                  ]}
                >
                  {"You're offline"}
                </Text>
                <Svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={colors.danger}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <Path d="M1 1l22 22" />
                  <Path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.5" />
                  <Path d="M5 12.5a10.94 10.94 0 0 1 5.83-2.84" />
                  <Path d="M8.5 16.5a5 5 0 0 1 7 0" />
                  <Path d="M21.3 8.11A15.89 15.89 0 0 1 23 9" />
                  <Path d="M1 9a15.89 15.89 0 0 1 9-2.78" />
                  <Path d="M12 20h.01" />
                </Svg>
              </View>
            )}
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
                source={typeof partnerAvatar === "number" ? partnerAvatar : { uri: partnerAvatar }}
                style={styles.headerAvatar}
              />
              {isOnline && (
                <View
                  style={[
                    styles.onlineBadge,
                    !isConnected && { backgroundColor: colors.danger },
                  ]}
                />
              )}
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
              style={[
                styles.subtitleLineReceived,
                { color: !isOnline ? colors.danger : colors.primary },
              ]}
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
              activeOpacity={0.8}
              onPress={() => setMicMenuVisible(true)}
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
              {getLangDetails(currentUser.nativeLang)?.name || "English"} ⇄{" "}
              {partnerId === "unity_ai"
                ? getLangDetails(currentUser.unityAILang)?.name || "AI"
                : getLangDetails(getLangCodeFromFlag(partnerFlag))?.name ||
                  "Spanish"}{" "}
              translation active
            </Text>
          </View>

          {chatBubbles.map(renderBubble)}
        </ScrollView>
      )}

      {/* Control Buttons Bar */}
      <View
        style={[
          styles.controlsSafeArea,
          {
            backgroundColor: colors.cardBg,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            paddingBottom: (isKeyboardMode && isKeyboardVisible) ? 0 : Math.max(insets.bottom, 12),
          },
        ]}
      >
        <View style={styles.controlsBar}>
          {isKeyboardMode ? (
            /* Keyboard Mode Typing Input bar */
            <>
              {/* Mic Icon (Switch back to Voice) on the LEFT */}
              {!isSelfChat && (
                <TouchableOpacity
                  style={{
                    width: 44,
                    height: 44,
                    justifyContent: "center",
                    alignItems: "center",
                    marginRight: 8,
                  }}
                  onPress={() => setIsKeyboardMode(false)}
                  activeOpacity={0.7}
                >
                  <Svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.textMuted}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  </Svg>
                </TouchableOpacity>
              )}

              <View
                style={[
                  styles.keyboardInputContainer,
                  {
                    backgroundColor: colors.bg,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 24,
                    paddingLeft: 16,
                    paddingRight: 6,
                    paddingVertical: 6,
                    marginRight: 0,
                    gap: 8,
                  },
                ]}
              >
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      borderWidth: 0,
                      backgroundColor: "transparent",
                      color: colors.text,
                      height: 36,
                      paddingHorizontal: 0,
                    },
                  ]}
                  placeholder="Message..."
                  placeholderTextColor={colors.textDimmed}
                  value={inputText}
                  onChangeText={setInputText}
                  onSubmitEditing={handleSendText}
                />
                <TouchableOpacity
                  style={[
                    styles.sendBtn,
                    {
                      backgroundColor: colors.primary,
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                    },
                  ]}
                  onPress={handleSendText}
                  activeOpacity={0.8}
                >
                  <Svg
                    width="16"
                    height="16"
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
            </>
          ) : (
            /* Voice Controls */
            <>
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
                  onPress={isOnline ? () => setMicMenuVisible(true) : undefined}
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
                    ? isRecording
                      ? "Recording..."
                      : "Hold mic to speak"
                    : "The user is currently offline"}
                </Text>
              </View>

              {/* Keyboard Toggle Icon on the RIGHT */}
              <TouchableOpacity
                style={[
                  styles.controlCircle,
                  {
                    backgroundColor: colors.cardBg,
                    borderColor: colors.border,
                    borderWidth: 1,
                  },
                ]}
                onPress={() => {
                  if (handsFreeActive) toggleHandsFree();
                  setIsKeyboardMode(true);
                }}
                activeOpacity={0.7}
              >
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
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Smart Microphone Mode Selection Modal */}
      <Modal
        visible={micMenuVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setMicMenuVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalDismissBg} 
            activeOpacity={1} 
            onPress={() => setMicMenuVisible(false)} 
          />
          <View style={[styles.sheetContent, { backgroundColor: colors.cardBg }]}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHandle} />
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Choose Calling Mode</Text>
              <Text style={[styles.sheetSubtitle, { color: colors.textMuted }]}>
                {"Select how you'd like to voice chat with " + partnerName}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.optionCard, { borderColor: colors.border }]}
              onPress={() => {
                setMicMenuVisible(false);
                toggleHandsFree();
              }}
            >
              <View style={[styles.optionIconContainer, { backgroundColor: 'rgba(79, 70, 229, 0.1)' }]}>
                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2">
                  <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <Line x1="12" y1="19" x2="12" y2="22" />
                </Svg>
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>Translated Call</Text>
                <Text style={[styles.optionDescription, { color: colors.textMuted }]}>
                  AI translates your speech and plays translated voice to the partner
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionCard, { borderColor: colors.border }]}
              onPress={startOutgoingCall}
            >
              <View style={[styles.optionIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.success || '#10B981'} strokeWidth="2">
                  <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </Svg>
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>Direct Call</Text>
                <Text style={[styles.optionDescription, { color: colors.textMuted }]}>
                  Direct voice call without AI translation (WebRTC phone call style)
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetCancelBtn, { backgroundColor: colors.border }]}
              onPress={() => setMicMenuVisible(false)}
            >
              <Text style={[styles.sheetCancelText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Foreground Incoming Call Notification Modal */}
      <Modal
        visible={!!incomingCallData}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.incomingCallPopup, { backgroundColor: colors.cardBg }]}>
            <Text style={[styles.incomingCallTitle, { color: colors.text }]}>Incoming Call</Text>
            <View style={styles.incomingAvatarContainer}>
              <Image
                source={
                  incomingCallData?.callerAvatar
                    ? { uri: incomingCallData.callerAvatar }
                    : require("../../assets/default-avatar-2.jpg")
                }
                style={styles.incomingAvatar}
              />
            </View>
            <Text style={[styles.incomingCallerName, { color: colors.text }]}>
              {incomingCallData?.callerName || partnerName}
            </Text>
            <Text style={[styles.incomingCallerStatus, { color: colors.textMuted }]}>
              is calling you...
            </Text>

            <View style={styles.incomingActions}>
              <TouchableOpacity
                style={[styles.incomingDeclineBtn, { backgroundColor: colors.danger }]}
                onPress={rejectIncomingCall}
              >
                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <Path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                  <Line x1="23" y1="1" x2="1" y2="23" />
                </Svg>
                <Text style={styles.incomingDeclineText}>Decline</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.incomingAcceptBtn, { backgroundColor: colors.success || '#10B981' }]}
                onPress={acceptIncomingCall}
              >
                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </Svg>
                <Text style={styles.incomingAcceptText}>Answer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full-Screen WebRTC Voice Call Overlay */}
      <Modal
        visible={isRealTimeCall}
        transparent={false}
        animationType="slide"
      >
        <LinearGradient
          colors={["#0F172A", "#1E293B"]}
          style={styles.callOverlayContainer}
        >
          <SafeAreaView style={styles.callSafeArea}>
            {/* Top info */}
            <View style={styles.callHeader}>
              <Text style={styles.callTypeLabel}>DIRECT VOICE CALL</Text>
              <Text style={styles.callTimer}>
                {callStatus === "connected"
                  ? `${Math.floor(callDuration / 60).toString().padStart(2, '0')}:${(callDuration % 60).toString().padStart(2, '0')}`
                  : callStatus === "connecting"
                  ? "Connecting..."
                  : callStatus === "ringing"
                  ? "Ringing..."
                  : "Call Disconnected"}
              </Text>
            </View>

            {/* Avatar & Pulse ripple */}
            <View style={styles.callAvatarSection}>
              <View style={styles.callAvatarGlowOuter}>
                <View style={styles.callAvatarGlowInner}>
                  <Image
                    source={
                      partnerAvatar
                        ? { uri: partnerAvatar }
                        : require("../../assets/default-avatar-2.jpg")
                    }
                    style={styles.callAvatar}
                  />
                </View>
              </View>
              <Text style={styles.callPartnerName}>{partnerName}</Text>
              <Text style={styles.callStatusText}>
                {callStatus === "connected"
                  ? "End-to-End Voice Connection"
                  : callStatus === "ringing"
                  ? "Waiting for answer..."
                  : "Establishing call..."}
              </Text>
            </View>

            {/* Pulsating Waveform during call */}
            {callStatus === "connected" && (
              <View style={styles.callWaveformContainer}>
                <View style={[styles.callWaveBar, { height: 25 }]} />
                <View style={[styles.callWaveBar, { height: 40 }]} />
                <View style={[styles.callWaveBar, { height: 60 }]} />
                <View style={[styles.callWaveBar, { height: 30 }]} />
                <View style={[styles.callWaveBar, { height: 15 }]} />
              </View>
            )}

            {/* Action buttons */}
            <View style={styles.callActionsContainer}>
              {/* Mute Button */}
              <TouchableOpacity
                style={[
                  styles.callActionButton,
                  callMuted ? { backgroundColor: 'white' } : { backgroundColor: 'rgba(255,255,255,0.1)' }
                ]}
                onPress={() => setCallMuted(prev => !prev)}
              >
                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={callMuted ? 'black' : 'white'} strokeWidth="2">
                  <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <Line x1="12" y1="19" x2="12" y2="22" />
                  {callMuted && <Line x1="1" y1="1" x2="23" y2="23" stroke="red" strokeWidth="2.5" />}
                </Svg>
                <Text style={[styles.callActionLabel, { color: 'white' }]}>Mute</Text>
              </TouchableOpacity>

              {/* End Call Button */}
              <TouchableOpacity
                style={styles.callEndActionButton}
                onPress={() => endCall(activeCallId, "Call Ended")}
              >
                <Svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <Path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  <Line x1="23" y1="1" x2="1" y2="23" stroke="white" strokeWidth="2.5" />
                </Svg>
                <Text style={[styles.callActionLabel, { color: '#EF4444' }]}>End Call</Text>
              </TouchableOpacity>

              {/* Speaker Toggle Button */}
              <TouchableOpacity
                style={[
                  styles.callActionButton,
                  callSpeakerActive ? { backgroundColor: 'white' } : { backgroundColor: 'rgba(255,255,255,0.1)' }
                ]}
                onPress={async () => {
                  try {
                    const nextMode = !callSpeakerActive;
                    setCallSpeakerActive(nextMode);
                    await AudioModule.setAudioModeAsync({
                      allowsRecordingIOS: true,
                      playsInSilentModeIOS: true,
                    });
                  } catch (_) {}
                }}
              >
                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={callSpeakerActive ? 'black' : 'white'} strokeWidth="2">
                  <Polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <Path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  <Path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </Svg>
                <Text style={[styles.callActionLabel, { color: 'white' }]}>Speaker</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </Modal>
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
    flexShrink: 1,
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

  // Calling UI Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalDismissBg: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 34,
  },
  sheetHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.1)",
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 4,
    textAlign: "center",
  },
  sheetSubtitle: {
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    marginBottom: 14,
  },
  optionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 3,
  },
  optionDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  sheetCancelBtn: {
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  sheetCancelText: {
    fontSize: 15,
    fontWeight: "700",
  },

  // Incoming Call Popup Styles
  incomingCallPopup: {
    marginHorizontal: 24,
    marginBottom: 34,
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  incomingCallTitle: {
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 16,
    opacity: 0.7,
  },
  incomingAvatarContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    padding: 3,
    backgroundColor: "#F1F5F9",
    marginBottom: 16,
  },
  incomingAvatar: {
    width: "100%",
    height: "100%",
    borderRadius: 44,
  },
  incomingCallerName: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  incomingCallerStatus: {
    fontSize: 13,
    marginBottom: 24,
  },
  incomingActions: {
    flexDirection: "row",
    gap: 16,
    width: "100%",
  },
  incomingDeclineBtn: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  incomingDeclineText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  },
  incomingAcceptBtn: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  incomingAcceptText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  },

  // Call screen overlay styles
  callOverlayContainer: {
    flex: 1,
  },
  callSafeArea: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: 24,
  },
  callHeader: {
    alignItems: "center",
    marginTop: 20,
  },
  callTypeLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 6,
  },
  callTimer: {
    color: "white",
    fontSize: 20,
    fontWeight: "700",
  },
  callAvatarSection: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  callAvatarGlowOuter: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "rgba(255,255,255,0.03)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  callAvatarGlowInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
  },
  callAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  callPartnerName: {
    color: "white",
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 6,
  },
  callStatusText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontWeight: "500",
  },
  callWaveformContainer: {
    flexDirection: "row",
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginBottom: 20,
  },
  callWaveBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  callActionsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 28,
    marginBottom: 20,
  },
  callActionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  callEndActionButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
  },
  callActionLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 8,
    position: "absolute",
    bottom: -22,
  },
});
