import type { MenuAction } from "@react-native-menu/menu";
import { CommonActions, useNavigation, type StaticScreenProps } from "@react-navigation/native";
import { Platform, View } from "react-native";

import { AndroidScreenHeader } from "../../components/ui/AndroidScreenHeader";
import * as Dialog from "../../components/ui/Dialog";
import { Menu } from "../../components/ui/Menu";
import { NativeStackScreenOptions } from "../../native/StackHeader";
import { ChatModeContent } from "./ChatModeContent";
import { RoundIconButton } from "../../components/ui/RoundIconButton";
import { miraChatHistory, useMiraChatHistory } from "./miraChat";

const CHAT_MENU_ACTIONS: MenuAction[] = [
  { id: "new", title: "Chat nou", image: "square.and.pencil" },
  { id: "delete", title: "Șterge chatul", image: "trash", attributes: { destructive: true } },
];

export function ChatRouteScreen({ route }: StaticScreenProps<{ readonly chatId?: string }>) {
  const navigation = useNavigation();
  const chatId = route.params?.chatId ?? null;
  const { chats } = useMiraChatHistory();
  const chat = chats.find((item) => item.id === chatId);
  const title = chat?.title ?? "Chat nou";
  return (
    <>
      {Platform.OS === "android" ? (
        <View className="bg-screen">
          <NativeStackScreenOptions options={{ headerShown: false }} />
          <AndroidScreenHeader
            title={title}
            onBack={() => navigation.goBack()}
            trailing={
              chat === undefined ? undefined : (
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
                  <RoundIconButton accessibilityLabel="Mai multe" icon="ellipsis" />
                </Menu>
              )
            }
          />
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
