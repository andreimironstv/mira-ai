// @effect-diagnostics globalDate:off - Chat labels follow the device's local calendar days, outside an Effect runtime.
import type { SaasChatConversation } from "@t3tools/contracts/saas";
import { chatVisualsAsText, splitChatVisuals } from "@t3tools/shared/htmlRender";

export interface ChatListSection {
  readonly title: string;
  readonly chats: ReadonlyArray<SaasChatConversation>;
}

const DAY_MS = 86_400_000;
const MAX_PREVIEW_LENGTH = 140;
// The app's words are Romanian, so its dates are too, whatever the device's language.
const LOCALE = "ro-RO";
const MONTH_FORMATTER = new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric" });
const TIME_FORMATTER = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit" });
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat(LOCALE, { weekday: "long" });
const DATE_FORMATTER = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

const startOfDay = (at: Date) => new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();
const capitalized = (text: string) => text.charAt(0).toLocaleUpperCase(LOCALE) + text.slice(1);

/** Chats, newest first, under Today, Yesterday, Previous 7 days, Previous 30 days, then months. */
export function chatListSections(
  chats: ReadonlyArray<SaasChatConversation>,
  now: Date,
): ReadonlyArray<ChatListSection> {
  const today = startOfDay(now);
  const sections: Array<{ title: string; chats: Array<SaasChatConversation> }> = [];
  for (const chat of chats) {
    const at = Date.parse(chat.updatedAt);
    const title =
      at >= today
        ? "Azi"
        : at >= today - DAY_MS
          ? "Ieri"
          : at >= today - 7 * DAY_MS
            ? "Ultimele 7 zile"
            : at >= today - 30 * DAY_MS
              ? "Ultimele 30 de zile"
              : capitalized(MONTH_FORMATTER.format(at));
    const last = sections.at(-1);
    if (last?.title === title) last.chats.push(chat);
    else sections.push({ title, chats: [chat] });
  }
  return sections;
}

/** As in Messages: the time today, then Yesterday, the weekday this week, and the date. */
export function chatTimeLabel(updatedAt: string, now: Date): string {
  const at = Date.parse(updatedAt);
  const today = startOfDay(now);
  if (at >= today) return TIME_FORMATTER.format(at);
  if (at >= today - DAY_MS) return "Ieri";
  if (at >= today - 6 * DAY_MS) return capitalized(WEEKDAY_FORMATTER.format(at));
  return DATE_FORMATTER.format(at);
}

const plainText = (markdown: string) =>
  markdown
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>#~|]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Mira's latest answer as one plain line; your question while she has not answered yet. */
export function chatPreview(chat: SaasChatConversation): string {
  const last =
    chat.messages.findLast((message) => message.role === "assistant") ?? chat.messages.at(-1);
  if (last === undefined) return "";
  // The words around a chart say more than its outline; the outline is the fallback.
  const words = splitChatVisuals(last.content)
    .flatMap((segment) => (segment.kind === "markdown" ? [segment.text] : []))
    .join(" ");
  return (
    plainText(words) ||
    plainText(chatVisualsAsText(last.content).replace(/^\[Visual: (.*)\]$/s, "$1")) ||
    last.attachments?.[0]?.name ||
    ""
  ).slice(0, MAX_PREVIEW_LENGTH);
}

const folded = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase(LOCALE);

/** Whether a chat's title or any message mentions the query, ignoring case and diacritics. */
export function chatMatchesQuery(chat: SaasChatConversation, query: string): boolean {
  const needle = folded(query.trim());
  if (needle === "") return true;
  return (
    folded(chat.title).includes(needle) ||
    chat.messages.some((message) => folded(message.content).includes(needle))
  );
}

const STAMP_GAP_MS = 60 * 60 * 1000;

/**
 * The time to show above a message: on the first one and wherever an hour passed since the one
 * before, as in Messages. Keyed by message id.
 */
export function chatMessageStamps(
  messages: ReadonlyArray<{ readonly id: string; readonly createdAt: string }>,
  now: Date,
): ReadonlyMap<string, string> {
  const stamps = new Map<string, string>();
  let previous = Number.NEGATIVE_INFINITY;
  for (const message of messages) {
    const at = Date.parse(message.createdAt);
    if (at - previous >= STAMP_GAP_MS) {
      const day = at >= startOfDay(now) ? "Azi" : chatTimeLabel(message.createdAt, now);
      stamps.set(message.id, `${day} ${TIME_FORMATTER.format(at)}`);
    }
    previous = at;
  }
  return stamps;
}

/** How many free messages are left today, in Romanian's plural forms. */
export function freeMessagesLabel(left: number): string {
  if (left <= 0) return "Mesajele gratuite de azi s-au terminat";
  if (left === 1) return "Un mesaj gratuit rămas azi";
  // Romanian puts "de" before counts from 20 up.
  return `${left}${left % 100 >= 20 || left % 100 === 0 ? " de" : ""} mesaje gratuite rămase azi`;
}
