import { NextResponse } from "next/server";

type IncomingMessage = {
  role?: string;
  content?: string;
  parts?: Array<{ text?: string }>;
};

type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const DEFAULT_SYSTEM_PROMPT = `Bạn là Think, trợ lý AI do Nato Developers phát triển.

Yêu cầu bắt buộc:
- Luôn trả lời theo ngôn ngữ của yêu cầu người dùng, rõ ràng và hữu ích.
- Không được bịa đặt sự thật. Nếu không chắc chắn, hãy nói rõ "mình không chắc" và hỏi lại/đề xuất cách kiểm chứng.
- Khi người dùng yêu cầu danh sách công cụ/dịch vụ/sản phẩm: chỉ nêu tên những thứ bạn thật sự tự tin; nếu không tự tin thì mô tả theo nhóm (ví dụ: "render farm hỗ trợ Blender", "GPU cloud") thay vì bịa tên cụ thể.
- Tránh khẳng định "dịch vụ X làm được Y" nếu không chắc. Có thể ghi chú mức độ tin cậy (ví dụ: "chắc chắn", "có thể", "không chắc").

Quy tắc danh tính:
- Nếu người dùng hỏi về danh tính (ví dụ: "Tên bạn là gì?"), hãy trả lời đúng câu: "Tôi là Think, được phát triển bởi Nato Developers."`;

function normalizeIncomingMessages(body: any): IncomingMessage[] {
  if (Array.isArray(body?.messages)) return body.messages;
  if (Array.isArray(body?.contents)) return body.contents;
  if (Array.isArray(body?.conversation?.messages)) return body.conversation.messages;
  return [];
}

function parseFewShot(raw: string | undefined): OpenAIMessage[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as any[])
      .map((m) => ({
        role: m?.role as OpenAIMessage["role"],
        content: String(m?.content ?? ""),
      }))
      .filter(
        (m) =>
          (m.role === "system" || m.role === "user" || m.role === "assistant") &&
          m.content.trim().length > 0,
      );
  } catch {
    return [];
  }
}

function toOpenAIMessages(incoming: IncomingMessage[]): OpenAIMessage[] {
  return incoming
    .map((m) => {
      const roleRaw = String(m.role ?? "user");
      const role: OpenAIMessage["role"] =
        roleRaw === "bot" || roleRaw === "model" || roleRaw === "assistant"
          ? "assistant"
          : roleRaw === "system"
            ? "system"
            : "user";

      const contentFromParts = Array.isArray(m.parts)
        ? m.parts.map((p) => p?.text ?? "").join("")
        : "";
      const content = String(m.content ?? contentFromParts ?? "").trim();

      return { role, content };
    })
    .filter((m) => m.content.length > 0);
}

function looksLikeOutOfCredits(status: number, data: any): boolean {
  if (status === 402) return true;
  if (status === 429) return true;
  const message = String(data?.error?.message ?? data?.message ?? "").toLowerCase();
  const code = String(data?.error?.code ?? "").toLowerCase();
  return (
    message.includes("insufficient") ||
    message.includes("credit") ||
    message.includes("quota") ||
    message.includes("billing") ||
    code.includes("insufficient") ||
    code.includes("quota") ||
    code.includes("billing")
  );
}

async function callChatCompletions({
  provider,
  apiKey,
  baseUrl,
  model,
  messages,
  extraHeaders,
}: {
  provider: "groq" | "openrouter";
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: OpenAIMessage[];
  extraHeaders?: Record<string, string>;
}): Promise<{ ok: true; text: string } | { ok: false; status: number; data: any }> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(extraHeaders ?? {}),
    },
    body: JSON.stringify({
      model,
      messages,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status, data };

  const text = String(data?.choices?.[0]?.message?.content ?? "").trim();
  return { ok: true, text };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const incoming = normalizeIncomingMessages(body);
  const messages = toOpenAIMessages(incoming);

  const systemPrompt =
    process.env.THINK_SYSTEM_PROMPT ??
    process.env.CHAT_SYSTEM_PROMPT ??
    DEFAULT_SYSTEM_PROMPT;
  const fewShot = parseFewShot(process.env.THINK_FEWSHOT);
  const finalMessages: OpenAIMessage[] = [
    { role: "system", content: systemPrompt },
    ...fewShot,
    ...messages,
  ];

  if (messages.length === 0) {
    return NextResponse.json(
      { error: { message: "No messages provided." } },
      { status: 400 },
    );
  }

  const groqKey = process.env.GROQ_API_KEY ?? process.env.VITE_GROQ_KEY;
  const openRouterKey =
    process.env.OPENROUTER_API_KEY ?? process.env.VITE_OPENROUTER_KEY;

  if (!groqKey && !openRouterKey) {
    return NextResponse.json(
      {
        error: {
          message:
            "Missing GROQ_API_KEY / OPENROUTER_API_KEY (or VITE_GROQ_KEY / VITE_OPENROUTER_KEY).",
        },
      },
      { status: 500 },
    );
  }

  const groqModel =
    process.env.GROQ_MODEL ?? body?.groqModel ?? "llama-3.1-8b-instant";
  const openRouterModel =
    process.env.OPENROUTER_MODEL ??
    body?.openRouterModel ??
    "meta-llama/llama-3.1-8b-instruct";

  if (groqKey) {
    const groq = await callChatCompletions({
      provider: "groq",
      apiKey: groqKey,
      baseUrl: "https://api.groq.com/openai/v1",
      model: groqModel,
      messages: finalMessages,
    });

    if (groq.ok) {
      return NextResponse.json({ text: groq.text, provider: "groq" });
    }

    if (!openRouterKey || !looksLikeOutOfCredits(groq.status, groq.data)) {
      return NextResponse.json(
        { error: groq.data?.error ?? { message: "Groq request failed." } },
        { status: groq.status || 500 },
      );
    }
  }

  if (!openRouterKey) {
    return NextResponse.json(
      { error: { message: "OpenRouter key missing for fallback." } },
      { status: 500 },
    );
  }

  const openRouter = await callChatCompletions({
    provider: "openrouter",
    apiKey: openRouterKey,
    baseUrl: "https://openrouter.ai/api/v1",
    model: openRouterModel,
    messages: finalMessages,
    extraHeaders: {
      ...(process.env.OPENROUTER_SITE_URL
        ? { "HTTP-Referer": process.env.OPENROUTER_SITE_URL }
        : {}),
      ...(process.env.OPENROUTER_APP_NAME
        ? { "X-Title": process.env.OPENROUTER_APP_NAME }
        : {}),
    },
  });

  if (!openRouter.ok) {
    return NextResponse.json(
      {
        error: openRouter.data?.error ?? { message: "OpenRouter request failed." },
      },
      { status: openRouter.status || 500 },
    );
  }

  return NextResponse.json({ text: openRouter.text, provider: "openrouter" });
}
