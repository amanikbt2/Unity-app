import React, { useState, useContext, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  LayoutAnimation,
  Platform,
  UIManager,
  ActivityIndicator,
  ScrollView,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { AppContext } from "../context/AppContext";
import UserProfilePopup from "../components/UserProfilePopup";
import {
  logAppOpen,
  logLoginClick,
  logLoginSuccess,
  logLoginFail,
} from "../services/LogService";

const DEFAULT_AVATAR_REQ = require("../../assets/default-avatar-2.jpg");

// Enable layout animation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function AuthScreen({ navigation }) {
  const getAssetUri = (asset) =>
    Image.resolveAssetSource ? Image.resolveAssetSource(asset).uri : asset;

  const DEFAULT_AVATAR = getAssetUri(DEFAULT_AVATAR_REQ);
  const {
    updateSettings,
    savedAccounts,
    loginAsSavedProfile,
    getLangDetails,
    getLangDetailsFromFlag,
  } = useContext(AppContext);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profilePopupVisible, setProfilePopupVisible] = useState(false);
  const [profilePopupData, setProfilePopupData] = useState(null);

  const goHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: "Home" }],
    });
  };

  useEffect(() => {
    GoogleSignin.configure({
      webClientId:
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "YOUR_WEB_CLIENT_ID",
      offlineAccess: true,
    });

    // Log app open — include name if a saved account exists
    const knownName =
      savedAccounts && savedAccounts.length > 0
        ? savedAccounts[0].name
        : null;
    logAppOpen(knownName);
  }, []);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    logLoginClick('google');
    console.log("[Google Signin] Initiating Google login flow...");

    const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";

    if (
      !process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID &&
      !process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
    ) {
      console.warn("[Google Signin] Bypassing Google login: Client IDs are missing/undefined. Falling back to mock mode.");
      // Mock mode fallback for testing immediately
      setTimeout(async () => {
        const mockEmail = "realuser@example.com";
        let existingProfile = null;
        try {
          console.log(`[Google Signin Mock] Checking if account exists for: ${mockEmail}...`);
          const checkRes = await fetch(`${API_URL}/api/users/email/${encodeURIComponent(mockEmail)}`);
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            if (checkData.exists && checkData.user) {
              existingProfile = checkData.user;
              console.log("[Google Signin Mock] Reusing existing profile:", existingProfile);
            }
          }
        } catch (err) {
          console.warn("[Google Signin Mock] Failed to query existing profile:", err);
        }

        if (existingProfile) {
          await updateSettings({
            ...existingProfile,
            isRealUser: true,
          });
        } else {
          await updateSettings({
            name: "Real User",
            email: mockEmail,
            avatar: DEFAULT_AVATAR,
            isRealUser: true,
          });
        }
        logLoginSuccess('google_mock', 'Real User', mockEmail);
        setGoogleLoading(false);
        goHome();
      }, 900);
      return;
    }

    try {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      const response = await GoogleSignin.signIn();

      if (!response || response.type !== "success") {
        setGoogleLoading(false);
        return;
      }

      const user =
        response.data?.user ?? response.data ?? response.user ?? null;
      if (!user) {
        throw new Error("Google sign-in returned no user data.");
      }

      // Check if user already exists in the backend by email
      let existingProfile = null;
      try {
        console.log(`[Google Signin] Checking if account exists for email: ${user.email}...`);
        const checkRes = await fetch(`${API_URL}/api/users/email/${encodeURIComponent(user.email)}`);
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.exists && checkData.user) {
            existingProfile = checkData.user;
            console.log("[Google Signin] Reusing existing profile from server:", existingProfile);
          }
        }
      } catch (err) {
        console.warn("[Google Signin] Failed to query existing profile:", err);
      }

      if (existingProfile) {
        await updateSettings({
          ...existingProfile,
          isRealUser: true,
        });
      } else {
        await updateSettings({
          name: user.name || "Google User",
          email: user.email,
          avatar: user.photo || DEFAULT_AVATAR,
          isRealUser: true,
        });
      }
      logLoginSuccess('google', user.name || 'Google User', user.email);
      goHome();
    } catch (error) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log("User cancelled the login flow");
        logLoginFail('google', 'cancelled');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log("Signing in");
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        console.log("Play services not available or outdated");
        alert("Play services not available on this device.");
        logLoginFail('google', 'play_services_unavailable');
      } else if (error.code === "10" || error.code === "DEVELOPER_ERROR") {
        console.error("Google Auth configuration error: ", error);
        alert(
          "Google Sign-In is not configured for this APK. Check that the Android OAuth client uses package com.amanikbt1.xaylite and this build's SHA-1 signing certificate.",
        );
        logLoginFail('google', `DEVELOPER_ERROR: ${error.message}`);
      } else {
        console.error("Google Auth Error: ", error);
        alert("Sign in failed: " + (error?.message || String(error)));
        logLoginFail('google', error?.message || String(error));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const toggleEmailPanel = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowEmailPanel(!showEmailPanel);
  };

  const openProfilePopup = (profile) => {
    setProfilePopupData(profile);
    setProfilePopupVisible(true);
  };

  const handleEmailContinue = async () => {
    logLoginClick('email');
    const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://unity-3xc2.onrender.com";

    // Secret developer account for quick access
    if (
      ((email === "dev@gmail.com" || email === "dev@mail.com") && password === "spiderman") ||
      ((email === "admin" || email === "admin@gmail.com") && password === "admin")
    ) {
      const devEmail = email.includes("admin") ? "admin@gmail.com" : "dev@gmail.com";
      const devName = email.includes("admin") ? "Admin" : "Mr Man";
      
      let existingProfile = null;
      try {
        console.log(`[Developer Login] Checking if account exists for: ${devEmail}...`);
        const checkRes = await fetch(`${API_URL}/api/users/email/${encodeURIComponent(devEmail)}`);
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.exists && checkData.user) {
            existingProfile = checkData.user;
            console.log("[Developer Login] Reusing existing profile:", existingProfile);
          }
        }
      } catch (err) {
        console.warn("[Developer Login] Failed to query existing profile:", err);
      }

      if (existingProfile) {
        await updateSettings({
          ...existingProfile,
          isRealUser: true,
        });
      } else {
        await updateSettings({
          name: devName,
          email: devEmail,
          bio: devEmail === 'dev@gmail.com' ? 'System Administrator' : '',
          avatar: DEFAULT_AVATAR,
          isRealUser: true,
        });
      }

      logLoginSuccess('email', devName, devEmail);
      goHome();
      return;
    }

    // All other email attempts should fail unless an account was created
    logLoginFail('email', 'wrong_credentials');
    alert("Wrong email or password");
  };

  return (
    <LinearGradient colors={["#EEF2F6", "#F8FAFC"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.topContainer}>
            {/* Logo container */}
            <View style={styles.logoWrapper}>
              <Image
                source={require("../../assets/auth-bird-logo.png")}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.appTitle}>Xaylite</Text>
            <Text style={styles.appTagline}>
              Talk to anyone, in any language instantly
            </Text>
          </View>

          <View style={styles.bottomContainer}>
          {savedAccounts && savedAccounts.length > 0 && (
            <View style={styles.savedAccountsContainer}>
              <Text style={styles.savedAccountsTitle}>Tap to log in</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.savedAccountsScroll}
              >
                {savedAccounts.map((account, index) => (
                  <TouchableOpacity
                    key={account.email || index.toString()}
                    style={styles.savedAccountItem}
                    onPress={async () => {
                      logLoginClick('saved_profile');
                      setGoogleLoading(true);
                      await loginAsSavedProfile(account);
                      logLoginSuccess('saved_profile', account.name, account.email);
                      setGoogleLoading(false);
                      goHome();
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.savedAccountAvatarContainer}>
                      <Image
                        source={typeof account.avatar === "number" ? account.avatar : { uri: account.avatar }}
                        style={styles.savedAccountAvatar}
                      />
                      {account.status &&
                        /online|available|ready to chat|connected|active/i.test(
                          account.status,
                        ) && <View style={styles.onlineBadge} />}
                    </View>
                    <Text style={styles.savedAccountName} numberOfLines={1}>
                      {(account.name || "Account").split(" ")[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Google Login Button */}
          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGoogleLogin}
            disabled={googleLoading}
            activeOpacity={0.8}
          >
            {googleLoading ? (
              <ActivityIndicator color="#4F46E5" />
            ) : (
              <View style={styles.btnContent}>
                {/* SVG Google Icon */}
                <Svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  style={styles.googleIcon}
                >
                  <Path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <Path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <Path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.87-2.6-2.87-4.53-5.84-4.53z"
                    fill="#FBBC05"
                  />
                  <Path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    fill="#EA4335"
                  />
                </Svg>
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Apple Login Button */}
          <TouchableOpacity
            style={styles.appleBtn}
            onPress={() =>
              alert("Apple signup not configured, use google instead")
            }
            activeOpacity={0.8}
          >
            <View style={styles.btnContent}>
              <Svg
                width="18"
                height="22"
                viewBox="0 0 18 22"
                style={styles.appleIcon}
              >
                <Path
                  d="M15.45 10.95c.02-2.52 2.06-3.73 2.15-3.79-1.18-1.72-3.01-1.95-3.66-2.01-1.56-.16-3.05.92-3.84.92-.79 0-2.04-.9-3.37-.87-1.75.03-3.37 1.02-4.27 2.59-1.82 3.16-.47 7.82 1.3 10.37.86 1.25 1.88 2.65 3.23 2.6 1.3-.05 1.79-.84 3.36-.84s2.02.84 3.38.81c1.39-.03 2.28-1.26 3.13-2.5 1-.1.97-1.43 1.95-2.85 1.01-1.47 1.03-1.5 1.03-1.51-.02-.01-1.98-.76-1.96-3.08zM12.98 2.76c.7-1.07 1.17-2.55.94-4.02-1.27.05-2.81.84-3.72 1.9-1.53 1.76-1.39 3.27-1.39 3.27.14.02.28.02.43.02 1.14 0 2.58-.69 3.74-2.17z"
                  fill="white"
                />
              </Svg>
              <Text style={styles.appleBtnText}>Continue with Apple</Text>
            </View>
          </TouchableOpacity>

          {/* More options collapsible panel */}
          <View style={styles.moreOptionsContainer}>
            <TouchableOpacity onPress={toggleEmailPanel}>
              <Text style={styles.moreOptionsText}>
                {showEmailPanel ? "Fewer options" : "More options"}
              </Text>
            </TouchableOpacity>

            {showEmailPanel && (
              <View style={styles.emailPanel}>
                <TextInput
                  placeholder="Email address"
                  placeholderTextColor="#64748B"
                  value={email}
                  onChangeText={setEmail}
                  style={styles.inputField}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TextInput
                  placeholder="Password"
                  placeholderTextColor="#64748B"
                  value={password}
                  onChangeText={setPassword}
                  style={styles.inputField}
                  secureTextEntry
                />
                <TouchableOpacity
                  style={styles.emailSubmitBtn}
                  onPress={handleEmailContinue}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={["#4F46E5", "#7C3AED"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.emailSubmitGradient}
                  >
                    <Text style={styles.emailSubmitText}>
                      Continue with Email
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <Text style={styles.termsText}>
            By continuing, you agree to our{" "}
            <Text style={styles.termsLink}>Terms</Text> and{" "}
            <Text style={styles.termsLink}>Privacy Policy</Text>.
          </Text>
          </View>
        </ScrollView>
      </SafeAreaView>

      <UserProfilePopup
        visible={profilePopupVisible}
        profile={profilePopupData}
        onClose={() => setProfilePopupVisible(false)}
        colors={{
          bg: "#F8FAFC",
          cardBg: "#FFFFFF",
          border: "rgba(0, 0, 0, 0.05)",
          text: "#0F172A",
          textMuted: "#475569",
          textDimmed: "#64748B",
          primary: "#4F46E5",
        }}
        getLangDetails={getLangDetails}
        getLangDetailsFromFlag={getLangDetailsFromFlag}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: "space-between",
  },
  topContainer: {
    alignItems: "center",
    marginTop: 60,
  },
  logoWrapper: {
    width: 92,
    height: 92,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 8,
  },
  logoImage: {
    width: 92,
    height: 92,
  },
  appTitle: {
    fontFamily: Platform.OS === "ios" ? "Outfit" : "sans-serif-medium",
    fontSize: 38,
    fontWeight: "800",
    marginTop: 16,
    letterSpacing: -0.5,
    color: "#0F172A",
  },
  appTagline: {
    fontSize: 17,
    color: "#475569",
    textAlign: "center",
    marginTop: 10,
    maxWidth: 250,
    lineHeight: 24,
  },
  bottomContainer: {
    width: "100%",
    marginBottom: 16,
  },
  googleBtn: {
    width: "100%",
    height: 56,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  googleIcon: {
    marginRight: 12,
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0F172A",
  },
  appleBtn: {
    width: "100%",
    height: 56,
    borderRadius: 16,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  appleIcon: {
    marginRight: 12,
  },
  appleBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  moreOptionsContainer: {
    alignItems: "center",
    marginTop: 20,
    width: "100%",
  },
  savedAccountsContainer: {
    width: "100%",
    marginBottom: 24,
    alignItems: "center",
  },
  savedAccountsTitle: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 16,
  },
  savedAccountsScroll: {
    paddingHorizontal: 16,
    gap: 16,
    justifyContent: "center",
    flexGrow: 1,
  },
  savedAccountItem: {
    alignItems: "center",
    width: 72,
  },
  savedAccountAvatarContainer: {
    position: "relative",
  },
  savedAccountAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "#4F46E5",
    marginBottom: 8,
  },
  savedAccountName: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  onlineBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  moreOptionsText: {
    fontSize: 14,
    color: "#475569",
    fontWeight: "500",
    paddingVertical: 8,
  },
  emailPanel: {
    width: "100%",
    marginTop: 10,
    gap: 10,
  },
  inputField: {
    width: "100%",
    height: 48,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#0F172A",
  },
  emailSubmitBtn: {
    width: "100%",
    height: 42,
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 4,
  },
  emailSubmitGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emailSubmitText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  termsText: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 20,
  },
  termsLink: {
    color: "#475569",
    fontWeight: "500",
    textDecorationLine: "underline",
  },
});
