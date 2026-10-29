import { CircleUserIcon } from "lucide-react";
import { useState } from "react";

import { useMiraAccess } from "~/cloud/miraChat";
import { Button } from "../ui/button";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { AgenticUpgradeDialog } from "./AgenticUpgradeDialog";

/** Who is signed in and on which plan, with the way up to Pro; sign-in without an account. */
export function SidebarAccountRow() {
  const access = useMiraAccess();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  if (!access.signedIn) {
    if (access.openSignIn === null) return null;
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton onClick={access.openSignIn}>
            <CircleUserIcon />
            <span>Autentifică-te sau creează cont</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }
  const account = access.account;
  if (account === null) return null;
  const name = account.email ?? "Contul tău";
  return (
    <div className="flex items-center gap-2.5 px-2 py-1">
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
      >
        {name.charAt(0).toLocaleUpperCase("ro-RO")}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-sidebar-foreground">{name}</p>
        <p className="truncate text-xs text-sidebar-muted-foreground">Plan {account.plan.name}</p>
      </div>
      {account.plan.agenticEnabled ? null : (
        <Button size="xs" variant="secondary" onClick={() => setUpgradeOpen(true)}>
          Treci la Pro
        </Button>
      )}
      <AgenticUpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
