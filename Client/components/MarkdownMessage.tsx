"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import type { Components } from "react-markdown";
import type { ReactNode } from "react";

type Props = {
  content: string;
  isUser?: boolean;
};

export function MarkdownMessage({ content, isUser = false }: Props) {
  const components: Components = {
    // Đoạn văn — không thêm margin thừa
    p({ children }) {
      return <p className="md-p">{children}</p>;
    },
    // In đậm
    strong({ children }) {
      return <strong className="md-strong">{children}</strong>;
    },
    // In nghiêng
    em({ children }) {
      return <em className="md-em">{children}</em>;
    },
    // Link — dùng Next.js Link để điều hướng cùng tab
    a({ href, children }) {
      const url = href?.startsWith("http") || href?.startsWith("/") ? href : "#";
      return (
        <Link href={url} className={`md-link${isUser ? " md-link--user" : ""}`}>
          {children as ReactNode}
        </Link>
      );
    },
    // Danh sách
    ul({ children }) {
      return <ul className="md-ul">{children}</ul>;
    },
    ol({ children }) {
      return <ol className="md-ol">{children}</ol>;
    },
    li({ children }) {
      return <li className="md-li">{children}</li>;
    },
    // Tiêu đề — thu nhỏ kích thước cho chat
    h1({ children }) {
      return <p className="md-h1">{children}</p>;
    },
    h2({ children }) {
      return <p className="md-h2">{children}</p>;
    },
    h3({ children }) {
      return <p className="md-h3">{children}</p>;
    },
    // Code inline
    code({ children, className }) {
      const isBlock = className?.includes("language-");
      if (isBlock) {
        return <pre className="md-pre"><code>{children}</code></pre>;
      }
      return <code className="md-code">{children}</code>;
    },
    // Đường kẻ ngang
    hr() {
      return <hr className="md-hr" />;
    },
    // Blockquote
    blockquote({ children }) {
      return <blockquote className="md-blockquote">{children}</blockquote>;
    },
  };

  return (
    <div className={`md-body${isUser ? " md-body--user" : ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
