// @effect-diagnostics globalDate:off - Fixtures in the device's local calendar, as the labels read it.
import type { SaasChatConversation } from "@t3tools/contracts/saas";
import { describe, expect, it } from "vite-plus/test";

import {
  chatListSections,
  chatMatchesQuery,
  chatMessageStamps,
  chatPreview,
  chatTimeLabel,
  freeMessagesLabel,
} from "./chatList.ts";

const chat = (id: string, updatedAt: string, content = "Hi"): SaasChatConversation => ({
  id,
  title: id,
  createdAt: updatedAt,
  updatedAt,
  messages: [{ id: `${id}-m`, role: "user", content, createdAt: updatedAt }],
});

describe("chatListSections", () => {
  it("groups chats by how long ago they were updated", () => {
    const now = new Date(2026, 9, 27, 21, 0);
    const at = (days: number) => new Date(2026, 9, 27 - days, 12, 0).toISOString();
    const sections = chatListSections(
      [
        chat("a", at(0)),
        chat("b", at(0)),
        chat("c", at(1)),
        chat("d", at(5)),
        chat("e", at(20)),
        chat("f", at(60)),
      ],
      now,
    );
    expect(
      sections.map((section) => [section.title, section.chats.map((item) => item.id)]),
    ).toEqual([
      ["Azi", ["a", "b"]],
      ["Ieri", ["c"]],
      ["Ultimele 7 zile", ["d"]],
      ["Ultimele 30 de zile", ["e"]],
      ["August 2026", ["f"]],
    ]);
  });
});

describe("chatTimeLabel", () => {
  it("reads like Messages: time today, then Yesterday, the weekday, and the date", () => {
    // Thursday, 29 October 2026.
    const now = new Date(2026, 9, 29, 21, 0);
    const at = (day: number, hour = 14) => new Date(2026, 9, day, hour, 32).toISOString();
    expect(chatTimeLabel(at(29), now)).toBe("14:32");
    expect(chatTimeLabel(at(28), now)).toBe("Ieri");
    expect(chatTimeLabel(at(26), now)).toBe("Luni");
    expect(chatTimeLabel(at(23), now)).toBe("Vineri");
    expect(chatTimeLabel(at(22), now)).toBe("22.10.2026");
  });
});

describe("chatPreview", () => {
  it("shows Mira's answer, and the question while she has not answered", () => {
    const asked = chat("b", "2026-10-27T00:00:00.000Z", "Cum e vremea?");
    expect(chatPreview(asked)).toBe("Cum e vremea?");
    const answered: SaasChatConversation = {
      ...asked,
      messages: [
        ...asked.messages,
        { id: "a", role: "assistant", content: "Plouă.", createdAt: "2026-10-27T00:00:01.000Z" },
        { id: "u", role: "user", content: "Și mâine?", createdAt: "2026-10-27T00:00:02.000Z" },
      ],
    };
    expect(chatPreview(answered)).toBe("Plouă.");
  });

  it("reads the message as plain words", () => {
    const content = "## Plan\n\n**Buy** [milk](https://x.test)\n\n````visual\n<p>Chart</p>\n````";
    expect(chatPreview(chat("a", "2026-10-27T00:00:00.000Z", content))).toBe(
      "Plan Buy milk [Visual: Chart]",
    );
  });
});

describe("chatMatchesQuery", () => {
  it("finds a chat by its title or messages, ignoring case and diacritics", () => {
    const factura = {
      ...chat("Factura de curent", "2026-10-27T00:00:00.000Z", "Plătesc în rate?"),
    };
    expect(chatMatchesQuery(factura, "factura")).toBe(true);
    expect(chatMatchesQuery(factura, "PLATESC")).toBe(true);
    expect(chatMatchesQuery(factura, "  ")).toBe(true);
    expect(chatMatchesQuery(factura, "ciorbă")).toBe(false);
  });
});

describe("chatMessageStamps", () => {
  it("stamps the first message and each one after an hour of quiet", () => {
    const now = new Date(2026, 9, 29, 21, 0);
    const at = (day: number, hour: number, minute: number) =>
      new Date(2026, 9, day, hour, minute).toISOString();
    const stamps = chatMessageStamps(
      [
        { id: "a", createdAt: at(28, 9, 10) },
        { id: "b", createdAt: at(28, 9, 11) },
        { id: "c", createdAt: at(29, 14, 28) },
        { id: "d", createdAt: at(29, 14, 30) },
      ],
      now,
    );
    expect([...stamps]).toEqual([
      ["a", "Ieri 09:10"],
      ["c", "Azi 14:28"],
    ]);
  });
});

describe("freeMessagesLabel", () => {
  it("counts in Romanian", () => {
    expect(freeMessagesLabel(0)).toBe("Mesajele gratuite de azi s-au terminat");
    expect(freeMessagesLabel(1)).toBe("Un mesaj gratuit rămas azi");
    expect(freeMessagesLabel(7)).toBe("7 mesaje gratuite rămase azi");
    expect(freeMessagesLabel(25)).toBe("25 de mesaje gratuite rămase azi");
  });
});
