import rehypeKatex from "rehype-katex";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkMath from "remark-math";

const katexOptions = { strict: false, trust: false } as const;

const MarkdownLink: NonNullable<Components["a"]> = ({ href, children }) => {
  const external = Boolean(href && /^https?:\/\//i.test(href));

  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer noopener" : undefined}
    >
      {children}
    </a>
  );
};

const markdownComponents: Components = {
  a: MarkdownLink,
};

const inlineComponents: Components = {
  a: MarkdownLink,
  p: ({ children }) => <span>{children}</span>,
  h1: ({ children }) => <span>{children}</span>,
  h2: ({ children }) => <span>{children}</span>,
  h3: ({ children }) => <span>{children}</span>,
  h4: ({ children }) => <span>{children}</span>,
  h5: ({ children }) => <span>{children}</span>,
  h6: ({ children }) => <span>{children}</span>,
  blockquote: ({ children }) => <span>{children}</span>,
  ul: ({ children }) => <span>{children}</span>,
  ol: ({ children }) => <span>{children}</span>,
  li: ({ children }) => <span>{children} </span>,
};

export function LatexText({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[[rehypeKatex, katexOptions]]}
      components={markdownComponents}
    >
      {text}
    </ReactMarkdown>
  );
}

export function InlineLatexText({ text }: { text: string }) {
  return (
    <span className="markdown-inline">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, katexOptions]]}
        components={inlineComponents}
      >
        {text}
      </ReactMarkdown>
    </span>
  );
}
