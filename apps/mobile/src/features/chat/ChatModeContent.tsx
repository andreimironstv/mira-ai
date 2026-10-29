import {
  chatAttachmentProblem,
  chatAttachmentUrl,
  chatMessageStamps,
  freeMessagesLabel,
  isRetryable,
  type ChatReplyError,
} from "@t3tools/client-runtime/chat";
import { EnvironmentId } from "@t3tools/contracts";
import { chatVisualsAsText, splitChatVisuals, withoutOpenVisual } from "@t3tools/shared/htmlRender";
import type {
  SaasChatAttachment,
  SaasChatConversation,
  SaasChatMessage,
} from "@t3tools/contracts/saas";
import { Image } from "expo-image";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Linking, Pressable, ScrollView, type ScrollViewInstance, Share, View } from "react-native";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  FadeOutDown,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { ComposerActionButton } from "../../components/ComposerToolbar";
import { ComposerEditor } from "../../components/ComposerEditor";
import { SymbolView, type AppSymbolName } from "../../components/ui/AppSymbol";
import { EmptyOrb } from "../../components/ui/EmptyOrb";
import type {
  ComposerEditorHandle,
  ComposerEditorSelection,
} from "../../native/T3ComposerEditor.types";
import * as Dialog from "../../components/ui/Dialog";
import {
  ComposerAttachmentStrip,
  ComposerAttachmentThumbnail,
} from "../../components/ComposerAttachmentStrip";
import {
  convertPastedImagesToAttachments,
  type DraftComposerAttachment,
} from "../../lib/composerImages";
import { FilePreview } from "../../components/FilePreview";
import { AppText } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import { SelectableMarkdownText } from "../../native/SelectableMarkdownText";
import { CopyTextButton } from "../threads/CopyTextButton";
import { ShimmeringWorkContent } from "../threads/thread-work-log";
import { useScaledTextRole } from "../settings/appearance/useScaledTextRole";
import {
  ComposerSurface,
  THREAD_COMPOSER_BOTTOM_GUTTER,
  useCompactComposerEditor,
} from "../threads/ThreadComposer";
import { useMarkdownStyles } from "../threads/ThreadFeed";
import {
  ComposerDictationCancelAction,
  ComposerDictationPrimaryAction,
  ComposerDictationStartAction,
  ComposerDictationStatus,
  ComposerDictationToolbar,
} from "../voice-input/ComposerDictationControl";
import { useVoiceInputController } from "../voice-input/useVoiceInputController";
import { resolveVoiceComposerPresentation } from "../voice-input/voiceInputPresentation";
import { pickChatDocuments, pickChatPhotos } from "./chatFiles";
import { ChatVisual } from "./ChatVisual";
import {
  miraChatHistory,
  openMiraUpgrade,
  uploadMiraAttachment,
  useMiraAccess,
  useMiraChatHistory,
  useMiraRelayUrl,
} from "./miraChat";

// Chat files belong to no environment; the strip only shows their local previews.
const CHAT_ENVIRONMENT_ID = EnvironmentId.make("mira-chat");

interface ChatComposerHandle {
  /** Fills in a starter prompt, then opens a picker or puts the cursor after it. */
  readonly start: (text: string, pick: "photos" | "files" | null) => void;
}

const STARTERS: ReadonlyArray<{
  readonly icon: AppSymbolName;
  readonly title: string;
  readonly detail: string;
  readonly text: string;
  readonly pick: "photos" | "files" | null;
}> = [
  {
    icon: "camera",
    title: "Explică-mi o factură",
    detail: "Fă o poză și întreabă",
    text: "Explică-mi factura din poză.",
    pick: "photos",
  },
  {
    icon: "pencil",
    title: "Scrie un e-mail",
    detail: "Politicos, scurt, clar",
    text: "Scrie-mi un e-mail politicos și scurt despre ",
    pick: null,
  },
  {
    icon: "globe",
    title: "Plan de weekend",
    detail: "Trasee, program, buget",
    text: "Fă-mi un plan de weekend în ",
    pick: null,
  },
  {
    icon: "doc.text",
    title: "Rezumă un document",
    detail: "PDF, Word sau poză",
    text: "Rezumă pe scurt documentul atașat.",
    pick: "files",
  },
];

/**
 * Chat mode: Mira answers from the account's model with no computer behind it, so it works on
 * a phone with nothing connected. Drawn with the thread feed's bubbles and composer.
 */
export function ChatModeContent(props: {
  readonly chatId: string | null;
  readonly onChatStarted: (chatId: string) => void;
}) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const history = useMiraChatHistory();
  const access = useMiraAccess();
  const focused = useIsFocused();
  const composer = useRef<ChatComposerHandle>(null);
  const [composing, setComposing] = useState(false);
  const chat =
    props.chatId === null ? undefined : history.chats.find((item) => item.id === props.chatId);
  const busy = history.streaming !== null;
  const replying = chat !== undefined && history.streaming?.chatId === chat.id;
  const error = history.error !== null && history.error.chatId === chat?.id ? history.error : null;
  const freeMessagesLeft = access.signedIn ? null : history.freeMessagesLeft;
  const chatId = chat?.id;
  const chatUpdatedAt = chat?.updatedAt;
  // A reply that lands while the chat is on screen is read.
  useEffect(() => {
    if (focused && chatId !== undefined && chatUpdatedAt !== undefined) {
      miraChatHistory.markSeen(chatId);
    }
  }, [focused, chatId, chatUpdatedAt]);

  const send = (text: string, attachments: ReadonlyArray<SaasChatAttachment>) => {
    void miraChatHistory.send(chat?.id ?? null, text, {
      attachments,
      onStarted: (chatId) => {
        if (chatId !== props.chatId) props.onChatStarted(chatId);
      },
    });
  };
  // Like the thread screen: the composer rides the keyboard and drops its bottom inset there.
  const keyboard = useReanimatedKeyboardAnimation();
  const keyboardStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(0, -keyboard.height.value - insets.bottom * keyboard.progress.value),
  }));

  return (
    <Animated.View className="flex-1 bg-screen" style={keyboardStyle}>
      {chat === undefined ? (
        <ChatWelcome
          showStarters={!composing}
          onStarter={(starter) => composer.current?.start(starter.text, starter.pick)}
        />
      ) : (
        <ChatMessages
          chat={chat}
          streaming={history.streaming?.chatId === chat.id ? history.streaming : null}
          canReply={!busy}
          onSuggestion={(text) => send(text, [])}
        />
      )}
      {error !== null ? (
        <View className="px-[12px] pb-2">
          <ChatErrorNotice
            error={error}
            onSignIn={() => navigation.navigate("SettingsAuth")}
            onUpgrade={() => void openMiraUpgrade().catch(() => undefined)}
            onRetry={() => void miraChatHistory.retry(error.chatId)}
          />
        </View>
      ) : null}
      {freeMessagesLeft !== null && error === null ? (
        <View className="flex-row flex-wrap items-center justify-center px-6 pb-1.5">
          <AppText className="text-xs text-foreground-secondary">
            {`${freeMessagesLabel(freeMessagesLeft)} · `}
          </AppText>
          <Pressable
            accessibilityRole="link"
            hitSlop={8}
            onPress={() => navigation.navigate("SettingsAuth")}
          >
            <AppText className="font-t3-semibold text-xs text-primary">Creează cont</AppText>
          </Pressable>
        </View>
      ) : null}
      <ChatComposer
        busy={busy}
        replying={replying}
        bottomInset={insets.bottom}
        ref={composer}
        onComposingChange={setComposing}
        onSend={send}
        onStop={() => miraChatHistory.stop()}
      />
    </Animated.View>
  );
}

/** A new chat: what Mira can do, and four ways in for someone who does not know what to ask. */
function ChatWelcome(props: {
  readonly showStarters: boolean;
  readonly onStarter: (starter: (typeof STARTERS)[number]) => void;
}) {
  return (
    <View className="flex-1">
      <View className="flex-1 items-center justify-center px-8">
        <EmptyOrb />
        <AppText className="text-center font-t3-bold text-[28px] leading-[34px]">
          Cu ce te pot ajuta?
        </AppText>
        <AppText className="mt-2 text-center text-base text-foreground-secondary">
          Scrie, vorbește sau trimite o poză.
        </AppText>
      </View>
      {props.showStarters ? (
        <Animated.View
          className="gap-2.5 px-4 pb-3"
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
        >
          {[STARTERS.slice(0, 2), STARTERS.slice(2)].map((row) => (
            <View key={row[0]?.title} className="flex-row gap-2.5">
              {row.map((starter) => (
                <Pressable
                  key={starter.title}
                  accessibilityRole="button"
                  accessibilityLabel={`${starter.title}. ${starter.detail}`}
                  className="flex-1 rounded-[18px] bg-subtle px-3.5 pt-3.5 pb-3 active:opacity-70"
                  onPress={() => props.onStarter(starter)}
                >
                  <SymbolView name={starter.icon} size={22} tintColorClassName="accent-primary" />
                  <AppText className="mt-2.5 font-t3-semibold text-[15px] leading-5 text-foreground">
                    {starter.title}
                  </AppText>
                  <AppText className="mt-0.5 text-[13px] leading-[17px] text-foreground-secondary">
                    {starter.detail}
                  </AppText>
                </Pressable>
              ))}
            </View>
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

const FOLLOW_THRESHOLD = 80;

function ChatMessages(props: {
  readonly chat: SaasChatConversation;
  readonly streaming: {
    readonly messageId: string;
    readonly text: string;
    readonly searching?: boolean;
  } | null;
  /** No reply is streaming anywhere, so a suggested reply can be sent. */
  readonly canReply: boolean;
  readonly onSuggestion: (text: string) => void;
}) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const stamps = chatMessageStamps(props.chat.messages, new Date());
  const lastMessage = props.chat.messages.at(-1);
  const answered = props.streaming === null && lastMessage?.role === "assistant";
  // Follow new content only from the bottom, so a visual resizing above (a tab switch) keeps its place.
  const atBottom = useRef(true);
  const followedMessages = useRef(props.chat.messages.length);
  return (
    <ScrollView
      ref={scrollRef}
      className="flex-1"
      contentContainerClassName="px-4 pt-3 pb-4"
      keyboardDismissMode="interactive"
      scrollEventThrottle={64}
      onScroll={({ nativeEvent }) => {
        const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
        atBottom.current =
          contentSize.height - contentOffset.y - layoutMeasurement.height < FOLLOW_THRESHOLD;
      }}
      onContentSizeChange={() => {
        const newMessage = props.chat.messages.length !== followedMessages.current;
        followedMessages.current = props.chat.messages.length;
        if (newMessage || atBottom.current) scrollRef.current?.scrollToEnd({ animated: true });
      }}
      // The keyboard shrinks the list; keep the latest message in view, as threads do.
      onLayout={() => scrollRef.current?.scrollToEnd({ animated: false })}
    >
      {/* One list, so the streamed reply keeps its row (and its visuals) once it is saved. */}
      {[
        ...props.chat.messages.map((message) => {
          const stamp = stamps.get(message.id);
          return (
            <View key={message.id}>
              {stamp === undefined ? null : <ChatStamp label={stamp} />}
              <ChatMessageRow message={message} streaming={false} />
              {answered && message === lastMessage ? (
                <ReplyFooter
                  message={message}
                  canReply={props.canReply}
                  onSuggestion={props.onSuggestion}
                />
              ) : null}
            </View>
          );
        }),
        props.streaming === null || props.streaming.text === "" ? null : (
          <ChatMessageRow
            key={props.streaming.messageId}
            message={{
              id: props.streaming.messageId,
              role: "assistant",
              content: props.streaming.text,
              createdAt: props.chat.updatedAt,
            }}
            streaming
          />
        ),
      ]}
      {props.streaming !== null && (props.streaming.searching || props.streaming.text === "") ? (
        <ChatWorkingRow searching={props.streaming.searching === true} />
      ) : null}
    </ScrollView>
  );
}

// The thread feed's working row, so chat reads like agentic mode while Mira works.
function ChatWorkingRow(props: { readonly searching: boolean }) {
  const { color: iconColor } = useResolveClassNames("text-icon-subtle");
  return (
    <View className="mb-5 min-h-8 flex-row items-center px-1" accessible>
      <ShimmeringWorkContent
        key={props.searching ? "searching" : "thinking"}
        icon={props.searching ? "globe" : "brain"}
        iconSubtleColor={iconColor ?? "gray"}
        label={props.searching ? "Caut pe internet" : "Mă gândesc"}
        showIcon
      />
    </View>
  );
}

// The thread feed's user bubble; its text is selectable, so it carries no buttons.
function ChatMessageRow(props: { readonly message: SaasChatMessage; readonly streaming: boolean }) {
  const { message } = props;
  const styles = useMarkdownStyles();
  if (message.role !== "user") {
    return <AssistantRow text={message.content} streaming={props.streaming} />;
  }
  return (
    <Animated.View className="mb-5 items-end" entering={FadeInUp.duration(220)}>
      <View className="min-w-0 max-w-[85%] rounded-[20px] bg-user-bubble">
        <View className="gap-2 px-3.5 pt-2.5 pb-2.5">
          {message.attachments?.length ? (
            <MessageAttachments attachments={message.attachments} />
          ) : null}
          {message.content !== "" ? (
            <SelectableMarkdownText
              markdown={message.content}
              textStyle={styles.user.nativeTextStyle}
              onLinkPress={(href) => void Linking.openURL(href)}
            />
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

function AssistantRow(props: { readonly text: string; readonly streaming: boolean }) {
  const styles = useMarkdownStyles();
  return (
    <Animated.View
      className={props.streaming ? "mb-1 px-1" : "mb-5 px-1"}
      entering={FadeIn.duration(220)}
    >
      {/* A saved reply cut off inside a visual would otherwise wait on it forever. */}
      {splitChatVisuals(props.streaming ? props.text : withoutOpenVisual(props.text)).map(
        (segment, index) =>
          segment.kind === "visual" ? (
            <ChatVisual key={index} html={segment.html} complete={segment.complete} />
          ) : (
            <SelectableMarkdownText
              key={index}
              markdown={segment.text}
              textStyle={styles.assistant.nativeTextStyle}
              onLinkPress={(href) => void Linking.openURL(href)}
            />
          ),
      )}
    </Animated.View>
  );
}

// As in Messages: the day in bold, then the time.
function ChatStamp(props: { readonly label: string }) {
  const split = props.label.lastIndexOf(" ");
  return (
    <AppText className="mt-1 mb-3.5 text-center text-xs text-foreground-secondary">
      <AppText className="font-t3-semibold text-xs text-foreground-secondary">
        {props.label.slice(0, split)}
      </AppText>
      {props.label.slice(split)}
    </AppText>
  );
}

/** Under Mira's latest answer only: copy, share, and the replies she suggests. */
function ReplyFooter(props: {
  readonly message: SaasChatMessage;
  readonly canReply: boolean;
  readonly onSuggestion: (text: string) => void;
}) {
  const { color: iconColor } = useResolveClassNames("text-icon-subtle");
  const text = chatVisualsAsText(props.message.content);
  const suggestions = props.canReply ? (props.message.suggestions ?? []) : [];
  return (
    <View className="-mt-4 mb-5 gap-3">
      <View className="flex-row items-center gap-1">
        <CopyTextButton
          accessibilityLabel="Copiază răspunsul"
          text={text}
          tintColor={iconColor}
          buttonSize={34}
          iconSize={16}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Distribuie răspunsul"
          hitSlop={8}
          className="size-[34px] items-center justify-center active:opacity-60"
          onPress={() => void Share.share({ message: text })}
        >
          <SymbolView
            name="square.and.arrow.up"
            size={16}
            tintColorClassName="accent-icon-subtle"
          />
        </Pressable>
      </View>
      {suggestions.length > 0 ? (
        <Animated.View className="flex-row flex-wrap gap-2" entering={FadeIn.duration(180)}>
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion}
              accessibilityRole="button"
              accessibilityLabel={`Trimite: ${suggestion}`}
              className="h-[34px] justify-center rounded-full bg-primary/10 px-3.5 active:opacity-70"
              onPress={() => props.onSuggestion(suggestion)}
            >
              <AppText className="font-t3-medium text-[15px] text-primary">{suggestion}</AppText>
            </Pressable>
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

function ChatErrorNotice(props: {
  readonly error: ChatReplyError;
  readonly onSignIn: () => void;
  readonly onUpgrade: () => void;
  readonly onRetry: () => void;
}) {
  const action =
    props.error.code === "sign_up_required" || props.error.code === "session_expired"
      ? {
          label: props.error.code === "session_expired" ? "Autentifică-te" : "Creează cont gratuit",
          run: props.onSignIn,
        }
      : props.error.code === "daily_limit"
        ? { label: "Treci la Pro", run: props.onUpgrade }
        : isRetryable(props.error)
          ? { label: "Încearcă din nou", run: props.onRetry }
          : null;
  return (
    <View
      accessibilityRole="alert"
      className="gap-3 rounded-2xl border border-border bg-card px-4 py-3"
    >
      <AppText className="text-sm">{props.error.message}</AppText>
      {action !== null ? (
        <Button
          label={action.label}
          onPress={() => {
            miraChatHistory.clearError();
            action.run();
          }}
        />
      ) : null}
    </View>
  );
}

function MessageAttachments(props: { readonly attachments: ReadonlyArray<SaasChatAttachment> }) {
  const relayUrl = useMiraRelayUrl();
  const [previewing, setPreviewing] = useState<string | null>(null);
  const photos =
    relayUrl === null
      ? []
      : props.attachments.flatMap((attachment) =>
          attachment.kind === "image"
            ? [
                {
                  kind: "image" as const,
                  uri: chatAttachmentUrl(relayUrl, attachment.id),
                  name: attachment.name,
                },
              ]
            : [],
        );
  const previewed = photos.find((photo) => photo.uri === previewing);
  return (
    <View className="gap-2">
      {previewed === undefined ? null : (
        <FilePreview
          source={{ ...previewed, gallery: photos }}
          onRequestClose={() => setPreviewing(null)}
        />
      )}
      {props.attachments.map((attachment) =>
        attachment.kind === "image" && relayUrl !== null ? (
          <Pressable
            key={attachment.id}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Deschide ${attachment.name}`}
            onPress={() => setPreviewing(chatAttachmentUrl(relayUrl, attachment.id))}
          >
            <Image
              source={{ uri: chatAttachmentUrl(relayUrl, attachment.id) }}
              contentFit="cover"
              style={{ width: 220, height: 170, borderRadius: 14 }}
            />
          </Pressable>
        ) : (
          <FileChip key={attachment.id} name={attachment.name} />
        ),
      )}
    </View>
  );
}

function FileChip(props: { readonly name: string }) {
  return (
    <View className="max-w-60 flex-row items-center gap-2 rounded-xl bg-subtle px-2.5 py-2">
      <SymbolView name="doc.text" size={16} tintColorClassName="accent-icon-subtle" />
      <View className="min-w-0 shrink">
        <AppText className="text-sm text-foreground" numberOfLines={1}>
          {props.name}
        </AppText>
      </View>
    </View>
  );
}

interface PendingFile {
  readonly draft: DraftComposerAttachment;
  readonly attachment: SaasChatAttachment | null;
}

/** Picked files upload right away, so sending only waits on the reply. */
function usePendingFiles() {
  const [files, setFiles] = useState<ReadonlyArray<PendingFile>>([]);
  const add = (picked: {
    readonly attachments: ReadonlyArray<DraftComposerAttachment>;
    readonly error: string | null;
  }) => {
    if (picked.error) Dialog.alert("Fișierul nu a putut fi adăugat", picked.error);
    for (const draft of picked.attachments) {
      const problem = chatAttachmentProblem(draft);
      if (problem !== null) {
        Dialog.alert("Fișierul nu a putut fi adăugat", problem);
        continue;
      }
      setFiles((current) => [...current, { draft, attachment: null }]);
      void uploadMiraAttachment(draft).then((result) => {
        if (result.ok) {
          setFiles((current) =>
            current.map((item) =>
              item.draft.id === draft.id ? { ...item, attachment: result.attachment } : item,
            ),
          );
        } else {
          setFiles((current) => current.filter((item) => item.draft.id !== draft.id));
          Dialog.alert("Fișierul nu a putut fi adăugat", result.message);
        }
      });
    }
  };
  return {
    drafts: files.map((item) => item.draft),
    uploading: files.some((item) => item.attachment === null),
    ready: files.flatMap((item) => (item.attachment === null ? [] : [item.attachment])),
    remove: (id: string) => setFiles((current) => current.filter((item) => item.draft.id !== id)),
    add,
    clear: () => setFiles([]),
    pickPhotos: async () => add(await pickChatPhotos(files.length)),
    pickDocuments: async () => add(await pickChatDocuments(files.length)),
  };
}

const COMPACT_ATTACHMENT_LIMIT = 1;

// Large targets riding on the composer: an anchored popup stayed behind when the keyboard closed.
function AttachTray(props: { readonly onPhotos: () => void; readonly onFiles: () => void }) {
  return (
    <Animated.View
      className="mb-2 flex-row gap-2"
      entering={FadeInDown.duration(160)}
      exiting={FadeOutDown.duration(120)}
    >
      <AttachTile icon="photo" label="Poze" onPress={props.onPhotos} />
      <AttachTile icon="folder" label="Fișiere" onPress={props.onFiles} />
    </Animated.View>
  );
}

function AttachTile(props: {
  readonly icon: "photo" | "folder";
  readonly label: string;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      className="flex-1 flex-row items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 active:opacity-70"
      onPress={props.onPress}
    >
      <SymbolView name={props.icon} size={20} tintColorClassName="accent-icon" type="monochrome" />
      <AppText className="font-t3-medium text-base text-foreground">{props.label}</AppText>
    </Pressable>
  );
}

/**
 * The thread composer's layout and motion: a one-row pill that grows with the text, attachments
 * in the row or above it while editing, and the same attach and send buttons. No model control.
 */
function ChatComposer({
  ref,
  ...props
}: {
  readonly ref?: Ref<ChatComposerHandle>;
  readonly busy: boolean;
  /** Mira is answering this chat, so the send button stops her instead. */
  readonly replying: boolean;
  readonly bottomInset: number;
  /** The composer is focused or holds a draft, so the new-chat starters step aside. */
  readonly onComposingChange: (composing: boolean) => void;
  readonly onSend: (text: string, attachments: ReadonlyArray<SaasChatAttachment>) => void;
  readonly onStop: () => void;
}) {
  const bodyText = useScaledTextRole("body");
  const { color: foregroundColor } = useResolveClassNames("text-foreground");
  const [text, setText] = useState("");
  const [selection, setSelection] = useState<ComposerEditorSelection>({ start: 0, end: 0 });
  const [isFocused, setIsFocused] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const editor = useRef<ComposerEditorHandle>(null);
  const textRef = useRef(text);
  const draftListeners = useRef(new Set<() => void>());
  const pending = usePendingFiles();
  const reportComposing = (focused: boolean, value: string) =>
    props.onComposingChange(focused || value.trim() !== "");
  const changeText = (value: string) => {
    textRef.current = value;
    setText(value);
    reportComposing(isFocused, value);
    for (const listener of draftListeners.current) listener();
  };
  const voice = useVoiceInputController({
    ownerKey: "mira-chat",
    label: "Chat",
    readDraftMessage: () => textRef.current,
    subscribeToDraftChanges: (onChange) => {
      draftListeners.current.add(onChange);
      return () => draftListeners.current.delete(onChange);
    },
    selection,
    onChangeDraftMessage: changeText,
    onChangeSelection: setSelection,
  });
  const voicePresentation = resolveVoiceComposerPresentation(voice.state, voice.elapsedSeconds);
  const dictating = voicePresentation.statusLabel !== null;
  const compactEditor = useCompactComposerEditor(bodyText, text);
  const isExpanded = isFocused;
  const stripAttachments = pending.drafts;
  const empty = text.trim() === "" && stripAttachments.length === 0;
  const canSend = !props.busy && !pending.uploading && !voice.blocksSubmission && !empty;
  const submit = () => {
    if (!canSend) return;
    const trimmed = text.trim();
    const attachments = pending.ready;
    changeText("");
    pending.clear();
    props.onSend(trimmed, attachments);
  };
  useImperativeHandle(ref, () => ({
    start: (starter, pick) => {
      changeText(starter);
      if (pick === "photos") void pending.pickPhotos();
      else if (pick === "files") void pending.pickDocuments();
      else editor.current?.focus();
    },
  }));

  return (
    <View
      className="px-[12px]"
      style={{ paddingTop: 6, paddingBottom: props.bottomInset + THREAD_COMPOSER_BOTTOM_GUTTER }}
    >
      {dictating ? (
        <View className="mb-2">
          <ComposerDictationToolbar showsDictation>
            <View className="h-11 flex-row items-center">
              <ComposerDictationCancelAction
                presentation={voicePresentation}
                onCancel={voice.cancel}
              />
              <ComposerDictationStatus
                audioLevels={voice.audioLevels}
                elapsedSeconds={voice.elapsedSeconds}
                phase={voice.state.phase}
                presentation={voicePresentation}
                onDismissError={voice.cancel}
              />
              <ComposerDictationPrimaryAction
                state={voice.state}
                presentation={voicePresentation}
                isAvailable={voice.isAvailable}
                onStart={voice.start}
                onConfirm={voice.stop}
                onCancel={voice.cancel}
              />
            </View>
          </ComposerDictationToolbar>
        </View>
      ) : null}
      {attaching ? (
        <AttachTray
          onPhotos={() => {
            setAttaching(false);
            void pending.pickPhotos();
          }}
          onFiles={() => {
            setAttaching(false);
            void pending.pickDocuments();
          }}
        />
      ) : null}
      <View className="relative w-full self-center">
        <ComposerSurface
          animateLayout={false}
          style={{
            borderRadius: 27,
            borderCurve: "circular",
            overflow: "hidden",
            paddingVertical: 2,
          }}
        >
          {isExpanded && stripAttachments.length > 0 ? (
            <Animated.View
              className="px-[14px] pb-2.5 pt-2"
              entering={FadeIn.duration(160)}
              exiting={FadeOut.duration(120)}
            >
              <ComposerAttachmentStrip
                environmentId={CHAT_ENVIRONMENT_ID}
                attachments={stripAttachments}
                onRemove={pending.remove}
              />
            </Animated.View>
          ) : null}
          <View onLayout={compactEditor.onRowLayout}>
            <View className="flex-row items-end">
              <Pressable
                accessibilityLabel={attaching ? "Închide atașamentele" : "Adaugă atașament"}
                accessibilityRole="button"
                className="size-[44px] shrink-0 items-center justify-center rounded-full active:opacity-70"
                onPress={() => setAttaching(!attaching)}
              >
                <SymbolView
                  name={attaching ? "xmark" : "plus"}
                  size={20}
                  tintColorClassName="accent-icon"
                  type="monochrome"
                />
              </Pressable>
              <Animated.View
                className="min-w-0 flex-1"
                onLayout={compactEditor.onEditorLayout}
                style={[
                  {
                    minWidth: compactEditor.isExpanded || stripAttachments.length > 0 ? 0 : "40%",
                  },
                  compactEditor.containerStyle,
                  compactEditor.isExpanded ? { flex: 0, width: 0 } : undefined,
                ]}
              />
              {!isExpanded && stripAttachments.length > 0 ? (
                <View className="h-[44px] shrink-0 flex-row items-center gap-1 pl-1">
                  {stripAttachments.slice(0, COMPACT_ATTACHMENT_LIMIT).map((attachment) => (
                    <ComposerAttachmentThumbnail
                      environmentId={CHAT_ENVIRONMENT_ID}
                      key={attachment.id}
                      attachment={attachment}
                      size={30}
                      borderRadius={8}
                      compact
                    />
                  ))}
                  {stripAttachments.length > COMPACT_ATTACHMENT_LIMIT ? (
                    <View className="size-[30px] items-center justify-center rounded-lg bg-subtle-strong">
                      <AppText className="text-foreground-muted text-2xs font-t3-bold">
                        +{stripAttachments.length - COMPACT_ATTACHMENT_LIMIT}
                      </AppText>
                    </View>
                  ) : null}
                </View>
              ) : null}
              <View
                className="min-w-0 shrink flex-row items-center"
                style={
                  compactEditor.isExpanded ? { flex: 1, justifyContent: "flex-end" } : undefined
                }
              >
                {props.replying ? (
                  <ComposerActionButton
                    accessibilityLabel="Oprește răspunsul"
                    icon="stop.fill"
                    variant="danger"
                    onPress={props.onStop}
                  />
                ) : empty && voice.isAvailable ? (
                  // Mic or send, never both: an empty composer has nothing to send.
                  <ComposerDictationStartAction
                    state={voice.state}
                    isAvailable={voice.isAvailable}
                    disabled={dictating}
                    onStart={voice.start}
                    onCancel={voice.cancel}
                  />
                ) : (
                  <ComposerActionButton
                    accessibilityLabel={
                      pending.uploading ? "Se încarcă fișierele" : "Trimite mesajul"
                    }
                    icon="arrow.up"
                    variant="primary"
                    disabled={!canSend}
                    onPress={submit}
                  />
                )}
              </View>
            </View>
            <Animated.View style={compactEditor.editorStyle}>
              <ComposerEditor
                ref={editor}
                multiline
                value={text}
                onChangeText={changeText}
                onSelectionChange={setSelection}
                readOnly={voice.freezesEditor}
                placeholder="Întreabă orice"
                onFocus={() => {
                  setIsFocused(true);
                  reportComposing(true, textRef.current);
                }}
                onBlur={() => {
                  setIsFocused(false);
                  reportComposing(false, textRef.current);
                }}
                onPasteImages={(uris) =>
                  void convertPastedImagesToAttachments({
                    uris,
                    existingCount: stripAttachments.length,
                  }).then((attachments) => pending.add({ attachments, error: null }))
                }
                submitTitle="Trimite"
                onSubmit={submit}
                {...compactEditor.editorProps}
                textStyle={{ ...bodyText, color: foregroundColor }}
              />
            </Animated.View>
          </View>
        </ComposerSurface>
      </View>
    </View>
  );
}
