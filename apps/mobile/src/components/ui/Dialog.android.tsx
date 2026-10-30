import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, View, type Alert, type AlertButton } from "react-native";

import { cn } from "../../lib/cn";
import { AppTextInput, AppText as Text } from "./AppText";
import type { ConfirmDialogRequest, TextInputDialogRequest } from "./Dialog.types";

export type { ConfirmDialogRequest, TextInputDialogRequest } from "./Dialog.types";

type AlertRequest = {
  readonly title: Parameters<typeof Alert.alert>[0];
  readonly message: Parameters<typeof Alert.alert>[1];
  readonly buttons: Parameters<typeof Alert.alert>[2];
  readonly options: Parameters<typeof Alert.alert>[3];
};

type DialogRequest =
  | { readonly kind: "alert"; readonly request: AlertRequest }
  | { readonly kind: "confirm"; readonly request: ConfirmDialogRequest }
  | { readonly kind: "text-input"; readonly request: TextInputDialogRequest };

let presentRequest: ((request: DialogRequest) => void) | null = null;

export function alert(...[title, message, buttons, options]: Parameters<typeof Alert.alert>): void {
  const actions = buttons?.length ? buttons.slice(0, 3) : [{ text: "OK" }];
  const normalized = actions.map((action, index) =>
    index === actions.length - 1 ? { ...action, text: action.text || "OK" } : action,
  );
  presentRequest?.({
    kind: "alert",
    request: { title, message, buttons: normalized, options },
  });
}

export function confirm(request: ConfirmDialogRequest): void {
  presentRequest?.({ kind: "confirm", request });
}

export function prompt(request: TextInputDialogRequest): void {
  presentRequest?.({ kind: "text-input", request });
}

export function Host() {
  const [presented, setPresented] = useState<(DialogRequest & { readonly id: number }) | null>(
    null,
  );
  const [inputValue, setInputValue] = useState("");
  const nextPresentationId = useRef(0);
  useEffect(() => {
    const present = (request: DialogRequest) => {
      setInputValue(request.kind === "text-input" ? request.request.initialValue : "");
      setPresented({ ...request, id: ++nextPresentationId.current });
    };
    presentRequest = present;
    return () => {
      // When Android replaces the activity, the new root's Host registers before the old root
      // unmounts. Clearing unconditionally would leave the live Host without dialogs.
      if (presentRequest === present) presentRequest = null;
    };
  }, []);

  const handleCancel = useCallback(() => {
    setPresented(null);
    if (presented?.kind === "alert") presented.request.options?.onDismiss?.();
    else presented?.request.onCancel?.();
  }, [presented]);

  const handleConfirm = useCallback(
    (nativeInputValue?: string) => {
      setPresented(null);
      if (presented?.kind === "confirm") {
        presented.request.onConfirm();
      } else if (presented?.kind === "text-input") {
        presented.request.onConfirm(nativeInputValue ?? inputValue);
      }
    },
    [inputValue, presented],
  );

  if (presented?.kind === "alert") {
    return (
      <DialogPresentation
        key={presented.id}
        request={{
          title: presented.request.title ?? "",
          message: presented.request.message ?? undefined,
          confirmText: "",
        }}
        alertActions={presented.request.buttons ?? [{ text: "OK" }]}
        dismissable={presented.request.options?.cancelable ?? false}
        onAlertAction={(action) => {
          setPresented(null);
          action.onPress?.();
        }}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
      />
    );
  }

  return presented ? (
    <DialogPresentation
      key={presented.id}
      request={presented.request}
      inputInitialValue={
        presented.kind === "text-input" ? presented.request.initialValue : undefined
      }
      inputPlaceholder={presented.kind === "text-input" ? presented.request.placeholder : undefined}
      onInputChange={setInputValue}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
    />
  ) : null;
}

/** The iOS alert, drawn in React Native so Android shares its look. */
function DialogPresentation(props: DialogPresentationProps) {
  const [inputValue, setInputValue] = useState(props.inputInitialValue ?? "");
  const confirm = () => {
    props.onConfirm(props.inputInitialValue === undefined ? undefined : inputValue);
  };
  const actions = props.alertActions ?? [
    {
      text: props.request.cancelText ?? "Anulează",
      style: "cancel" as const,
      onPress: props.onCancel,
    },
    {
      text: props.request.confirmText,
      style: props.request.destructive ? ("destructive" as const) : ("default" as const),
      onPress: confirm,
    },
  ];
  const stacked = actions.length > 2;
  const dismissable = props.dismissable ?? true;
  return (
    <Modal
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={dismissable ? props.onCancel : () => undefined}
    >
      <Pressable
        accessible={false}
        className="flex-1 items-center justify-center bg-black/40 px-8"
        onPress={dismissable ? props.onCancel : undefined}
      >
        <Pressable
          accessible={false}
          className="w-full max-w-[300px] overflow-hidden rounded-[20px] bg-card"
        >
          <View className="items-center gap-1 px-5 pt-5 pb-4">
            <Text
              accessibilityRole="header"
              className="text-center font-t3-semibold text-[17px] leading-[22px] text-foreground"
            >
              {props.request.title}
            </Text>
            {props.request.message ? (
              <Text className="text-center text-[13px] leading-[18px] text-foreground-secondary">
                {props.request.message}
              </Text>
            ) : null}
            {props.inputInitialValue !== undefined ? (
              <AppTextInput
                autoFocus
                selectTextOnFocus
                accessibilityLabel={props.request.title}
                value={inputValue}
                placeholder={props.inputPlaceholder}
                onChangeText={(value) => {
                  setInputValue(value);
                  props.onInputChange?.(value);
                }}
                onSubmitEditing={confirm}
                returnKeyType="done"
                className="mt-3 w-full"
              />
            ) : null}
          </View>
          <View className={stacked ? "" : "flex-row"}>
            {actions.map((action, index) => (
              <Pressable
                key={index}
                accessibilityRole="button"
                onPress={() =>
                  props.alertActions ? props.onAlertAction?.(action) : action.onPress?.()
                }
                className={cn(
                  "min-h-[48px] flex-1 items-center justify-center border-t border-border px-3 active:bg-subtle",
                  !stacked && index > 0 && "border-l",
                )}
              >
                <Text
                  className={cn(
                    "text-center text-[17px]",
                    action.style === "destructive" ? "text-danger-foreground" : "text-primary-text",
                    action.style !== "cancel" && index === actions.length - 1 && "font-t3-semibold",
                  )}
                  numberOfLines={1}
                >
                  {action.text ?? ""}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface DialogPresentationProps {
  readonly alertActions?: readonly AlertButton[];
  readonly onAlertAction?: (action: AlertButton) => void;
  readonly dismissable?: boolean;
  readonly request: Pick<
    ConfirmDialogRequest,
    "title" | "message" | "cancelText" | "confirmText" | "destructive"
  >;
  readonly inputInitialValue?: string;
  readonly inputPlaceholder?: string;
  readonly onInputChange?: (value: string) => void;
  readonly onCancel: () => void;
  readonly onConfirm: (inputValue?: string) => void;
}
