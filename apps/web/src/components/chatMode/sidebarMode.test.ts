import { describe, expect, it } from "vite-plus/test";

import { sidebarModeForPath } from "./sidebarMode";

describe("sidebarModeForPath", () => {
  it("lists chats on chat pages and the agent's threads on its pages", () => {
    expect(sidebarModeForPath("/ask", true)).toBe("chat");
    expect(sidebarModeForPath("/ask/abc", true)).toBe("chat");
    expect(sidebarModeForPath("/env-1/thread-1", false)).toBe("agent");
    expect(sidebarModeForPath("/draft/d1", true)).toBe("agent");
  });

  it("opens home on chat until the plan includes the agent", () => {
    expect(sidebarModeForPath("/", false)).toBe("chat");
    expect(sidebarModeForPath("/", true)).toBe("agent");
  });

  it("leaves the mode to the page Settings and Usage were opened from", () => {
    expect(sidebarModeForPath("/settings/general", true)).toBeNull();
    expect(sidebarModeForPath("/usage", false)).toBeNull();
    expect(sidebarModeForPath("/pull-requests", true)).toBeNull();
  });
});
