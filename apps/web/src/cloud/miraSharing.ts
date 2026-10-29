// Per-account choices that keep automatic account sync from undoing what the user did.

const sharingOffKey = (accountId: string) => `mira:computer-sharing-off:${accountId}`;
// Environment ids are unique, so one list serves every account on this device.
const DISMISSED_KEY = "mira:dismissed-computers";
const MODEL_KEY_ACCOUNT_KEY = "mira:model-key-account";

/** The account whose model key Pi on this computer uses; a switch needs a key of its own. */
export function readModelKeyAccount(): string | null {
  return localStorage.getItem(MODEL_KEY_ACCOUNT_KEY);
}

export function setModelKeyAccount(accountId: string): void {
  localStorage.setItem(MODEL_KEY_ACCOUNT_KEY, accountId);
}

export function isComputerSharingOff(accountId: string): boolean {
  return localStorage.getItem(sharingOffKey(accountId)) === "1";
}

export function setComputerSharingOff(accountId: string, off: boolean): void {
  if (off) localStorage.setItem(sharingOffKey(accountId), "1");
  else localStorage.removeItem(sharingOffKey(accountId));
}

/** Computers the user removed; account sync does not add them back until the user does. */
export function readDismissedComputers(): ReadonlySet<string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

export function setComputerDismissed(environmentId: string, dismissed: boolean): void {
  const ids = new Set(readDismissedComputers());
  if (dismissed) ids.add(environmentId);
  else ids.delete(environmentId);
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}
