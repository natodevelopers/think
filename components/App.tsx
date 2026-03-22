"use client";

import { useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import Image from "next/image";

import type { Conversation, Theme } from "./chatTypes";
import Message from "./Message";
import PromptForm from "./PromptForm";
import Sidebar from "./Sidebar";

const DEFAULT_CONVERSATION: Conversation = {
  id: "default",
  title: "New Chat",
  messages: [],
};

function safeParseConversations(raw: string | null): Conversation[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed as Conversation[];
  } catch {
    return null;
  }
}

export default function App() {
  const [isLoading, setIsLoading] = useState(false);
  const typingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingJobRef = useRef<{
    conversationId: string;
    messageId: string;
    fullText: string;
  } | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [conversations, setConversations] = useState<Conversation[]>([
    DEFAULT_CONVERSATION,
  ]);
  const [activeConversation, setActiveConversation] = useState(
    DEFAULT_CONVERSATION.id,
  );

  useEffect(() => {
    setIsSidebarOpen(window.innerWidth > 768);

    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    } else {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      setTheme(prefersDark ? "dark" : "light");
    }

    const savedConversations = safeParseConversations(
      localStorage.getItem("conversations"),
    );
    setConversations(
      savedConversations && savedConversations.length > 0
        ? savedConversations
        : [DEFAULT_CONVERSATION],
    );

    const savedActive = localStorage.getItem("activeConversation");
    if (savedActive) setActiveConversation(savedActive);
  }, []);

  useEffect(() => {
    if (conversations.length === 0) {
      setConversations([DEFAULT_CONVERSATION]);
      setActiveConversation(DEFAULT_CONVERSATION.id);
      return;
    }

    const activeExists = conversations.some((c) => c.id === activeConversation);
    if (!activeExists) setActiveConversation(conversations[0].id);
  }, [activeConversation, conversations]);

  useEffect(() => {
    localStorage.setItem("activeConversation", activeConversation);
  }, [activeConversation]);

  useEffect(() => {
    localStorage.setItem("conversations", JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    return () => {
      if (typingInterval.current) clearInterval(typingInterval.current);
    };
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden) return;
      const job = typingJobRef.current;
      if (!job) return;
      if (typingInterval.current) clearInterval(typingInterval.current);
      typingInterval.current = null;
      typingJobRef.current = null;

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === job.conversationId
            ? {
                ...conv,
                messages: conv.messages.map((msg) =>
                  msg.id === job.messageId
                    ? { ...msg, content: job.fullText, loading: false }
                    : msg,
                ),
              }
            : conv,
        ),
      );
      setIsLoading(false);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [setConversations]);

  const currentConversation =
    conversations.find((c) => c.id === activeConversation) ?? conversations[0];

  const scrollToBottom = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversations, activeConversation]);

  const updateBotMessage = (
    conversationId: string,
    botId: string,
    content: string,
    isError = false,
  ) => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              messages: conv.messages.map((msg) =>
                msg.id === botId
                  ? { ...msg, content, loading: false, error: isError }
                  : msg,
              ),
            }
          : conv,
      ),
    );
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.top = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  };

  const handleCopyMessage = async (conversationId: string, messageId: string) => {
    const conversation = conversations.find((c) => c.id === conversationId);
    const message = conversation?.messages.find((m) => m.id === messageId);
    if (!message) return;
    await copyToClipboard(message.content);
  };

  const handleToggleLike = (conversationId: string, messageId: string) => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              messages: conv.messages.map((m) =>
                m.id === messageId ? { ...m, liked: !m.liked } : m,
              ),
            }
          : conv,
      ),
    );
  };

  const handleRegenerate = (conversationId: string, botMessageId: string) => {
    if (isLoading) return;
    const conversation = conversations.find((c) => c.id === conversationId);
    if (!conversation) return;

    const botIndex = conversation.messages.findIndex((m) => m.id === botMessageId);
    const history =
      botIndex >= 0 ? conversation.messages.slice(0, botIndex) : conversation.messages;

    const apiConversation: Conversation = { ...conversation, messages: history };

    setIsLoading(true);
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              messages: conv.messages.map((m) =>
                m.id === botMessageId
                  ? {
                      ...m,
                      content: "Just a sec...",
                      loading: true,
                      error: false,
                    }
                  : m,
              ),
            }
          : conv,
      ),
    );

    generateResponse(apiConversation, botMessageId);
  };

  const typingEffect = (conversationId: string, text: string, messageId: string) => {
    if (document.hidden) {
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId
            ? {
                ...conv,
                messages: conv.messages.map((msg) =>
                  msg.id === messageId
                    ? { ...msg, content: text, loading: false }
                    : msg,
                ),
              }
            : conv,
        ),
      );
      setIsLoading(false);
      return;
    }

    const tokens = text.match(/\s+|[^\s]+/g) ?? [text];
    let tokenIndex = 0;
    let currentText = "";
    const startedAt = Date.now();

    typingJobRef.current = { conversationId, messageId, fullText: text };

    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              messages: conv.messages.map((msg) =>
                msg.id === messageId ? { ...msg, content: "", loading: true } : msg,
              ),
            }
          : conv,
      ),
    );

    if (typingInterval.current) clearInterval(typingInterval.current);
    typingInterval.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const shouldHaveTokens = Math.min(tokens.length, Math.floor(elapsed / 40));

      if (tokenIndex < shouldHaveTokens) {
        while (tokenIndex < shouldHaveTokens) currentText += tokens[tokenIndex++];

        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  messages: conv.messages.map((msg) =>
                    msg.id === messageId
                      ? { ...msg, content: currentText, loading: true }
                      : msg,
                  ),
                }
              : conv,
          ),
        );

        scrollToBottom();
        return;
      }

      if (tokenIndex < tokens.length) return;

      if (typingInterval.current) clearInterval(typingInterval.current);
      typingInterval.current = null;
      typingJobRef.current = null;

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId
            ? {
                ...conv,
                messages: conv.messages.map((msg) =>
                  msg.id === messageId
                    ? { ...msg, content: currentText, loading: false }
                    : msg,
                ),
              }
            : conv,
        ),
      );
      setIsLoading(false);
    }, 40);
  };

  const generateResponse = async (conversation: Conversation, botMessageId: string) => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: conversation.messages }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data?.error?.message ?? "Request failed");

      const responseText = String(data?.text ?? "")
        .trim();

      typingEffect(conversation.id, responseText, botMessageId);
    } catch (error) {
      setIsLoading(false);
      updateBotMessage(
        conversation.id,
        botMessageId,
        error instanceof Error ? error.message : "Unknown error",
        true,
      );
    }
  };

  return (
    <div
      className={`app-container ${theme === "light" ? "light-theme" : "dark-theme"}`}
    >
      <div
        className={`overlay ${isSidebarOpen ? "show" : "hide"}`}
        onClick={() => setIsSidebarOpen(false)}
      />

      <Sidebar
        conversations={conversations}
        setConversations={setConversations}
        activeConversation={activeConversation}
        setActiveConversation={setActiveConversation}
        theme={theme}
        setTheme={setTheme}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      />

      <main className="main-container">
        <header className="main-header">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="sidebar-toggle"
            type="button"
          >
            <Menu size={18} />
          </button>
        </header>

        {currentConversation.messages.length === 0 ? (
          <div className="welcome-container">
            <Image
              className="welcome-logo"
              src="/gemini.svg"
              alt="Gemini Logo"
              width={80}
              height={80}
              priority
            />
            <h1 className="welcome-heading">Message Think</h1>
            <p className="welcome-text">
              Ask me anything about any topic. I&apos;m here to help!
            </p>
          </div>
        ) : (
          <div className="messages-container" ref={messagesContainerRef}>
            {currentConversation.messages.map((message) => (
              <Message
                key={message.id}
                message={message}
                conversationId={currentConversation.id}
                onCopy={handleCopyMessage}
                onRegenerate={handleRegenerate}
                onToggleLike={handleToggleLike}
              />
            ))}
          </div>
        )}

        <div className="prompt-container">
          <div className="prompt-wrapper">
            <PromptForm
              conversations={conversations}
              setConversations={setConversations}
              activeConversation={activeConversation}
              generateResponse={generateResponse}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          </div>
          <p className="disclaimer-text">
            Think can make mistakes, so double-check it.
          </p>
        </div>
      </main>
    </div>
  );
}
