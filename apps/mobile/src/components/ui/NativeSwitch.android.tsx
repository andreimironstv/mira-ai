import { useEffect } from "react";
import { Pressable } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { themeColorWithAlpha } from "../../lib/mobileTheme";
import type { ThemedSwitchProps } from "./NativeSwitch.types";

import { useControlTheme } from "./useControlTheme";

const TRACK_WIDTH = 51;
const TRACK_HEIGHT = 31;
const THUMB_SIZE = 27;
const THUMB_TRAVEL = TRACK_WIDTH - THUMB_SIZE - 4;

/** The iOS switch, drawn in React Native so Android shares its look: a capsule and a white thumb. */
export function NativeSwitch(props: ThemedSwitchProps) {
  const { colors } = useControlTheme();
  const on = Boolean(props.value);
  const progress = useSharedValue(on ? 1 : 0);
  // The muted foreground at a quarter strength reads as iOS's gray fill on light and dark pages.
  const offTrack = themeColorWithAlpha(colors["--color-switch-inactive-thumb"], 0.25);
  const onTrack = colors["--color-switch-active-track"];

  useEffect(() => {
    progress.set(withTiming(on ? 1 : 0, { duration: 180 }));
  }, [on, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], [offTrack, onTrack]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.get() * THUMB_TRAVEL }],
  }));

  return (
    <Pressable
      disabled={props.disabled}
      onPress={() => props.onValueChange?.(!on)}
      accessibilityLabel={props.accessibilityLabel}
      accessibilityHint={props.accessibilityHint}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled: Boolean(props.disabled) }}
      hitSlop={8}
      style={[{ opacity: props.disabled ? 0.45 : 1 }, props.style]}
      testID={props.testID}
    >
      <Animated.View
        style={[
          { width: TRACK_WIDTH, height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT / 2, padding: 2 },
          trackStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              width: THUMB_SIZE,
              height: THUMB_SIZE,
              borderRadius: THUMB_SIZE / 2,
              backgroundColor: "#ffffff",
              elevation: 2,
            },
            thumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}
