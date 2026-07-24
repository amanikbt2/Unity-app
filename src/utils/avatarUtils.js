export const DEFAULT_AVATARS = [
  require("../../assets/default-avatar-1.jpg"),
  require("../../assets/default-avatar-2.jpg"),
  require("../../assets/default-avatar-3.jpg"),
];

export function getSafeAvatarSource(avatar, seed = "User") {
  if (typeof avatar === "number") {
    return avatar;
  }
  if (avatar && typeof avatar === "object" && avatar.uri) {
    return getSafeAvatarSource(avatar.uri, seed);
  }
  if (typeof avatar === "string" && avatar.trim()) {
    const s = avatar.trim();
    if (
      s.startsWith("http://") ||
      s.startsWith("https://") ||
      s.startsWith("data:") ||
      s.startsWith("file:") ||
      s.startsWith("blob:")
    ) {
      return { uri: s };
    }
  }
  // Fallback to deterministic default avatar asset
  const str = typeof seed === "string" ? seed : "User";
  const charCodeSum = str.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const idx = Math.abs(charCodeSum) % DEFAULT_AVATARS.length;
  return DEFAULT_AVATARS[idx];
}
