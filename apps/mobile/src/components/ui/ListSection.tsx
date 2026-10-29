import { MOBILE_SHAPE } from "../../lib/designTokens";
import { Children, Fragment, isValidElement, type ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { AppText as Text } from "./AppText";

export function ListSection(props: {
  readonly title?: string;
  readonly titleIcon?: ReactNode;
  readonly trailing?: ReactNode;
  readonly children: ReactNode;
  readonly footer?: string;
}) {
  return (
    <View className="gap-2">
      {props.title ? (
        <View className="flex-row items-center justify-between gap-3">
          <View
            className={
              Platform.OS === "android"
                ? "min-w-0 flex-1 flex-row items-center gap-2 px-4"
                : "min-w-0 flex-1 flex-row items-center gap-2 px-2"
            }
          >
            {props.titleIcon}
            <Text textRole="footnote" className="shrink font-t3-medium text-foreground-muted">
              {props.title}
            </Text>
          </View>
          {props.trailing}
        </View>
      ) : null}
      <View
        className="overflow-hidden border-continuous bg-grouped-card"
        style={{
          borderRadius:
            Platform.OS === "android" ? MOBILE_SHAPE.group.android : MOBILE_SHAPE.group.ios,
        }}
      >
        {/* Hairlines between rows, inset from the leading edge, as in iOS's grouped lists. */}
        {Children.toArray(props.children).map((child, index) => (
          <Fragment key={isValidElement(child) && child.key !== null ? child.key : index}>
            {index > 0 ? (
              <View className="ml-4 bg-border" style={{ height: StyleSheet.hairlineWidth }} />
            ) : null}
            {child}
          </Fragment>
        ))}
      </View>
      {props.footer ? (
        <Text textRole="footnote" className="px-4 text-foreground-muted">
          {props.footer}
        </Text>
      ) : null}
    </View>
  );
}
