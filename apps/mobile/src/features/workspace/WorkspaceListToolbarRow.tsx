import type { ReactNode } from "react";
import { View } from "react-native";
import { AndroidHeaderIconButton } from "../../components/ui/AndroidScreenHeader";
import { AppText as Text } from "../../components/ui/AppText";
import { WorkspaceConnectionTitle } from "../home/WorkspaceConnectionTitle";

/**
 * Android's header over each workspace tab's list. Plain React Native, not the Compose app bar:
 * a hidden tab lays out at zero size, and Compose-hosted content takes several frames to measure
 * again when the tab comes back.
 */
export function WorkspaceListToolbarRow(props: {
  readonly title: string;
  readonly searching: boolean;
  readonly searchField: ReactNode;
  readonly onCloseSearch: () => void;
  readonly onOpenSearch: () => void;
  readonly searchAccessibilityLabel: string;
  readonly titleAccessibilityLabel: string;
  readonly onOpenEnvironments: () => void;
  /** Stays trailing while searching, so it never moves and still narrows the results. */
  readonly filter: ReactNode;
}) {
  if (props.searching) {
    return (
      <View className="min-h-[52px] flex-row items-center gap-2.5">
        <AndroidHeaderIconButton
          accessibilityLabel="Închide căutarea"
          icon="chevron.left"
          onPress={props.onCloseSearch}
        />
        {props.searchField}
        {props.filter}
      </View>
    );
  }
  return (
    <View>
      <View className="min-h-[52px] flex-row items-center justify-end gap-2.5">
        <AndroidHeaderIconButton
          accessibilityLabel={props.searchAccessibilityLabel}
          icon="magnifyingglass"
          onPress={props.onOpenSearch}
        />
        {props.filter}
      </View>
      <View className="flex-row pt-1">
        {/* A dropped connection shows here in place of the title, as before. */}
        <WorkspaceConnectionTitle
          grow
          onPress={props.onOpenEnvironments}
          brand={
            <Text
              accessibilityRole="header"
              accessibilityLabel={props.titleAccessibilityLabel}
              className="font-t3-bold text-[34px] leading-[41px] text-foreground"
              numberOfLines={1}
            >
              {props.title}
            </Text>
          }
        />
      </View>
    </View>
  );
}
