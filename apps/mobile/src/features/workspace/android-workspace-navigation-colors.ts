import {
  flattenThemeColor,
  themeColorWithAlpha,
  themeColorWithContrast,
  type MobileThemeVariables,
} from "../../lib/mobileTheme";

/**
 * The rail sits on the header surface. The bottom bar is a card-colored capsule floating on the
 * screen, as on iOS, with the selected tab in the accent color.
 */
export function androidWorkspaceNavigationColors(colors: MobileThemeVariables, rail: boolean) {
  const screen = colors["--color-screen"];
  const header = flattenThemeColor(colors["--color-header"], screen);
  const containerColor = rail ? header : flattenThemeColor(colors["--color-card"], screen);
  // The rail marks its tab with a pill alone; the bar mostly with the accent, over a faint tint.
  const indicatorColor = rail
    ? themeColorWithContrast(
        flattenThemeColor(colors["--color-secondary"], containerColor),
        containerColor,
        1.5,
      )
    : themeColorWithContrast(
        flattenThemeColor(themeColorWithAlpha(colors["--color-primary"], 0.1), containerColor),
        containerColor,
        1.1,
      );
  return {
    /** Behind the floating bar; the rail paints its own surface. */
    pageColor: rail ? header : flattenThemeColor(screen, screen),
    containerColor,
    indicatorColor,
    selectedColor: themeColorWithContrast(
      flattenThemeColor(
        rail ? colors["--color-secondary-foreground"] : colors["--color-primary"],
        indicatorColor,
      ),
      [indicatorColor, containerColor],
    ),
    unselectedColor: flattenThemeColor(
      rail ? colors["--color-header-foreground"] : colors["--color-foreground"],
      containerColor,
    ),
  };
}
