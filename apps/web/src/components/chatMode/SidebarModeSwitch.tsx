import { useLocation, useNavigate } from "@tanstack/react-router";
import { LockIcon } from "lucide-react";
import { useState } from "react";

import { hasAgenticAccess, useMiraAccess } from "~/cloud/miraChat";
import { lastMainAppPathname } from "../sidebar/mainAppLocation";
import { Toggle, ToggleGroup } from "../ui/toggle-group";
import { AgenticUpgradeDialog } from "./AgenticUpgradeDialog";
import { sidebarModeForPath, type SidebarMode } from "./sidebarMode";

/** The mode of the page on screen, or of the page Settings and Usage were opened from. */
export function useSidebarMode(): SidebarMode {
  const pathname = useLocation({ select: (location) => location.pathname });
  const agentic = hasAgenticAccess(useMiraAccess());
  return (
    sidebarModeForPath(pathname, agentic) ??
    sidebarModeForPath(lastMainAppPathname() ?? "/", agentic) ??
    (agentic ? "agent" : "chat")
  );
}

/** Chat answers on its own; Agent works on a connected computer and needs Pro. */
export function SidebarModeSwitch({
  mode,
  onNavigate,
}: {
  readonly mode: SidebarMode;
  readonly onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const locked = !hasAgenticAccess(useMiraAccess());
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  return (
    <div className="shrink-0 px-2 pb-1">
      <ToggleGroup
        aria-label="Mod"
        className="w-full"
        value={[mode]}
        onValueChange={(next) => {
          const picked = next[0];
          if (picked === "chat" && mode !== "chat") {
            onNavigate?.();
            void navigate({ to: "/ask" });
          } else if (picked === "agent" && mode !== "agent") {
            if (locked) {
              setUpgradeOpen(true);
              return;
            }
            onNavigate?.();
            void navigate({ to: "/" });
          }
        }}
      >
        <Toggle value="chat" className="flex-1">
          Chat
        </Toggle>
        <Toggle
          value="agent"
          className="flex-1"
          aria-label={locked ? "Agent, disponibil cu Pro" : "Agent"}
        >
          Agent
          {locked ? <LockIcon aria-hidden className="size-3" /> : null}
        </Toggle>
      </ToggleGroup>
      <AgenticUpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
