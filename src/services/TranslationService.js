import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";

async function readErrorMessage(response) {
  try {
    const data = await response.json();
    return data.details || data.error || `Server returned HTTP ${response.status}`;
  } catch {
    return `Server returned HTTP ${response.status}`;
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
    const formData = new FormData();

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
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
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

/**
 * Sends a message to the Unity AI companion.
 */
export async function chatWithAI(message, history, language) {
  if (!message || !message.trim()) return "";

  try {
    const response = await fetch(`${BASE_URL}/api/chat`, {
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
    return data.reply || "";
  } catch (error) {
    console.error("AI chat service error:", error);
    return `[AI Error: ${error.message}]`;
  }
}
