import { useNavigation } from "@react-navigation/native";
import { chatMatchesQuery, chatPreview, chatTimeLabel } from "@t3tools/client-runtime/chat";
import type { SaasChatConversation } from "@t3tools/contracts/saas";
import * as Haptics from "expo-haptics";
import { useMemo, useRef, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  type TextInputInstance,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { AndroidScreenHeader } from "../../components/ui/AndroidScreenHeader";
import { SymbolView } from "../../components/ui/AppSymbol";
import { AppText as Text } from "../../components/ui/AppText";
import * as Dialog from "../../components/ui/Dialog";
import { EmptyOrb } from "../../components/ui/EmptyOrb";
import { EmptyState } from "../../components/ui/EmptyState";
import { FloatingActionButton } from "../../components/ui/FloatingActionButton";
import { RowPressable } from "../../components/ui/RowPressable";
import { SearchField } from "../../components/ui/SearchField";
import { NativeStackScreenOptions } from "../../native/StackHeader";
import { androidHomeFabPosition } from "../home/AndroidHomeFab.shared";
import { ThreadSwipeable } from "../home/thread-swipe-actions";
import { useWorkspaceTabs } from "../workspace/WorkspaceTabsContext";
import { miraChatHistory, useMiraChatHistory } from "./miraChat";

const confirmDelete = (chat: SaasChatConversation) =>
  Dialog.confirm({
    title: "Ștergi acest chat?",
    message: "Va fi șters de pe toate dispozitivele conectate la contul tău.",
    cancelText: "Anulează",
    confirmText: "Șterge",
    destructive: true,
    onConfirm: () => miraChatHistory.remove(chat.id),
  });

/** A chat: its title and Mira's latest answer, with Delete behind a swipe or long press. */
function ChatListRow(props: {
  readonly chat: SaasChatConversation;
  readonly now: Date;
  readonly last: boolean;
  readonly unread: boolean;
  readonly replying: boolean;
  readonly onOpen: () => void;
}) {
  const { chat } = props;
  const { width } = useWindowDimensions();
  const { backgroundColor } = useResolveClassNames("bg-screen");
  const deleteAction = useMemo(
    () => ({
      accessibilityLabel: `Șterge ${chat.title}`,
      destructive: true,
      icon: "trash" as const,
      label: "Șterge",
      onPress: () => confirmDelete(chat),
    }),
    [chat],
  );
  const time = chatTimeLabel(chat.updatedAt, props.now);
  return (
    <ThreadSwipeable
      threadKey={chat.id}
      threadTitle={chat.title}
      resetKey={chat.id}
      backgroundColor={backgroundColor ?? "transparent"}
      enableTrackpadSwipe
      fullSwipeAction="primary"
      fullSwipeWidth={width - 32}
      onDelete={() => confirmDelete(chat)}
      primaryAction={deleteAction}
      secondaryAction={null}
    >
      {(_close, open) => (
        <RowPressable
          accessibilityRole="button"
          accessibilityLabel={`${props.unread ? "Necitit, " : ""}${chat.title}, ${time}`}
          accessibilityHint="Deschide chat-ul. Glisează la stânga sau ține apăsat pentru a șterge."
          className="bg-screen"
          interactionClassName="bg-row-hover"
          onPress={props.onOpen}
          onLongPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            open();
          }}
        >
          <View className="flex-row pl-8 pr-4 pt-[11px]">
            {props.unread ? (
              <View className="absolute left-3 top-[18px] size-2.5 rounded-full bg-primary" />
            ) : null}
            <View
              className="min-w-0 flex-1 border-border-subtle pb-[11px]"
              style={{ borderBottomWidth: props.last ? 0 : StyleSheet.hairlineWidth }}
            >
              <View className="flex-row items-baseline gap-2">
                <Text
                  className="min-w-0 flex-1 font-t3-semibold text-base text-foreground"
                  numberOfLines={1}
                >
                  {chat.title}
                </Text>
                <Text className="text-sm tabular-nums text-foreground-secondary">{time}</Text>
                {Platform.OS === "ios" ? (
                  <SymbolView
                    name="chevron.right"
                    size={12}
                    tintColorClassName="accent-icon-subtle"
                  />
                ) : null}
              </View>
              {props.replying ? (
                <Text className="mt-0.5 font-t3-medium text-sm text-primary">Mira scrie…</Text>
              ) : (
                <Text className="mt-0.5 text-sm text-foreground-secondary" numberOfLines={2}>
                  {chatPreview(chat)}
                </Text>
              )}
            </View>
          </View>
        </RowPressable>
      )}
    </ThreadSwipeable>
  );
}

/** The search text: the workspace's on iOS, where it lives in the toolbar; local elsewhere. */
function useChatSearch() {
  const workspace = useWorkspaceTabs();
  const [localQuery, setLocalQuery] = useState("");
  return workspace
    ? {
        query: workspace.state.tabs.chats.query,
        setQuery: (query: string) => workspace.dispatch({ type: "query", tab: "chats", query }),
      }
    : { query: localQuery, setQuery: setLocalQuery };
}

/** The Chat tab: every chat on the account, newest first. */
export function ChatHome() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { chats, loaded, unread, streaming } = useMiraChatHistory();
  const { query, setQuery } = useChatSearch();
  const [androidSearching, setAndroidSearching] = useState(false);
  const searchInput = useRef<TextInputInstance>(null);
  const newChat = () => navigation.navigate("Chat", {});
  // Read per render; the list re-renders whenever a chat changes, which keeps time labels current.
  const now = new Date();
  const shown = query.trim() === "" ? chats : chats.filter((chat) => chatMatchesQuery(chat, query));
  return (
    <View className={Platform.OS === "android" ? "flex-1 bg-header" : "flex-1 bg-screen"}>
      {Platform.OS === "android" ? (
        <>
          <NativeStackScreenOptions options={{ headerShown: false }} />
          <AndroidScreenHeader
            title="Chat"
            actions={[
              {
                accessibilityLabel: androidSearching ? "Închide căutarea" : "Caută în chat-uri",
                icon: androidSearching ? "xmark" : "magnifyingglass",
                onPress: () => {
                  if (androidSearching) setQuery("");
                  setAndroidSearching(!androidSearching);
                },
              },
            ]}
          />
          {androidSearching ? (
            <View className="bg-header px-4 pb-3">
              <SearchField
                inputRef={searchInput}
                accessibilityLabel="Caută în chat-uri"
                clearAccessibilityLabel="Șterge căutarea"
                placeholder="Caută în chat-uri"
                value={query}
                onChangeText={setQuery}
              />
            </View>
          ) : null}
        </>
      ) : null}
      <View
        className={
          Platform.OS === "android" ? "flex-1 overflow-hidden rounded-t-[28px] bg-screen" : "flex-1"
        }
      >
        {!loaded ? null : chats.length === 0 ? (
          <View className="flex-1 items-center justify-center px-4">
            <EmptyState
              variant="plain"
              title="Nicio conversație încă"
              detail="Întreabă orice. Mira îți răspunde imediat."
              illustration={<EmptyOrb />}
              actionLabel={Platform.OS === "android" ? undefined : "Chat nou"}
              onAction={Platform.OS === "android" ? undefined : newChat}
            />
          </View>
        ) : shown.length === 0 ? (
          <View className="flex-1 items-center justify-center px-4">
            <EmptyState
              variant="plain"
              title="Niciun rezultat"
              detail={`Niciun chat nu conține „${query.trim()}”.`}
            />
          </View>
        ) : (
          <ScrollView
            contentContainerClassName="pt-1 pb-28"
            contentInsetAdjustmentBehavior="automatic"
            keyboardDismissMode="on-drag"
          >
            {shown.map((chat, index) => (
              <ChatListRow
                key={chat.id}
                chat={chat}
                now={now}
                last={index === shown.length - 1}
                unread={unread.has(chat.id)}
                replying={streaming?.chatId === chat.id}
                onOpen={() => navigation.navigate("Chat", { chatId: chat.id })}
              />
            ))}
          </ScrollView>
        )}
      </View>
      {Platform.OS === "android" ? (
        <FloatingActionButton
          label="Chat nou"
          icon="plus.bubble"
          variant="extended"
          tone="primary"
          onPress={newChat}
          className="absolute"
          style={androidHomeFabPosition(insets.bottom, false)}
        />
      ) : null}
    </View>
  );
}
