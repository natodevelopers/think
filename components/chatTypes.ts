export type Theme = "light" | "dark";

export type ChatRole = "user" | "bot";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  loading?: boolean;
  error?: boolean;
  liked?: boolean;
};

export type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
};
