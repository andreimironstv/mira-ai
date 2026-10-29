import type { MenuAction } from "@react-native-menu/menu";
import { CommonActions, useNavigation, type StaticScreenProps } from "@react-navigation/native";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText as Text } from "../../components/ui/AppText";
import * as Dialog from "../../components/ui/Dialog";
import { Menu } from "../../components/ui/Menu";
import { NativeStackScreenOptions } from "../../native/StackHeader";
import { ChatModeContent } from "./ChatModeContent";
import { ChatRoundButton } from "./ChatRoundButton";
import { miraChatHistory, useMiraChatHistory } from "./miraChat";

const CHAT_MENU_ACTIONS: MenuAction[] = [
  { id: "new", title: "Chat nou", image: "square.and.pencil" },
  { id: "delete", title: "Șterge chatul", image: "trash", attributes: { destructive: true } },
];

export function ChatRouteScreen({ route }: StaticScreenProps<{ readonly chatId?: string }>) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const chatId = route.params?.chatId ?? null;
  const { chats } = useMiraChatHistory();
  const chat = chats.find((item) => item.id === chatId);
  const title = chat?.title ?? "Chat nou";
  return (
    <>
      {Platform.OS === "android" ? (
        // The iOS header's layout: round back and menu buttons around a centered title.
        <View className="bg-screen" style={{ paddingTop: insets.top }}>
          <NativeStackScreenOptions options={{ headerShown: false }} />
          <View className="h-[56px] flex-row items-center gap-3 px-4">
            <ChatRoundButton
              accessibilityLabel="Înapoi"
              icon="chevron.left"
              onPress={() => navigation.goBack()}
            />
            <Text
              accessibilityRole="header"
              className="min-w-0 flex-1 text-center font-t3-semibold text-[17px] text-foreground"
              numberOfLines={1}
            >
              {title}
            </Text>
            {chat === undefined ? (
              <View className="size-11" />
            ) : (
              <Menu
                actions={CHAT_MENU_ACTIONS}
                isAnchoredToRight
                onPressAction={({ nativeEvent }) => {
                  if (nativeEvent.event === "new") {
                    navigation.dispatch(CommonActions.setParams({ chatId: undefined }));
                    return;
                  }
                  Dialog.confirm({
                    title: "Ștergi acest chat?",
                    message: "Va fi șters de pe toate dispozitivele conectate la contul tău.",
                    cancelText: "Anulează",
                    confirmText: "Șterge",
                    destructive: true,
                    onConfirm: () => {
                      miraChatHistory.remove(chat.id);
                      navigation.goBack();
                    },
                  });
                }}
              >
                <ChatRoundButton accessibilityLabel="Mai multe" icon="ellipsis" />
              </Menu>
            )}
          </View>
        </View>
      ) : (
        <NativeStackScreenOptions options={{ title }} />
      )}
      {/* A new chat takes its id in place: replacing the screen slid it in again and closed the keyboard. */}
      <ChatModeContent
        chatId={chatId}
        onChatStarted={(id) => navigation.dispatch(CommonActions.setParams({ chatId: id }))}
      />
    </>
  );
}
