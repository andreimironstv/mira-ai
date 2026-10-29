import * as Context from "effect/Context";
import * as Effect from "effect/Effect";

export const ACCOUNT_EVENTS_PATH = "/v1/account/events";
export const ENVIRONMENTS_CHANGED_MESSAGE = "environments-changed";

export const isAccountEventsPath = (url: string): boolean =>
  url === ACCOUNT_EVENTS_PATH || url.startsWith(`${ACCOUNT_EVENTS_PATH}?`);

/** Tells an account's open clients to re-read its computers; best effort, never fails a request. */
export class AccountEvents extends Context.Reference<{
  readonly environmentsChanged: (userId: string) => Effect.Effect<void>;
}>("t3code-relay/account/AccountEvents", {
  defaultValue: () => ({ environmentsChanged: () => Effect.void }),
}) {}
