import { Pressable, type PressableProps } from "react-native";

import { AppActivityIndicator } from "./AppActivityIndicator";
import { SymbolView, type AppSymbolName } from "./AppSymbol";

/**
 * The round, raised header button of Mira's design: iOS's glass header buttons, drawn the same
 * way on Android so both platforms share one look.
 */
export function RoundIconButton(
  props: Pick<PressableProps, "onPress" | "onLongPress" | "onTouchStart"> & {
    readonly accessibilityLabel: string;
    readonly icon: AppSymbolName;
    /** The accent tint, for the screen's main action. */
    readonly accent?: boolean;
    readonly selected?: boolean;
    readonly disabled?: boolean;
    readonly loading?: boolean;
  },
) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      accessibilityState={{ disabled: Boolean(props.disabled), selected: props.selected }}
      disabled={props.disabled || props.loading}
      hitSlop={4}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      onTouchStart={props.onTouchStart}
      className="size-11 items-center justify-center rounded-full bg-card active:opacity-70 disabled:opacity-45"
      style={{ elevation: 3 }}
    >
      {props.loading ? (
        <AppActivityIndicator colorClassName="accent-foreground" />
      ) : (
        <SymbolView
          name={props.icon}
          size={21}
          tintColorClassName={
            props.accent || props.selected ? "accent-primary" : "accent-foreground"
          }
          type="monochrome"
        />
      )}
    </Pressable>
  );
}
