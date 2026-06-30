export const trackEvent = async (event, user, details = {}) => {
  try {
    // Send event asynchronously (fire and forget)
    // Using localhost for android emulator/development
    const backendUrl = "http://10.0.2.2:3000/api/track"; 
    
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
      // In case we are running on web instead of Android emulator, try localhost
      if (err.message.includes("Network request failed")) {
        fetch("http://localhost:3000/api/track", {
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
