import { Pressable, type PressableProps } from "react-native";

import { SymbolView, type AppSymbolName } from "../../components/ui/AppSymbol";

/**
 * The round, raised header button of the chat screens on Android, standing in for iOS's glass
 * buttons so both platforms share one look.
 */
export function ChatRoundButton(
  props: Pick<PressableProps, "onPress" | "onLongPress" | "onTouchStart"> & {
    readonly accessibilityLabel: string;
    readonly icon: AppSymbolName;
    readonly accent?: boolean;
  },
) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      hitSlop={4}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      onTouchStart={props.onTouchStart}
      className="size-11 items-center justify-center rounded-full bg-card active:opacity-70"
      style={{ elevation: 3 }}
    >
      <SymbolView
        name={props.icon}
        size={21}
        tintColorClassName={props.accent ? "accent-primary" : "accent-foreground"}
        type="monochrome"
      />
    </Pressable>
  );
}
