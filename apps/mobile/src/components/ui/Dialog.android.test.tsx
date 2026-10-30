import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vite-plus/test";

vi.mock("react-native", () => {
  const Slot = (props: { readonly children?: ReactNode; readonly onPress?: () => void }) => (
    <div onClick={props.onPress}>{props.children}</div>
  );
  return { Modal: Slot, Pressable: Slot, View: Slot };
});
vi.mock("./AppText", () => ({
  AppText: (props: { readonly children?: ReactNode }) => <span>{props.children}</span>,
  AppTextInput: () => <input />,
}));

import * as Dialog from "./Dialog.android";

const roots: Root[] = [];

function mountHost() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => root.render(<Dialog.Host />));
  return { root, container };
}

afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  document.body.innerHTML = "";
});

it("keeps presenting dialogs after an older root's Host unmounts", () => {
  // Android activity replacement mounts the new root before the old one stops.
  const previous = mountHost();
  const current = mountHost();
  roots.splice(roots.indexOf(previous.root), 1);
  act(() => previous.root.unmount());

  act(() => Dialog.alert("Saved", undefined, [{ text: "OK" }]));

  expect(current.container.textContent).toContain("Saved");
});
