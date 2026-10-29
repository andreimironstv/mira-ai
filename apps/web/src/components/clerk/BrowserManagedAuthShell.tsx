import { ClerkProvider } from "@clerk/react";
import type { ReactNode } from "react";

import { MiraAccountSync } from "../../cloud/MiraAccountSync";
import { ManagedRelayAuthProvider } from "../../cloud/managedAuth";
import { AppAtomRegistryProvider } from "../../rpc/atomRegistry";
import { clerkAppearance } from "./clerkAppearance";

/** Lazy-load Clerk so cloudless local mode never downloads it. */
export default function BrowserManagedAuthShell({
  publishableKey,
  children,
}: {
  readonly publishableKey: string;
  readonly children: ReactNode;
}) {
  return (
    <ClerkProvider appearance={clerkAppearance} publishableKey={publishableKey}>
      <ManagedRelayAuthProvider>
        {/* Rendered above AppRoot, so it needs the app registry to see the relay session. */}
        <AppAtomRegistryProvider>
          <MiraAccountSync />
        </AppAtomRegistryProvider>
        {children}
      </ManagedRelayAuthProvider>
    </ClerkProvider>
  );
}
