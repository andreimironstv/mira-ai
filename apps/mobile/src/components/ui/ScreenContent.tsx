import type { ReactNode } from "react";
import { Platform, View } from "react-native";

/** Android's page body: flat on the screen under its header, as on iOS, with no raised sheet. */
export function ScreenContent({
  children,
  insetHorizontal = false,
  fitToContents = false,
}: {
  readonly children: ReactNode;
  readonly insetHorizontal?: boolean;
  readonly fitToContents?: boolean;
}) {
  if (Platform.OS !== "android") return children;

  return (
    <View
      className={fitToContents ? "shrink bg-screen" : "flex-1 bg-screen"}
      style={{ marginHorizontal: insetHorizontal ? 4 : 0 }}
    >
      {children}
    </View>
  );
}
