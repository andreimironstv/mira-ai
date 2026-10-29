import * as SecureStore from "expo-secure-store";

// SecureStore keys allow only letters, digits, ".", "-", and "_".
const DISMISSED_KEY = "mira.dismissedComputers";

/** Computers the user removed; account sync does not add them back until the user does. */
export async function readDismissedComputers(): Promise<ReadonlySet<string>> {
  try {
    const parsed: unknown = JSON.parse((await SecureStore.getItemAsync(DISMISSED_KEY)) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

export async function setComputerDismissed(environmentId: string, dismissed: boolean) {
  const ids = new Set(await readDismissedComputers());
  if (dismissed) ids.add(environmentId);
  else ids.delete(environmentId);
  await SecureStore.setItemAsync(DISMISSED_KEY, JSON.stringify([...ids]));
}
