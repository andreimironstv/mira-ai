import { passkeys } from "@clerk/electron/passkeys";
import { ClerkProvider } from "@clerk/electron/react";
import type { ReactNode } from "react";

import { MiraAccountSync } from "../../cloud/MiraAccountSync";
import { ManagedRelayAuthProvider } from "../../cloud/managedAuth";
import { AppAtomRegistryProvider } from "../../rpc/atomRegistry";
import { clerkAppearance } from "./clerkAppearance";

/** Load only lazily inside desktop; clerk-js is statically bundled and would otherwise enter every
 * client's startup graph. */
export default function ElectronManagedAuthShell({
  publishableKey,
  children,
}: {
  readonly publishableKey: string;
  readonly children: ReactNode;
}) {
  return (
    <ClerkProvider appearance={clerkAppearance} publishableKey={publishableKey} passkeys={passkeys}>
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
