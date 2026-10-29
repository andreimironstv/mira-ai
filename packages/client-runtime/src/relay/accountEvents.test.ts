import { describe, expect, it, vi } from "vite-plus/test";

import { accountEventsUrl, watchAccountEvents } from "./accountEvents.ts";

function fakeSockets() {
  const sockets: Array<{
    url: string;
    onopen: (() => void) | null;
    onmessage: ((event: { readonly data: unknown }) => void) | null;
    onclose: (() => void) | null;
    send: (data: string) => void;
    close: () => void;
  }> = [];
  const createSocket = (url: string) => {
    const socket = {
      url,
      onopen: null,
      onmessage: null,
      onclose: null,
      send: () => {},
      close: () => {},
    };
    sockets.push(socket);
    return socket;
  };
  return { sockets, createSocket };
}

describe("accountEventsUrl", () => {
  it("turns the relay origin into a socket URL carrying the token", () => {
    expect(accountEventsUrl("https://relay.example.com", "a.b.c")).toBe(
      "wss://relay.example.com/v1/account/events?token=a.b.c",
    );
  });
});

describe("watchAccountEvents", () => {
  it("reports relay changes, and a possibly missed one after reconnecting", async () => {
    vi.useFakeTimers();
    try {
      const { sockets, createSocket } = fakeSockets();
      const onEnvironmentsChanged = vi.fn();
      const stop = watchAccountEvents({
        relayUrl: "https://relay.example.com",
        readToken: async () => "token",
        onEnvironmentsChanged,
        createSocket,
      });
      await vi.advanceTimersByTimeAsync(0);
      sockets[0]!.onopen?.();
      expect(onEnvironmentsChanged).not.toHaveBeenCalled();

      sockets[0]!.onmessage?.({ data: "pong" });
      sockets[0]!.onmessage?.({ data: "environments-changed" });
      expect(onEnvironmentsChanged).toHaveBeenCalledTimes(1);

      sockets[0]!.onclose?.();
      await vi.advanceTimersByTimeAsync(1_000);
      expect(sockets).toHaveLength(2);
      sockets[1]!.onopen?.();
      expect(onEnvironmentsChanged).toHaveBeenCalledTimes(2);

      stop();
      sockets[1]!.onclose?.();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(sockets).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits for a token before connecting", async () => {
    vi.useFakeTimers();
    try {
      const { sockets, createSocket } = fakeSockets();
      let token: string | null = null;
      const stop = watchAccountEvents({
        relayUrl: "https://relay.example.com",
        readToken: async () => token,
        onEnvironmentsChanged: () => {},
        createSocket,
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(sockets).toHaveLength(0);
      token = "token";
      await vi.advanceTimersByTimeAsync(1_000);
      expect(sockets).toHaveLength(1);
      stop();
    } finally {
      vi.useRealTimers();
    }
  });
});
