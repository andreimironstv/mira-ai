// @effect-diagnostics globalTimers:off - Plain socket lifecycle for React effects, outside an Effect runtime.
const PING_INTERVAL_MS = 30_000;
const MIN_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

interface AccountEventsSocket {
  onopen: (() => void) | null;
  onmessage: ((event: { readonly data: unknown }) => void) | null;
  onclose: (() => void) | null;
  send(data: string): void;
  close(): void;
}

function nativeSocket(url: string): AccountEventsSocket {
  const ws = new WebSocket(url);
  const socket: AccountEventsSocket = {
    onopen: null,
    onmessage: null,
    onclose: null,
    send: (data) => ws.send(data),
    close: () => ws.close(),
  };
  ws.addEventListener("open", () => socket.onopen?.());
  ws.addEventListener("message", (event) => socket.onmessage?.({ data: event.data }));
  ws.addEventListener("close", () => socket.onclose?.());
  return socket;
}

export function accountEventsUrl(relayUrl: string, token: string): string {
  const url = new URL("v1/account/events", relayUrl.endsWith("/") ? relayUrl : `${relayUrl}/`);
  url.protocol = url.protocol === "http:" ? "ws:" : "wss:";
  url.searchParams.set("token", token);
  return url.toString();
}

/**
 * Keeps a live socket to the relay so another computer joining or leaving the account shows up
 * at once. Reconnects on its own; after a reconnect it reports a change, since one may have been
 * missed while offline. Returns a stop function.
 */
export function watchAccountEvents(input: {
  readonly relayUrl: string;
  readonly readToken: () => Promise<string | null>;
  readonly onEnvironmentsChanged: () => void;
  readonly createSocket?: (url: string) => AccountEventsSocket;
}): () => void {
  const createSocket = input.createSocket ?? nativeSocket;
  let stopped = false;
  let socket: AccountEventsSocket | null = null;
  let retryMs = MIN_RETRY_MS;
  let connectedBefore = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;

  const scheduleRetry = () => {
    if (stopped || retryTimer !== null) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void connect();
    }, retryMs);
    retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
  };

  const connect = async () => {
    const token = await input.readToken().catch(() => null);
    if (stopped) return;
    if (!token) return scheduleRetry();
    const next = createSocket(accountEventsUrl(input.relayUrl, token));
    socket = next;
    next.onopen = () => {
      retryMs = MIN_RETRY_MS;
      if (connectedBefore) input.onEnvironmentsChanged();
      connectedBefore = true;
      pingTimer = setInterval(() => next.send("ping"), PING_INTERVAL_MS);
    };
    next.onmessage = (event: { readonly data: unknown }) => {
      if (event.data === "environments-changed") input.onEnvironmentsChanged();
    };
    next.onclose = () => {
      if (pingTimer !== null) clearInterval(pingTimer);
      pingTimer = null;
      if (socket === next) socket = null;
      scheduleRetry();
    };
  };

  void connect();
  return () => {
    stopped = true;
    if (retryTimer !== null) clearTimeout(retryTimer);
    if (pingTimer !== null) clearInterval(pingTimer);
    socket?.close();
    socket = null;
  };
}
