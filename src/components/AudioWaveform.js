import React, { useEffect, useMemo, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";

/**
 * AudioWaveform Component
 * Renders 7 rounded vertical visualizer bars that scale dynamically 
 * based on the real-time microphone metering level (in decibels).
 * Includes an organic sine-wave idle oscillation.
 */
export default function AudioWaveform({ metering = -160, isRecording = false, color = "#8B5CF6" }) {
  // Normalize decibel levels [-60, 0] to [0.1, 1.0] scale factor
  const normalizedLevel = Math.max(0.1, Math.min(1.0, (metering + 60) / 60));

  // Animating scale values for 7 bars
  const anims = useMemo(
    () => [
      new Animated.Value(0.1),
      new Animated.Value(0.1),
      new Animated.Value(0.1),
      new Animated.Value(0.1),
      new Animated.Value(0.1),
      new Animated.Value(0.1),
      new Animated.Value(0.1),
    ],
    []
  );

  // Track an internal oscillation phase
  const phaseRef = useRef(0);

  useEffect(() => {
    if (!isRecording) {
      // Idle / inactive state
      anims.forEach((anim) => {
        Animated.spring(anim, {
          toValue: 0.1,
          useNativeDriver: false,
          tension: 40,
          friction: 7,
        }).start();
      });
      return;
    }

    let active = true;
    const updateWave = () => {
      if (!active) return;

      phaseRef.current += 0.25;

      anims.forEach((anim, index) => {
        // Create a unique sine offset per bar for a fluid, floating wave effect
        const sineOffset = Math.sin(phaseRef.current + index * 0.8) * 0.15;
        // Compute target height: base normalized level + sine offset, clamped between 0.1 and 1.0
        const targetValue = Math.max(0.15, Math.min(1.0, normalizedLevel + sineOffset));

        Animated.timing(anim, {
          toValue: targetValue,
          duration: 90,
          useNativeDriver: false,
        }).start();
      });

      setTimeout(updateWave, 100);
    };

    updateWave();

    return () => {
      active = false;
    };
  }, [isRecording, normalizedLevel, anims]);

  // Base height factors for each bar to create a nice symmetric diamond shape
  const baseHeights = [15, 30, 45, 60, 45, 30, 15];

  return (
    <View style={styles.container}>
      {anims.map((anim, index) => {
        const heightVal = anim.interpolate({
          inputRange: [0.1, 1.0],
          outputRange: [6, baseHeights[index]],
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.bar,
              {
                height: heightVal,
                backgroundColor: color,
                // Make middle bars thicker for high-fidelity look
                width: index === 3 ? 5 : index === 2 || index === 4 ? 4.5 : 4,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 64,
    gap: 4,
    paddingHorizontal: 8,
  },
  bar: {
    borderRadius: 3,
  },
});
