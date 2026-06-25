import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

// Dynamically resolve local host IP for physical devices running Expo Go
const getBaseUrl = () => {
  const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost;
  if (debuggerHost) {
    const ip = debuggerHost.split(":")[0];
    return `http://${ip}:3000`;
  }
  return "http://localhost:3000";
};

const BASE_URL = getBaseUrl();

/**
 * Translates a text message using the secure server translation gateway.
 * Integrates local cache checks to save API quota.
 */
export async function translateText(text, targetLang) {
  if (!text || !text.trim()) return "";
  
  const cacheKey = `trans_cache_${targetLang}_${text.trim().toLowerCase()}`;
  
  try {
    // Check local cache first
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      console.log("[Translation Cache] Hit for:", text);
      return cached;
    }
  } catch (e) {
    console.warn("Cache read error:", e);
  }

  try {
    const response = await fetch(`${BASE_URL}/api/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        targetLang,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();
    const result = data.translatedText || "";
    
    if (result) {
      // Save to cache asynchronously
      AsyncStorage.setItem(cacheKey, result).catch((err) =>
        console.warn("Cache write error:", err)
      );
    }

    return result;
  } catch (error) {
    console.error("Text translation service error:", error);
    return `[Translation Failed] ${text}`;
  }
}

/**
 * Transcribes and translates a voice recording file using the secure backend gateway.
 */
export async function translateVoice(audioUri, targetLang) {
  if (!audioUri) throw new Error("No audio URI provided");

  try {
    const formData = new FormData();
    
    // In React Native, local file URIs are attached using a custom object format
    formData.append("audio", {
      uri: audioUri,
      name: "recording.m4a",
      type: "audio/m4a",
    });
    formData.append("targetLang", targetLang);

    const response = await fetch(`${BASE_URL}/api/translate-voice`, {
      method: "POST",
      body: formData,
      headers: {
        "Accept": "application/json",
        // Note: Do NOT manually set Content-Type for FormData; the fetch client will set it with the boundary.
      },
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      transcription: data.transcription || "",
      translation: data.translation || "",
    };
  } catch (error) {
    console.error("Voice translation service error:", error);
    throw error;
  }
}
