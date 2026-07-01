export const trackEvent = async (event, user, details = {}) => {
  try {
    // Send event asynchronously (fire and forget)
    const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";
    const backendUrl = `${API_URL}/api/track`;
    
    // Attempt standard fetch (for web) and fallback for React Native android 10.0.2.2 
    fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        event,
        user: user?.name || user?.email || "Anonymous",
        details
      })
    }).catch((err) => {
      // In case we are running on web instead of Android emulator, try the fallback
      if (err.message.includes("Network request failed")) {
        const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";
        fetch(`${API_URL}/api/track`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            event,
            user: user?.name || user?.email || "Anonymous",
            details
          })
        }).catch(() => {}); // silent fail for tracking
      }
    });
  } catch (error) {
    // Silently fail, tracking shouldn't break the app
    console.log("Tracking error:", error);
  }
};
