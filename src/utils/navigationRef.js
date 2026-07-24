import { createRef } from "react";

/**
 * A shared navigation ref that lets code outside the React Navigation tree
 * (e.g. App.js global components) perform navigation actions.
 *
 * Usage:
 *   import { navigationRef, navigate } from "../utils/navigationRef";
 *   <NavigationContainer ref={navigationRef}>
 *   navigate("Conversation", { ... });
 */
export const navigationRef = createRef();

export function navigate(name, params) {
  if (navigationRef.current?.isReady()) {
    navigationRef.current.navigate(name, params);
  }
}
