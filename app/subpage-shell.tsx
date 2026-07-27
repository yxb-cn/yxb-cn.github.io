import type { ReactNode } from "react";
import { InlineLatexText } from "./latex-text";
import { siteContent } from "./site-content";
import { SubpageHeader } from "./subpage-header";

export function SubpageShell({
  activeSectionId,
  children,
}: {
  activeSectionId: string;
  children: ReactNode;
}) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <SubpageHeader activeSectionId={activeSectionId} />
      <main id="main-content">{children}</main>
      <footer className="site-footer">
        <div className="section-shell">
          <p>
            © {siteContent.profile.copyrightYear} {siteContent.profile.name}
          </p>
          <p>
            <InlineLatexText text={siteContent.profile.footerNote} />
          </p>
        </div>
      </footer>
      <a
        className="back-to-top"
        href="#main-content"
        aria-label="Back to top"
        title="Back to top"
      >
        Top ↑
      </a>
    </>
  );
}
