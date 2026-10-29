import { useState, type ReactNode } from "react";
import { View } from "react-native";

import type { AppSymbolName } from "./AppSymbol";
import { AppText as Text } from "./AppText";
import { AndroidAnchoredMenu } from "./AndroidAnchoredMenu";
import { RoundIconButton } from "./RoundIconButton";
import { splitAndroidHeaderActions } from "./headerMenu.android";
import { useToolbarLayout } from "./useToolbarLayout";

export interface AndroidHeaderAction {
  readonly accessibilityLabel: string;
  readonly icon: AppSymbolName;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly selected?: boolean;
  readonly destructive?: boolean;
  readonly overflowOnly?: boolean;
}

export function AndroidHeaderIconButton(props: {
  readonly accessibilityLabel: string;
  readonly icon: AppSymbolName;
  readonly onPress?: () => void;
  readonly disabled?: boolean;
  readonly selected?: boolean;
}) {
  return <RoundIconButton {...props} />;
}

/**
 * Mira's header, as on iOS: a top-level screen gets a large title under its round action
 * buttons; a pushed screen a round back button and a centered title. It draws on the screen's
 * own surface, so there is no app bar band.
 */
export function AndroidScreenHeader(props: {
  readonly title: string;
  readonly titleContent?: ReactNode;
  readonly subtitle?: string | null;
  readonly actions?: ReadonlyArray<AndroidHeaderAction>;
  readonly leading?: ReactNode;
  readonly trailing?: ReactNode;
  readonly onBack?: () => void;
  readonly embedded?: boolean;
  readonly hideBottomBorder?: boolean;
  /** One row with the subtitle after the title, for screens short on height. */
  readonly compact?: boolean;
}) {
  const { paddingTop } = useToolbarLayout(props.embedded);
  const [headerWidth, setHeaderWidth] = useState(0);
  const { visibleActions, overflowActions } = splitAndroidHeaderActions(
    props.actions ?? [],
    headerWidth >= 600,
  );
  const large =
    props.onBack === undefined &&
    !props.embedded &&
    !props.compact &&
    props.titleContent === undefined;
  const hasActions = visibleActions.length > 0 || overflowActions.length > 0 || props.trailing;
  const actions = hasActions ? (
    <View collapsable={false} className="flex-row items-center gap-2.5">
      {visibleActions.map((action) => (
        <RoundIconButton
          key={action.accessibilityLabel}
          accessibilityLabel={action.accessibilityLabel}
          icon={action.icon}
          disabled={action.disabled}
          loading={action.loading}
          selected={action.selected}
          onPress={action.onPress}
        />
      ))}
      {overflowActions.length > 0 ? (
        <AndroidAnchoredMenu
          actions={overflowActions.map((action, index) => ({
            id: String(index),
            title: action.accessibilityLabel,
            attributes: {
              disabled: Boolean(action.disabled),
              destructive: action.destructive,
              state: action.selected ? "on" : undefined,
            },
          }))}
          onPressAction={({ nativeEvent }) => overflowActions[Number(nativeEvent.event)]?.onPress()}
        >
          {(open) => (
            <RoundIconButton
              accessibilityLabel="Mai multe acțiuni"
              icon="ellipsis"
              onPress={open}
            />
          )}
        </AndroidAnchoredMenu>
      ) : null}
      {props.trailing}
    </View>
  ) : null;

  return (
    <View
      onLayout={(event) => setHeaderWidth(event.nativeEvent.layout.width)}
      className="px-4"
      style={{ paddingTop, paddingBottom: large ? 6 : 8 }}
    >
      <View className="min-h-[52px] flex-row items-center gap-3">
        {props.onBack ? (
          <RoundIconButton accessibilityLabel="Înapoi" icon="chevron.left" onPress={props.onBack} />
        ) : null}
        {props.leading}
        {large ? (
          <View className="flex-1" />
        ) : (
          <View className="min-w-0 flex-1 items-center justify-center">
            {props.titleContent ?? (
              <>
                <Text
                  accessibilityRole="header"
                  className="font-t3-semibold text-[17px] leading-[22px] text-foreground"
                  numberOfLines={1}
                >
                  {props.title}
                </Text>
                {props.subtitle ? (
                  <Text className="text-xs text-foreground-secondary" numberOfLines={1}>
                    {props.subtitle}
                  </Text>
                ) : null}
              </>
            )}
          </View>
        )}
        {/* Balance the back button so the title stays centered. */}
        {actions ?? (props.onBack && !large ? <View className="size-11" /> : null)}
      </View>
      {large ? (
        <View className="pt-1">
          <Text
            accessibilityRole="header"
            className="font-t3-bold text-[34px] leading-[41px] text-foreground"
            numberOfLines={1}
          >
            {props.title}
          </Text>
          {props.subtitle ? (
            <Text className="text-sm text-foreground-secondary" numberOfLines={1}>
              {props.subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function AndroidSheetHeader(
  props: Omit<Parameters<typeof AndroidScreenHeader>[0], "embedded">,
) {
  return <AndroidScreenHeader {...props} embedded />;
}
