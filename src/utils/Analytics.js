function sanitizeDetails(details) {
  if (!details || typeof details !== "object") return {};
  const clean = {};
  for (const key in details) {
    if (Object.prototype.hasOwnProperty.call(details, key)) {
      const val = details[key];
      const type = typeof val;
      if (type === "string" || type === "number" || type === "boolean" || val === null) {
        clean[key] = val;
      } else if (type === "object") {
        if (
          val.nativeEvent ||
          val._reactName ||
          val.navigation ||
          val.dispatch ||
          val.state ||
          val.currentTarget
        ) {
          clean[key] = "[Non-Serializable Object]";
        } else {
          try {
            clean[key] = JSON.parse(JSON.stringify(val));
          } catch {
            clean[key] = "[Non-Serializable Object]";
          }
        }
      }
    }
  }
  return clean;
}

function safeStringify(obj) {
  const cache = new Set();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (cache.has(value)) {
        return "[Circular]";
      }
      cache.add(value);
    }
    return value;
  });
}

export const trackEvent = async (event, user, details = {}) => {
  try {
    // Send event asynchronously (fire and forget)
    const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";
    const backendUrl = `${API_URL}/api/track`;
    
    const bodyPayload = safeStringify({
      event,
      user: user?.name || user?.email || "Anonymous",
      details: sanitizeDetails(details)
    });

    // Attempt standard fetch (for web) and fallback for React Native android 10.0.2.2 
    fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: bodyPayload
    }).catch((err) => {
      // In case we are running on web instead of Android emulator, try the fallback
      if (err.message.includes("Network request failed")) {
        const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";
        fetch(`${API_URL}/api/track`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: bodyPayload
        }).catch(() => {}); // silent fail for tracking
      }
    });
  } catch (error) {
    // Silently fail, tracking shouldn't break the app
    console.log("Tracking error:", error);
  }
};
