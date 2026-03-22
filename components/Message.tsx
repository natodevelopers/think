"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { Copy, Play, RefreshCcw, ThumbsUp, X } from "lucide-react";
import hljs from "highlight.js";

import type { ChatMessage } from "./chatTypes";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

export type MessageProps = {
  conversationId?: string;
  message: ChatMessage;
  onCopy?: (conversationId: string, messageId: string) => void | Promise<void>;
  onRegenerate?: (conversationId: string, messageId: string) => void;
  onToggleLike?: (conversationId: string, messageId: string) => void;
};

function getLanguageFromClassName(className: string | undefined) {
  if (!className) return null;
  const match = className.match(/language-([\w-]+)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function extractCodeFromPre(children: ReactNode): {
  code: string;
  className?: string;
} | null {
  const first = Array.isArray(children) ? children[0] : children;
  const anyEl = first as any;
  if (!anyEl?.props) return null;
  const code = String(anyEl.props.children ?? "").replace(/\n$/, "");
  const className = anyEl.props.className as string | undefined;
  return { code, className };
}

function PreBlock({ children }: { children?: ReactNode }) {
  const extracted = extractCodeFromPre(children ?? "");
  const code = extracted?.code ?? "";
  const specifiedLanguage = getLanguageFromClassName(extracted?.className);

  const highlighted = useMemo(() => {
    if (!code) return { html: "", language: specifiedLanguage ?? null };
    try {
      if (specifiedLanguage && hljs.getLanguage(specifiedLanguage)) {
        const res = hljs.highlight(code, { language: specifiedLanguage });
        return { html: res.value, language: specifiedLanguage };
      }
      const res = hljs.highlightAuto(code);
      return { html: res.value, language: res.language ?? null };
    } catch {
      return { html: escapeHtml(code), language: specifiedLanguage ?? null };
    }
  }, [code, specifiedLanguage]);

  const detected = highlighted.language ?? specifiedLanguage ?? "";
  const isHtml =
    detected === "html" ||
    detected === "xml" ||
    specifiedLanguage === "html" ||
    specifiedLanguage === "xml";

  return (
    <div className="codeblock" data-lang={detected || undefined}>
      {isHtml && (
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className="codeblock-play"
              aria-label="Chạy HTML"
              title="Chạy HTML"
              onClick={(e) => e.stopPropagation()}
            >
              <Play size={16} />
            </button>
          </DialogTrigger>

          <DialogContent className="code-preview-dialog">
            <div className="code-preview-header">
              <DialogTitle className="code-preview-title">
                 
              </DialogTitle>
              <DialogClose asChild>
                <button
                  type="button"
                  className="code-preview-close"
                  aria-label="Đóng"
                >
                  <X size={16} />
                </button>
              </DialogClose>
            </div>

            <iframe
              className="code-preview-frame"
              sandbox=""
              srcDoc={code}
              title="HTML Preview"
            />
          </DialogContent>
        </Dialog>
      )}

      <pre className="hljs">
        <code dangerouslySetInnerHTML={{ __html: highlighted.html }} />
      </pre>
    </div>
  );
}

export default function Message({
  conversationId,
  message,
  onCopy,
  onRegenerate,
  onToggleLike,
}: MessageProps) {
  const showActions =
    message.role === "bot" && Boolean(conversationId) && !message.loading;

  return (
    <div
      id={message.id}
      className={`message ${message.role}-message ${message.loading ? "loading" : ""} ${
        message.error ? "error" : ""
      }`}
    >
      {message.role === "bot" && (
        <Image
          className="avatar"
          src="/gemini.svg"
          alt="Bot Avatar"
          width={43}
          height={43}
        />
      )}

      <div className="message-content">
        <div className="text">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkBreaks]}
            components={{
              a: ({ href, children, ...props }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  {...props}
                >
                  {children}
                </a>
              ),
              pre: (props: any) => <PreBlock>{props?.children}</PreBlock>,
              code: (props: any) => (
                <code className={props?.className}>{props?.children}</code>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>

          {message.loading && <span className="typing-dot" aria-hidden="true" />}
        </div>

        {showActions && (
          <div className="message-actions">
            <button
              type="button"
              className="message-action-btn"
              onClick={() => onRegenerate?.(conversationId!, message.id)}
              aria-label="Trả lời lại"
              title="Trả lời lại"
            >
              <RefreshCcw size={16} />
              <span>Trả lời lại</span>
            </button>

            <button
              type="button"
              className="message-action-btn"
              onClick={() => onCopy?.(conversationId!, message.id)}
              aria-label="Sao chép"
              title="Sao chép"
            >
              <Copy size={16} />
              <span>Sao chép</span>
            </button>

            <button
              type="button"
              className={`message-action-btn ${message.liked ? "active" : ""}`}
              onClick={() => onToggleLike?.(conversationId!, message.id)}
              aria-label="Câu trả lời tốt"
              title="Câu trả lời tốt"
            >
              <ThumbsUp size={16} />
              <span>Tốt</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
