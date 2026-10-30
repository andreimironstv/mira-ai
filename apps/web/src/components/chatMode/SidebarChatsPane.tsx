import { chatListSections, chatMatchesQuery } from "@t3tools/client-runtime/chat";
import { Link, useLocation } from "@tanstack/react-router";
import { SearchIcon, SquarePenIcon, Trash2Icon, XIcon } from "lucide-react";
import { useRef, useState } from "react";

import { miraChatHistory, useMiraChatHistory } from "~/cloud/miraChat";
import { ensureLocalApi } from "~/localApi";
import { Button } from "../ui/button";
import {
  SidebarContent,
  SidebarGroup,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";

/** Mira is writing this chat's reply; still dots, no animation that repaints every frame. */
function ReplyingDots() {
  return (
    <span role="img" aria-label="Mira scrie" className="flex shrink-0 gap-0.5 text-primary">
      <span className="size-1 rounded-full bg-current opacity-35" />
      <span className="size-1 rounded-full bg-current opacity-65" />
      <span className="size-1 rounded-full bg-current" />
    </span>
  );
}

/** Chat mode's sidebar: search, New chat, and every chat grouped by day. */
export function SidebarChatsPane({ onNavigate }: { readonly onNavigate?: () => void }) {
  const { chats, loaded, unread, streaming } = useMiraChatHistory();
  const pathname = useLocation({ select: (location) => location.pathname });
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const searching = query.trim() !== "";
  const sections = chatListSections(
    searching ? chats.filter((chat) => chatMatchesQuery(chat, query)) : chats,
    new Date(),
  );
  return (
    <SidebarContent
      className="min-h-full"
      fixedHeader={
        <SidebarGroup className="z-[1]">
          <div className="flex h-8 min-w-0 items-center gap-2 rounded-lg bg-sidebar-control-surface px-2.5 text-sm text-sidebar-muted-foreground focus-within:text-sidebar-foreground focus-within:ring-1 focus-within:ring-inset focus-within:ring-ring/70">
            <SearchIcon className="size-4 shrink-0 text-(--sidebar-icon-color)" />
            <SidebarInput
              ref={searchInput}
              nativeInput
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setQuery("");
              }}
              placeholder="Caută"
              aria-label="Caută în chat-uri"
              className="min-w-0 flex-1"
            />
            {searching ? (
              <Button
                type="button"
                size="icon-micro"
                variant="ghost-muted"
                className="shrink-0"
                aria-label="Șterge căutarea"
                onClick={() => {
                  setQuery("");
                  searchInput.current?.focus();
                }}
              >
                <XIcon className="size-3" />
              </Button>
            ) : null}
          </div>
          <SidebarMenu className="mt-1">
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === "/ask"}
                render={<Link to="/ask" onClick={onNavigate} />}
              >
                <SquarePenIcon className="text-primary" />
                <span>Chat nou</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      }
    >
      <SidebarGroup className="flex-1">
        {sections.map((section) => (
          <section key={section.title} aria-label={section.title} className="pb-2">
            <h3 className="px-2 pt-3 pb-1 text-xs font-medium text-sidebar-muted-foreground">
              {section.title}
            </h3>
            <SidebarMenu>
              {section.chats.map((chat) => (
                <SidebarMenuItem key={chat.id} className="group/chat-row">
                  <SidebarMenuButton
                    isActive={pathname === `/ask/${chat.id}`}
                    render={
                      <Link to="/ask/$chatId" params={{ chatId: chat.id }} onClick={onNavigate} />
                    }
                  >
                    <span className="min-w-0 flex-1 truncate">{chat.title}</span>
                    <span className="flex shrink-0 items-center group-hover/chat-row:opacity-0">
                      {streaming?.chatId === chat.id ? (
                        <ReplyingDots />
                      ) : unread.has(chat.id) ? (
                        <span
                          role="img"
                          aria-label="Răspuns necitit"
                          className="size-1.5 rounded-full bg-primary"
                        />
                      ) : null}
                    </span>
                  </SidebarMenuButton>
                  <span className="absolute end-1 top-1 opacity-0 group-hover/chat-row:opacity-100 has-focus-visible:opacity-100">
                    <Button
                      size="icon-xs"
                      variant="ghost-muted"
                      aria-label={`Șterge ${chat.title}`}
                      onClick={async () => {
                        const confirmed = await ensureLocalApi().dialogs.confirm(
                          `Ștergi „${chat.title}”?\nVa fi șters de pe toate dispozitivele conectate la contul tău.`,
                          { variant: "destructive" },
                        );
                        if (confirmed) miraChatHistory.remove(chat.id);
                      }}
                    >
                      <Trash2Icon />
                    </Button>
                  </span>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </section>
        ))}
        {loaded && sections.length === 0 ? (
          <p role="status" className="px-2 py-6 text-center text-xs text-sidebar-muted-foreground">
            {searching ? `Niciun chat nu conține „${query.trim()}”` : "Niciun chat încă"}
          </p>
        ) : null}
      </SidebarGroup>
    </SidebarContent>
  );
}
