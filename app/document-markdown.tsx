import { Children, isValidElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { publicPath } from "./public-path";

export type DocumentHeading = {
  depth: number;
  id: string;
  title: string;
};

function plainText(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }
      if (isValidElement<{ children?: ReactNode }>(child)) {
        return plainText(child.props.children);
      }
      return "";
    })
    .join("");
}

function headingId(value: string) {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[`*_~[\](){}$\\]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "section";
}

export function documentHeadings(markdown: string): DocumentHeading[] {
  return [...markdown.matchAll(/^(#{1,3})\s+(.+?)\s*#*\s*$/gm)].map(
    (match) => ({
      depth: match[1].length,
      title: match[2].replace(/[*_`~[\]]/g, "").trim(),
      id: headingId(match[2]),
    }),
  );
}

function MarkdownLink({
  href,
  children,
}: {
  href?: string;
  children?: ReactNode;
}) {
  const external = Boolean(href && /^https?:\/\//i.test(href));
  const resolvedHref = href?.startsWith("/") ? publicPath(href) : href;

  return (
    <a
      href={resolvedHref}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer noopener" : undefined}
    >
      {children}
    </a>
  );
}

function headingComponent(
  Tag: "h1" | "h2" | "h3",
): NonNullable<Components[typeof Tag]> {
  const MarkdownHeading = ({ children }: { children?: ReactNode }) => {
    const title = plainText(children);
    return <Tag id={headingId(title)}>{children}</Tag>;
  };
  MarkdownHeading.displayName = `Markdown${Tag.toUpperCase()}`;
  return MarkdownHeading;
}

const components: Components = {
  a: MarkdownLink,
  img: ({ src, alt }) => {
    const resolvedSrc =
      typeof src === "string" && src.startsWith("/") ? publicPath(src) : src;
    return (
      // Markdown page images are user-managed content and may have arbitrary sizes.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={resolvedSrc} alt={alt ?? ""} />
    );
  },
  h1: headingComponent("h1"),
  h2: headingComponent("h2"),
  h3: headingComponent("h3"),
};

export function DocumentMarkdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[[rehypeKatex, { strict: false, trust: false }]]}
      components={components}
    >
      {text}
    </ReactMarkdown>
  );
}
