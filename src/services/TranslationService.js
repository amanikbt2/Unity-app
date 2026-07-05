
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import * as FileSystem from 'expo-file-system/legacy';

let BASE_URL = process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";

// Auto-resolve localhost to the developer's machine IP for physical devices via Expo
if (Platform.OS !== "web" && BASE_URL.includes("localhost") && Constants.expoConfig?.hostUri) {
  const hostIp = Constants.expoConfig.hostUri.split(":")[0];
  BASE_URL = `http://${hostIp}:3000`;
  console.log("[Network] Auto-resolved localhost to:", BASE_URL);
}

async function readErrorMessage(response) {
  try {
    const data = await response.json();
    return data.details || data.error || `Server returned HTTP ${response.status}`;
  } catch {
    return `Server returned HTTP ${response.status}`;
  }
}

/**
 * Smart fetch wrapper that automatically retries indefinitely on network disconnects
 * or gateway timeouts (502/503/504) so that messages "hang" and send automatically
 * when the user comes back online.
 */
async function fetchWithRetry(url, options, delayMs = 3000) {
  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds timeout
    
    try {
      console.log(`[Network] Fetching ${url} (Attempt ${attempt + 1})`);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      
      console.log(`[Network] Success ${url} (Status: ${response.status})`);
      if (response.ok) return response;
      
      // If it's a gateway error, it might be the server waking up or a proxy issue.
      if ([502, 503, 504].includes(response.status)) {
        throw new Error(`Gateway Error ${response.status}: ` + (await readErrorMessage(response)));
      }
      
      // Other errors (4xx, 500) are likely permanent, so we return the response
      // to be handled by the caller.
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      console.log(`[Network] Error fetching ${url}:`, error.message);
      const msg = error.message.toLowerCase();
      // Detect offline network errors or our thrown gateway errors
      const isNetworkError = 
        msg.includes("network") || 
        msg.includes("failed to fetch") || 
        msg.includes("gateway error") ||
        msg.includes("aborted") ||
        msg.includes("timeout");
      
      if (!isNetworkError || attempt >= 2) {
        throw error;
      }
      
      attempt++;
      console.log(`[Network] Offline/Gateway error. Retry attempt ${attempt} for ${url} in ${delayMs}ms`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Translates a text message using the secure server translation gateway.
 * Integrates local cache checks to save API quota.
 */
export async function translateText(text, targetLang) {
  if (!text || !text.trim()) return "";

  const cacheKey = `trans_cache_${targetLang}_${text.trim().toLowerCase()}`;

  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      console.log("[Translation Cache] Hit for:", text);
      return cached;
    }
  } catch (e) {
    console.warn("Cache read error:", e);
  }

  try {
    const response = await fetchWithRetry(`${BASE_URL}/api/translate`, {
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
      throw new Error(await readErrorMessage(response));
    }

    const data = await response.json();
    const result = data.translatedText || "";

    if (result) {
      AsyncStorage.setItem(cacheKey, result).catch((err) =>
        console.warn("Cache write error:", err),
      );
    }

    return result;
  } catch (error) {
    console.error("Text translation service error:", error);
    return `[Translation Failed: ${error.message}] ${text}`;
  }
}



/**
 * Transcribes and translates a voice recording file using the secure backend gateway.
 */
export async function translateVoice(audioUri, targetLang) {
  if (!audioUri) throw new Error("No audio URI provided");

  try {
    if (Platform.OS === 'web') {
      const formData = new FormData();
      const fetchResponse = await fetch(audioUri);
      const blob = await fetchResponse.blob();
      formData.append("audio", blob, "recording.m4a");
      formData.append("targetLang", targetLang);

      const response = await fetchWithRetry(`${BASE_URL}/api/translate-voice`, {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = await response.json();
      return {
        transcription: data.transcription || "",
        translation: data.translation || "",
      };
    } else {
      // Use expo-file-system for Native uploads to avoid FormData polyfill issues
      let fileUri = audioUri;
      if (!fileUri.startsWith('file://') && !fileUri.startsWith('content://') && !fileUri.startsWith('http')) {
        fileUri = 'file://' + fileUri;
      }

      // We cannot easily use fetchWithRetry here, so we do a standard upload
      const response = await FileSystem.uploadAsync(`${BASE_URL}/api/translate-voice`, fileUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'audio',
        mimeType: 'audio/m4a',
        parameters: {
          targetLang: targetLang,
        },
      });

      if (response.status < 200 || response.status >= 300) {
        let errorMsg = `Upload failed with status ${response.status}`;
        try {
          const body = JSON.parse(response.body);
          if (body.error) errorMsg = body.error;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      const data = JSON.parse(response.body);
      return {
        transcription: data.transcription || "",
        translation: data.translation || "",
      };
    }
  } catch (error) {
    console.error("Voice translation service error:", error);
    throw error;
  }
}

/**
 * Sends a message to the Unity AI companion.
 */
export async function chatWithAI(message, history, language) {
  if (!message || !message.trim()) return "";

  try {
    const response = await fetchWithRetry(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        history: history || [],
        language: language || "en",
      }),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const data = await response.json();
    return data.replyText || data.reply || "";
  } catch (error) {
    console.error("AI chat service error:", error);
    return `[AI Error: ${error.message}]`;
  }
}
