import type * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

import { ENVIRONMENTS_CHANGED_MESSAGE } from "./AccountEvents.ts";

/** One per account: holds its clients' sockets (hibernated while idle) and fans out changes. */
export class AccountEventsObject extends Cloudflare.DurableObject<
  AccountEventsObject,
  {
    readonly environmentsChanged: () => Effect.Effect<void, never, Alchemy.RuntimeContext>;
  }
>()("AccountEventsObject") {}

export const layer = AccountEventsObject.make(
  Effect.gen(function* () {
    const state = yield* Cloudflare.DurableObjectState;
    // @effect-diagnostics-next-line returnEffectInGen:off
    return Effect.gen(function* () {
      return {
        fetch: Effect.gen(function* () {
          const [response] = yield* Cloudflare.upgrade();
          return response;
        }),
        environmentsChanged: Effect.fn("AccountEventsObject.environmentsChanged")(function* () {
          for (const socket of yield* state.getWebSockets()) {
            yield* socket.send(ENVIRONMENTS_CHANGED_MESSAGE).pipe(Effect.ignoreCause);
          }
        }),
        // Clients ping to keep proxies from dropping an idle socket.
        webSocketMessage: (socket: Cloudflare.WebSocket, message: string | ArrayBuffer) =>
          message === "ping" ? socket.send("pong") : Effect.void,
      };
    });
  }),
);
