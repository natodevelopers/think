"use client";

import type { Dispatch, MouseEvent, SetStateAction } from "react";
import { useMemo, useState } from "react";
import { Menu, Moon, Plus, Sparkles, Sun, Trash2 } from "lucide-react";

import type { Conversation, Theme } from "./chatTypes";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

export type SidebarProps = {
  isSidebarOpen: boolean;
  setIsSidebarOpen: Dispatch<SetStateAction<boolean>>;
  conversations: Conversation[];
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  activeConversation: string;
  setActiveConversation: Dispatch<SetStateAction<string>>;
  theme: Theme;
  setTheme: Dispatch<SetStateAction<Theme>>;
};

export default function Sidebar({
  isSidebarOpen,
  setIsSidebarOpen,
  conversations,
  setConversations,
  activeConversation,
  setActiveConversation,
  theme,
  setTheme,
}: SidebarProps) {
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const deleteTargetTitle = useMemo(() => {
    if (!deleteTargetId) return null;
    return conversations.find((c) => c.id === deleteTargetId)?.title ?? null;
  }, [conversations, deleteTargetId]);

  const createNewConversation = () => {
    const emptyConversation = conversations.find(
      (conversation) => conversation.messages.length === 0,
    );

    if (emptyConversation) {
      setActiveConversation(emptyConversation.id);
      return;
    }

    const newId = `conv-${Date.now()}`;
    setConversations([
      { id: newId, title: "New Chat", messages: [] },
      ...conversations,
    ]);
    setActiveConversation(newId);
  };

  const deleteConversation = (
    id: string,
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
    setDeleteTargetId(id);
    return;

    const confirmed = window.confirm("Bạn có chắc muốn xoá cuộc trò chuyện này không?");
    if (!confirmed) return;

    if (conversations.length === 1) {
      const newConversation: Conversation = {
        id: "default",
        title: "New Chat",
        messages: [],
      };
      setConversations([newConversation]);
      setActiveConversation("default");
      return;
    }

    const updatedConversations = conversations.filter(
      (conversation) => conversation.id !== id,
    );
    setConversations(updatedConversations);

    if (activeConversation === id) {
      const nextConversation = updatedConversations[0];
      if (nextConversation) setActiveConversation(nextConversation.id);
    }
  };

  const confirmDeleteConversation = () => {
    const id = deleteTargetId;
    if (!id) return;
    setDeleteTargetId(null);

    if (conversations.length === 1) {
      const newConversation: Conversation = {
        id: "default",
        title: "New Chat",
        messages: [],
      };
      setConversations([newConversation]);
      setActiveConversation("default");
      return;
    }

    const updatedConversations = conversations.filter(
      (conversation) => conversation.id !== id,
    );
    setConversations(updatedConversations);

    if (activeConversation === id) {
      const nextConversation = updatedConversations[0];
      if (nextConversation) setActiveConversation(nextConversation.id);
    }
  };

  return (
    <aside className={`sidebar ${isSidebarOpen ? "open" : "closed"}`}>
      <div className="sidebar-header">
        <button
          className="sidebar-toggle"
          onClick={() => setIsSidebarOpen((prev) => !prev)}
          type="button"
        >
          <Menu size={18} />
        </button>

        <button
          className="new-chat-btn"
          onClick={createNewConversation}
          type="button"
        >
          <Plus size={20} />
          <span>New chat</span>
        </button>
      </div>

      <div className="sidebar-content">
        <h2 className="sidebar-title">Chat history</h2>

        <ul className="conversation-list">
          {conversations.map((conversation) => (
            <li
              key={conversation.id}
              className={`conversation-item ${
                activeConversation === conversation.id ? "active" : ""
              }`}
              onClick={() => setActiveConversation(conversation.id)}
            >
              <div className="conversation-icon-title">
                <div className="conversation-icon">
                  <Sparkles size={14} />
                </div>
                <span className="conversation-title">{conversation.title}</span>
              </div>

              <button
                className={`delete-btn ${
                  conversations.length > 1 || conversation.title !== "New Chat"
                    ? ""
                    : "hide"
                }`}
                onClick={(event) => deleteConversation(conversation.id, event)}
                type="button"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="sidebar-footer">
        <button
          className="theme-toggle"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          type="button"
        >
          {theme === "light" ? (
            <>
              <Moon size={20} />
              <span>Dark mode</span>
            </>
          ) : (
            <>
              <Sun size={20} />
              <span>Light mode</span>
            </>
          )}
        </button>
      </div>

      <AlertDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá cuộc trò chuyện?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTargetTitle
                ? `Bạn có chắc muốn xoá “${deleteTargetTitle}”? Thao tác này không thể hoàn tác.`
                : "Bạn có chắc muốn xoá cuộc trò chuyện này không? Thao tác này không thể hoàn tác."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel className="alert-dialog-cancel">
              Huỷ
            </AlertDialogCancel>
            <AlertDialogAction
              className="alert-dialog-action"
              onClick={confirmDeleteConversation}
            >
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
