"use client";

import type {
  ChangeEvent,
  Dispatch,
  FormEvent,
  KeyboardEvent,
  SetStateAction,
} from "react";
import { useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

import type { ChatMessage, Conversation } from "./chatTypes";

export type PromptFormProps = {
  conversations: Conversation[];
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  activeConversation: string;
  generateResponse: (
    conversation: Conversation,
    botMessageId: string,
  ) => void | Promise<void>;
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
};

export default function PromptForm({
  conversations,
  setConversations,
  activeConversation,
  generateResponse,
  isLoading,
  setIsLoading,
}: PromptFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [promptText, setPromptText] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading || !promptText.trim()) return;

    setIsLoading(true);

    const foundConversation =
      conversations.find((convo) => convo.id === activeConversation) ??
      conversations[0];

    const currentConvo: Conversation =
      foundConversation ?? {
        id: activeConversation,
        title: "New Chat",
        messages: [],
      };

    let newTitle = currentConvo.title;
    if (currentConvo.messages.length === 0) {
      newTitle =
        promptText.length > 25 ? `${promptText.substring(0, 25)}...` : promptText;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: promptText,
    };

    const apiConversation: Conversation = {
      ...currentConvo,
      messages: [...currentConvo.messages, userMessage],
    };

    setConversations((prev) => {
      if (prev.length === 0) return [{ ...apiConversation, title: newTitle }];

      return prev.map((conv) =>
        conv.id === activeConversation
          ? { ...conv, title: newTitle, messages: [...conv.messages, userMessage] }
          : conv,
      );
    });

    setPromptText("");

    setTimeout(() => {
      const botMessageId = `bot-${Date.now()}`;
      const botMessage: ChatMessage = {
        id: botMessageId,
        role: "bot",
        content: "Just a sec...",
        loading: true,
      };

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === activeConversation
            ? { ...conv, title: newTitle, messages: [...conv.messages, botMessage] }
            : conv,
        ),
      );

      generateResponse(apiConversation, botMessageId);
    }, 300);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;
    event.preventDefault();
    const form = formRef.current;
    if (!form) return;
    if (form.requestSubmit) form.requestSubmit();
    else form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  };

  return (
    <form ref={formRef} className="prompt-form" onSubmit={handleSubmit}>
      <textarea
        placeholder="Message Think..."
        className="prompt-input"
        value={promptText}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
          setPromptText(event.target.value)
        }
        onKeyDown={handleKeyDown}
        rows={1}
        required
      />

      <button type="submit" className="send-prompt-btn">
        <ArrowUp size={20} />
      </button>
    </form>
  );
}
