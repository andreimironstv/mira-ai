import type { LegendListRef } from "@legendapp/list/react";
import {
  chatAttachmentProblem,
  chatAttachmentUrl,
  freeMessagesLabel,
  isRetryable,
  type ChatReplyError,
} from "@t3tools/client-runtime/chat";
import {
  SAAS_CHAT_DOCUMENT_EXTENSIONS,
  SAAS_CHAT_IMAGE_TYPES,
  type SaasChatAttachment,
} from "@t3tools/contracts/saas";
import { EnvironmentId, MessageId } from "@t3tools/contracts";
import { withoutOpenVisual } from "@t3tools/shared/htmlRender";
import type { SaasChatConversation } from "@t3tools/contracts/saas";
import { useNavigate } from "@tanstack/react-router";
import {
  CameraIcon,
  FileTextIcon,
  GlobeIcon,
  ImageIcon,
  MailIcon,
  PlusIcon,
  SquareIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import {
  createRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from "react";

import {
  miraChatHistory,
  uploadMiraAttachment,
  useMiraAccess,
  useMiraChatHistory,
  useMiraRelayUrl,
} from "~/cloud/miraChat";
import { toastManager } from "../ui/toast";
import { isElectron } from "~/env";
import { useIncrementalTimelineEntries } from "~/hooks/useIncrementalTimelineEntries";
import { useTheme } from "~/hooks/useTheme";
import type { ChatMessage } from "~/types";
import type { ChatComposerHandle } from "../chat/ChatComposer";
import { ExpandedImageDialog } from "../chat/ExpandedImageDialog";
import type { ExpandedImagePreview } from "../chat/ExpandedImagePreview";
import { ComposerSurface } from "../chat/ComposerSurface";
import { MessagesTimeline } from "../chat/MessagesTimeline";
import { ScrollToEndButton } from "../chat/TimelineOverlays";
import { useTimelineFollow } from "../chat/useTimelineFollow";
import { Button } from "../ui/button";
import { SidebarInset } from "../ui/sidebar";
import { Spinner } from "../ui/spinner";
import { WorkspacePageHeader } from "../WorkspacePageHeader";
import { AgenticUpgradeDialog } from "./AgenticUpgradeDialog";

// The timeline keys rows by environment; nothing behind this id loads, as on the guest page.
const CHAT_ENVIRONMENT_ID = EnvironmentId.make("mira-chat");
const NO_COMPOSER = createRef<ChatComposerHandle>();
const NO_TURN_DIFFS: ReadonlyArray<never> = [];
const NO_TURN_ITEMS: ReadonlyArray<never> = [];
const ignore = () => {};

/** Ways into a first message for someone who does not know what to ask. */
const STARTERS: ReadonlyArray<{
  readonly icon: LucideIcon;
  readonly title: string;
  readonly detail: string;
  readonly text: string;
  readonly attach: boolean;
}> = [
  {
    icon: CameraIcon,
    title: "Explică-mi o factură",
    detail: "Adaugă o poză și întreabă",
    text: "Explică-mi factura din poză.",
    attach: true,
  },
  {
    icon: MailIcon,
    title: "Scrie un e-mail",
    detail: "Politicos, scurt, clar",
    text: "Scrie-mi un e-mail politicos și scurt despre ",
    attach: false,
  },
  {
    icon: GlobeIcon,
    title: "Plan de weekend",
    detail: "Trasee, program, buget",
    text: "Fă-mi un plan de weekend în ",
    attach: false,
  },
  {
    icon: FileTextIcon,
    title: "Rezumă un document",
    detail: "PDF, Word sau poză",
    text: "Rezumă pe scurt documentul atașat.",
    attach: true,
  },
];

const markdownLabel = (name: string) => name.replace(/[[\]\\]/g, "\\$&");

// The timeline renders message markdown; stored photos show inline and files link to their relay copy.
const attachmentLinks = (
  attachments: ReadonlyArray<SaasChatAttachment> | undefined,
  relayUrl: string | null,
) =>
  (attachments ?? [])
    .map((file) =>
      relayUrl === null
        ? `📎 ${file.name}`
        : file.kind === "image"
          ? `![${markdownLabel(file.name)}](${chatAttachmentUrl(relayUrl, file.id)})`
          : `📎 [${markdownLabel(file.name)}](${chatAttachmentUrl(relayUrl, file.id)})`,
    )
    .join("\n\n");

const toTimelineMessages = (
  chat: SaasChatConversation | undefined,
  streaming: { readonly chatId: string; readonly messageId: string; readonly text: string } | null,
  relayUrl: string | null,
): ReadonlyArray<ChatMessage> => {
  const messages: Array<ChatMessage> = (chat?.messages ?? []).map((message) => ({
    id: MessageId.make(message.id),
    role: message.role,
    // A saved reply cut off inside a visual would otherwise show half a page.
    text: [
      attachmentLinks(message.attachments, relayUrl),
      message.role === "assistant" ? withoutOpenVisual(message.content) : message.content,
    ]
      .filter((part) => part !== "")
      .join("\n\n"),
    runId: null,
    streaming: false,
    createdAt: message.createdAt,
    updatedAt: message.createdAt,
  }));
  if (chat !== undefined && streaming?.chatId === chat.id && streaming.text !== "") {
    const at = chat.updatedAt;
    messages.push({
      // The saved reply reuses this id, so its row and visuals stay mounted when it finishes.
      id: MessageId.make(streaming.messageId),
      role: "assistant",
      text: streaming.text,
      runId: null,
      streaming: true,
      createdAt: at,
      updatedAt: at,
    });
  }
  return messages;
};

/** Chat mode: Mira answers from the account's model, with no computer or tools behind it. */
export function ChatModeView({ chatId }: { readonly chatId: string | null }) {
  const navigate = useNavigate();
  const history = useMiraChatHistory();
  const access = useMiraAccess();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const composer = useRef<ChatModeComposerHandle>(null);
  const chat = chatId === null ? undefined : history.chats.find((item) => item.id === chatId);
  const missing = chatId !== null && history.loaded && chat === undefined;
  const updatedAt = chat?.updatedAt;

  useEffect(() => {
    if (missing) void navigate({ to: "/ask", replace: true });
  }, [missing, navigate]);

  // A reply that lands while the chat is on screen is read.
  useEffect(() => {
    if (chatId !== null && updatedAt !== undefined) miraChatHistory.markSeen(chatId);
  }, [chatId, updatedAt]);

  const send = async (text: string, attachments: ReadonlyArray<SaasChatAttachment>) => {
    await miraChatHistory.send(chat?.id ?? null, text, {
      attachments,
      onStarted: (sentChatId) => {
        if (sentChatId === chatId) return;
        void navigate({
          to: "/ask/$chatId",
          params: { chatId: sentChatId },
          replace: chatId === null,
        });
      },
    });
  };

  const busy = history.streaming !== null;
  const searching = history.streaming?.searching === true && history.streaming.chatId === chat?.id;
  const error = history.error !== null && history.error.chatId === chat?.id ? history.error : null;
  const lastMessage = chat?.messages.at(-1);
  const suggestions =
    !busy && lastMessage?.role === "assistant" ? (lastMessage.suggestions ?? []) : [];
  const freeMessagesLeft = access.signedIn ? null : history.freeMessagesLeft;
  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none">
      <WorkspacePageHeader electron={isElectron}>
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {chat?.title ?? "Chat nou"}
        </h1>
      </WorkspacePageHeader>
      {chat === undefined ? (
        <div className="m-auto flex w-full max-w-(--chat-content-max-width) flex-col items-center px-6">
          <span
            aria-hidden
            className="mb-6 size-16 rounded-full opacity-85"
            style={{
              backgroundImage:
                "radial-gradient(circle at 35% 30%, #f3e8ff, #c7d2fe 45%, #a5f3fc 100%)",
            }}
          />
          <p className="text-center text-3xl font-semibold tracking-tight">Cu ce te pot ajuta?</p>
          <p className="mt-2 text-center text-base text-muted-foreground">
            Scrie o întrebare sau adaugă o poză ori un document.
          </p>
          <div className="mt-10 grid w-full grid-cols-2 gap-2.5">
            {STARTERS.map((starter) => (
              <button
                key={starter.title}
                type="button"
                className="flex cursor-pointer flex-col items-start gap-0.5 rounded-2xl bg-muted/60 px-4 py-3.5 text-left hover:bg-muted"
                onClick={() => composer.current?.start(starter.text, starter.attach)}
              >
                <starter.icon aria-hidden className="mb-2 size-5 text-primary" />
                <span className="text-sm font-semibold">{starter.title}</span>
                <span className="text-xs text-muted-foreground">{starter.detail}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ChatTimeline chat={chat} streaming={history.streaming} />
      )}
      <div className="chat-composer-lane w-full shrink-0 pt-1.5 pb-3 sm:pt-2 sm:pb-4">
        {error !== null ? (
          <ChatReplyErrorNotice
            error={error}
            onSignIn={access.openSignIn}
            onUpgrade={() => setUpgradeOpen(true)}
            onRetry={() => void miraChatHistory.retry(error.chatId)}
          />
        ) : searching ? (
          <p className="mx-auto mb-2 w-full max-w-(--chat-content-max-width) px-1 text-muted-foreground text-xs">
            Caut pe internet…
          </p>
        ) : suggestions.length > 0 ? (
          <div className="mx-auto mb-2.5 flex w-full max-w-(--chat-content-max-width) flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="h-8 cursor-pointer rounded-full bg-primary/10 px-3.5 text-sm font-medium text-primary hover:bg-primary/15"
                onClick={() => void send(suggestion, [])}
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
        <ChatModeComposer
          ref={composer}
          busy={busy}
          replying={chat !== undefined && history.streaming?.chatId === chat.id}
          onSend={send}
          onStop={() => miraChatHistory.stop()}
        />
        <p className="mx-auto mt-2 w-full max-w-(--chat-content-max-width) text-center text-xs text-muted-foreground/80">
          {freeMessagesLeft !== null && access.openSignIn !== null ? (
            <>
              {`${freeMessagesLabel(freeMessagesLeft)} · `}
              <button
                type="button"
                className="cursor-pointer font-semibold text-primary hover:underline"
                onClick={access.openSignIn}
              >
                Creează cont
              </button>
            </>
          ) : (
            "Mira poate greși. Verifică informațiile importante."
          )}
        </p>
      </div>
      <AgenticUpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </SidebarInset>
  );
}

function ChatTimeline({
  chat,
  streaming,
}: {
  readonly chat: SaasChatConversation;
  readonly streaming: {
    readonly chatId: string;
    readonly messageId: string;
    readonly text: string;
  } | null;
}) {
  const threadKey = `mira-chat-${chat.id}`;
  const [expandedImage, setExpandedImage] = useState<ExpandedImagePreview | null>(null);
  const listRef = useRef<LegendListRef | null>(null);
  const { resolvedTheme } = useTheme();
  const relayUrl = useMiraRelayUrl();
  const messages = toTimelineMessages(chat, streaming, relayUrl);
  const entries = useIncrementalTimelineEntries(threadKey, {
    visibleTurnItems: NO_TURN_ITEMS,
    optimisticMessages: messages,
  });
  const isWorking = streaming?.chatId === chat.id;
  const lastUserMessage = chat.messages.findLast((message) => message.role === "user");
  const follow = useTimelineFollow({
    legendListRef: listRef,
    composerRef: NO_COMPOSER,
    composerOverlayElement: null,
    composerTimelineInset: 0,
    routeThreadKey: threadKey,
    activeThreadKey: threadKey,
    activeThreadId: undefined,
    isServerThread: false,
    serverProjection: null,
    threadStatus: "live",
    activeActivityRun: null,
    activeRunningTurnId: null,
    timelineEntries: entries,
    timelineAnchorMessageId: null,
    setTimelineAnchor: ignore,
  });
  return (
    <div className="relative min-h-0 flex-1">
      <MessagesTimeline
        listRef={listRef}
        timelineEntries={entries}
        isWorking={isWorking}
        activeTurnInProgress={isWorking}
        activeTurnStartedAt={isWorking ? (lastUserMessage?.createdAt ?? null) : null}
        latestRun={null}
        runningRunId={null}
        turnDiffSummaries={NO_TURN_DIFFS}
        runs={NO_TURN_ITEMS}
        routeThreadKey={threadKey}
        onOpenThread={ignore}
        onRollbackCheckpoint={ignore}
        supportsConversationRollback={false}
        onRevertToTurnCount={ignore}
        isRevertingCheckpoint={false}
        onImageExpand={setExpandedImage}
        activeThreadEnvironmentId={CHAT_ENVIRONMENT_ID}
        markdownCwd={undefined}
        resolvedTheme={resolvedTheme}
        timestampFormat="locale"
        workspaceRoot={undefined}
        anchorMessageId={null}
        onAnchorReady={ignore}
        onAnchorSizeChanged={ignore}
        contentInsetEndAdjustment={0}
        emptyPlaceholderInset={0}
        liveFollowEnabled={follow.timelineLiveFollowEnabled}
        onIsAtEndChange={follow.onIsAtEndChangeStable}
        onManualNavigation={follow.cancelTimelineLiveFollowForUserNavigationStable}
        cancelPositionRestoreRef={follow.cancelPositionRestoreRef}
      />
      {follow.showScrollToBottom ? (
        <ScrollToEndButton bottom={4} onScrollToEnd={() => follow.scrollToEnd(true)} />
      ) : null}
      {expandedImage === null ? null : (
        <ExpandedImageDialog preview={expandedImage} onClose={() => setExpandedImage(null)} />
      )}
    </div>
  );
}

function ChatReplyErrorNotice({
  error,
  onSignIn,
  onUpgrade,
  onRetry,
}: {
  readonly error: ChatReplyError;
  readonly onSignIn: (() => void) | null;
  readonly onUpgrade: () => void;
  readonly onRetry: () => void;
}) {
  const action =
    error.code === "sign_up_required" || error.code === "session_expired"
      ? onSignIn === null
        ? null
        : {
            label: error.code === "session_expired" ? "Autentifică-te" : "Creează cont gratuit",
            run: onSignIn,
          }
      : error.code === "daily_limit"
        ? { label: "Treci la Pro", run: onUpgrade }
        : isRetryable(error)
          ? { label: "Încearcă din nou", run: onRetry }
          : null;
  return (
    <div
      role="alert"
      className="mx-auto mb-2 flex w-full max-w-(--chat-content-max-width) items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm"
    >
      <p className="min-w-0 flex-1">{error.message}</p>
      {action !== null ? (
        <Button
          size="sm"
          onClick={() => {
            miraChatHistory.clearError();
            action.run();
          }}
        >
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

interface PendingFile {
  readonly id: string;
  readonly name: string;
  readonly image: boolean;
  readonly attachment: SaasChatAttachment | null;
}

const ACCEPTED_FILES = [
  ...SAAS_CHAT_IMAGE_TYPES,
  ...SAAS_CHAT_DOCUMENT_EXTENSIONS.map((extension) => `.${extension}`),
].join(",");

interface ChatModeComposerHandle {
  /** Fills in a starter prompt, then opens the file picker or puts the cursor after it. */
  readonly start: (text: string, attach: boolean) => void;
}

// The thread composer's surface, attach and send buttons, without model controls.
function ChatModeComposer({
  ref,
  busy,
  replying,
  onSend,
  onStop,
}: {
  readonly ref?: Ref<ChatModeComposerHandle>;
  readonly busy: boolean;
  /** Mira is answering this chat, so the send button stops her instead. */
  readonly replying: boolean;
  readonly onSend: (text: string, attachments: ReadonlyArray<SaasChatAttachment>) => Promise<void>;
  readonly onStop: () => void;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<ReadonlyArray<PendingFile>>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const textArea = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => ({
    start: (starter, attach) => {
      setText(starter);
      if (attach) {
        fileInput.current?.click();
        return;
      }
      const field = textArea.current;
      field?.focus();
      field?.setSelectionRange(starter.length, starter.length);
    },
  }));
  const uploading = files.some((file) => file.attachment === null);
  const ready = files.flatMap((file) => (file.attachment === null ? [] : [file.attachment]));
  const canSend = !busy && !uploading && (text.trim() !== "" || ready.length > 0);
  const submit = () => {
    if (!canSend) return;
    const trimmed = text.trim();
    setText("");
    setFiles([]);
    void onSend(trimmed, ready);
  };
  const addFiles = (picked: FileList | null) => {
    for (const file of picked ?? []) {
      const problem = chatAttachmentProblem({
        name: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      if (problem !== null) {
        toastManager.add({ type: "error", title: problem });
        continue;
      }
      const id = `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`;
      setFiles((current) => [
        ...current,
        { id, name: file.name, image: SAAS_CHAT_IMAGE_TYPES.includes(file.type), attachment: null },
      ]);
      void uploadMiraAttachment(file).then((result) => {
        if (result.ok) {
          setFiles((current) =>
            current.map((item) =>
              item.id === id ? { ...item, attachment: result.attachment } : item,
            ),
          );
        } else {
          setFiles((current) => current.filter((item) => item.id !== id));
          toastManager.add({ type: "error", title: result.message });
        }
      });
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Same as the app composer: Enter sends, Shift+Enter adds a line, IME composition is left alone.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <ComposerSurface.Shell>
        <ComposerSurface.Host>
          <ComposerSurface.Main>
            <div data-chat-composer-surface="true" className="rounded-2xl">
              {files.length > 0 ? (
                <div className="flex flex-wrap gap-2 px-3 pt-3 sm:px-4">
                  {files.map((file) => (
                    <span
                      key={file.id}
                      className="inline-flex max-w-60 items-center gap-1.5 rounded-lg bg-muted px-2 py-1 text-xs"
                    >
                      {file.attachment === null ? (
                        <Spinner size="sm" aria-hidden="true" />
                      ) : file.image ? (
                        <ImageIcon aria-hidden className="size-3.5 shrink-0" />
                      ) : (
                        <FileTextIcon aria-hidden className="size-3.5 shrink-0" />
                      )}
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        aria-label={`Elimină ${file.name}`}
                        className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          setFiles((current) => current.filter((item) => item.id !== file.id))
                        }
                      >
                        <XIcon aria-hidden className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="relative px-3 pt-3.5 pb-2 sm:px-4 sm:pt-4">
                <textarea
                  ref={textArea}
                  aria-label="Mesaj"
                  placeholder="Întreabă orice"
                  autoFocus
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={onKeyDown}
                  onPaste={(event) => {
                    if (event.clipboardData.files.length === 0) return;
                    event.preventDefault();
                    addFiles(event.clipboardData.files);
                  }}
                  className="-m-1 block max-h-52 min-h-12 w-[calc(100%+0.5rem)] resize-none bg-transparent p-1 font-(family-name:--font-composer,var(--font-sans)) text-(length:--font-size-prompt,var(--text-sm)) leading-relaxed text-foreground outline-none field-sizing-content placeholder:text-placeholder"
                />
              </div>
              <div className="flex min-w-0 items-center justify-between gap-2 px-3 pb-3 sm:px-4 sm:pb-4">
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  hidden
                  accept={ACCEPTED_FILES}
                  onChange={(event) => {
                    addFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  aria-label="Adaugă poze și fișiere"
                  className="flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={() => fileInput.current?.click()}
                >
                  <PlusIcon aria-hidden className="size-4" />
                </button>
                {replying ? (
                  <button
                    type="button"
                    aria-label="Oprește răspunsul"
                    onClick={onStop}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-foreground text-background transition-transform duration-150 hover:scale-105 sm:h-8 sm:w-8"
                  >
                    <SquareIcon aria-hidden className="size-3 fill-current" />
                  </button>
                ) : !canSend && !busy ? null : (
                  // Send appears once there is something to send.
                  <button
                    type="submit"
                    aria-label="Trimite mesajul"
                    disabled={!canSend}
                    className="relative isolate flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-message-action text-message-action-foreground shadow-xs transition-all duration-150 enabled:cursor-pointer enabled:shadow-message-action/24 enabled:inset-shadow-control-highlight hover:scale-105 hover:bg-message-action-hover active:inset-shadow-control-pressed active:shadow-none disabled:pointer-events-none disabled:bg-foreground/12 disabled:text-muted-foreground disabled:shadow-none disabled:hover:scale-100 sm:h-8 sm:w-8 [&_svg]:pointer-events-none"
                  >
                    {busy ? (
                      <Spinner size="sm" aria-hidden="true" />
                    ) : (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M7 11.5V2.5M7 2.5L3 6.5M7 2.5L11 6.5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>
          </ComposerSurface.Main>
        </ComposerSurface.Host>
      </ComposerSurface.Shell>
    </form>
  );
}
