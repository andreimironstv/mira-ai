import { isAppModalPage, isSidebarUtilityPage } from "../sidebar/mainAppLocation";

/** What the sidebar lists: chat-mode conversations, or the agent's threads. */
export type SidebarMode = "chat" | "agent";

/**
 * The mode a page belongs to; null for Settings, Usage and other utility pages, which keep the
 * mode of the page they were opened from. Home is the chat until the plan includes the agent.
 */
export function sidebarModeForPath(pathname: string, agentic: boolean): SidebarMode | null {
  if (isAppModalPage(pathname) || isSidebarUtilityPage(pathname)) return null;
  if (pathname === "/ask" || pathname.startsWith("/ask/")) return "chat";
  if (pathname === "/") return agentic ? "agent" : "chat";
  return "agent";
}
