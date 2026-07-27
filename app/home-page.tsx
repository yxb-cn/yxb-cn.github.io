"use client";

import { useEffect, useMemo, useState } from "react";
import { AboutSection } from "./about-section";
import { InlineLatexText } from "./latex-text";
import { MainContentSection } from "./main-content-section";
import { publicPath } from "./public-path";
import {
  defaultMainSections,
  sectionNavigationPlacement,
  siteContent,
  type SiteContent,
} from "./site-content";

export function HomePage() {
  const [previewContent, setPreviewContent] = useState<SiteContent | null>(null);
  const content = previewContent ?? siteContent;
  const mainSections = useMemo(
    () =>
      content.mainSections?.length
        ? content.mainSections
        : defaultMainSections,
    [content],
  );
  const visibleMainSections = useMemo(
    () =>
      mainSections.filter(
        (section) =>
          section.showOnHomepage !== false &&
          section.template !== "pageCollection",
      ),
    [mainSections],
  );
  const homeSection =
    visibleMainSections.find((section) => section.template === "about") ??
    visibleMainSections[0];
  const publicationsSectionId =
    visibleMainSections.find(
      (section) => section.dataKey === "publicationGroups",
    )?.id;
  const navigation = useMemo(
    () =>
      mainSections
        .filter(
          (section) =>
            section.showOnHomepage !== false &&
            sectionNavigationPlacement(section) !== "hidden" &&
            (section.navigationLabel.trim() || section.title.trim()),
        )
        .map((section) => ({
          id: section.id,
          label: section.navigationLabel.trim() || section.title,
          placement: sectionNavigationPlacement(section),
          href:
            section.template === "pageCollection"
              ? publicPath(`/${section.id}/`)
              : `#${section.id}`,
          independent: section.template === "pageCollection",
        })),
    [mainSections],
  );
  const topNavigation = navigation.filter(
    (item) => item.placement === "top",
  );
  const moreNavigation = navigation.filter(
    (item) => item.placement === "more",
  );
  const [activeSection, setActiveSection] = useState(
    homeSection?.id ?? "main-content",
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { profile } = content;
  const navPhotoPath = profile.navPhotoPath || profile.photoPath;

  useEffect(() => {
    const previewEnabled =
      new URLSearchParams(window.location.search).get("editorPreview") === "1";
    if (!previewEnabled) {
      return;
    }

    function receivePreview(event: MessageEvent) {
      if (event.origin !== window.location.origin) {
        return;
      }
      const message = event.data as {
        type?: string;
        content?: SiteContent;
      };
      if (
        message?.type !== "scholarcanvas:preview" ||
        !message.content?.profile ||
        !Array.isArray(message.content.mainSections)
      ) {
        return;
      }
      setPreviewContent(message.content);
    }

    window.addEventListener("message", receivePreview);
    window.parent.postMessage(
      { type: "scholarcanvas:preview-ready" },
      window.location.origin,
    );
    return () => window.removeEventListener("message", receivePreview);
  }, []);

  useEffect(() => {
    const sections = navigation
      .filter(({ independent }) => !independent)
      .map(({ id }) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]) {
          setActiveSection(visible[0].target.id);
        }
      },
      {
        rootMargin: "-18% 0px -65% 0px",
        threshold: [0.05, 0.2, 0.5],
      },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [navigation]);

  useEffect(() => {
    if (
      !window
        .matchMedia("(min-width: 721px) and (max-width: 960px)")
        .matches
    ) {
      return;
    }

    const activeLink = document.querySelector<HTMLAnchorElement>(
      `.top-nav a[href="#${activeSection}"]`,
    );
    activeLink?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeSection]);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="site-header">
        <div className="header-inner">
          <a
            className="wordmark"
            href={homeSection ? `#${homeSection.id}` : "#main-content"}
            aria-label="Back to introduction"
          >
            <span className="wordmark-seal" aria-hidden="true">
              {navPhotoPath ? (
                // User-uploaded files are served directly so local preview and
                // static GitHub Pages builds do not depend on an image optimizer.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={publicPath(navPhotoPath)} alt="" />
              ) : (
                profile.initials
              )}
            </span>
            <span>{profile.name}</span>
          </a>

          <nav className="top-nav" aria-label="Page sections">
            {topNavigation.map((item) => (
              <a
                key={item.id}
                className={activeSection === item.id ? "active" : ""}
                href={item.href}
                aria-current={
                  activeSection === item.id ? "location" : undefined
                }
              >
                {item.label}
              </a>
            ))}
            {moreNavigation.length > 0 && (
              <details className="more-nav">
                <summary
                  className={
                    moreNavigation.some(
                      (item) => activeSection === item.id,
                    )
                      ? "active"
                      : ""
                  }
                >
                  More
                  <span aria-hidden="true">⌄</span>
                </summary>
                <div className="more-nav-menu">
                  {moreNavigation.map((item) => (
                    <a
                      key={item.id}
                      className={activeSection === item.id ? "active" : ""}
                      href={item.href}
                      aria-current={
                        activeSection === item.id ? "location" : undefined
                      }
                      onClick={(event) =>
                        event.currentTarget
                          .closest("details")
                          ?.removeAttribute("open")
                      }
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              </details>
            )}
          </nav>

          <button
            className="mobile-nav-toggle"
            type="button"
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-page-sections"
            onClick={() => setMobileNavOpen((current) => !current)}
          >
            Sections
            <span aria-hidden="true">{mobileNavOpen ? "−" : "+"}</span>
          </button>

          <nav
            className={`mobile-nav-panel${mobileNavOpen ? " open" : ""}`}
            id="mobile-page-sections"
            aria-label="Mobile page sections"
          >
            {navigation.map((item) => (
              <a
                key={item.id}
                className={activeSection === item.id ? "active" : ""}
                href={item.href}
                aria-current={
                  activeSection === item.id ? "location" : undefined
                }
                onClick={() => setMobileNavOpen(false)}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main id="main-content">
        {visibleMainSections.map((section) =>
          section.template === "about" ? (
            <AboutSection
              sectionId={section.id}
              publicationsSectionId={publicationsSectionId}
              content={content}
              key={section.id}
            />
          ) : (
            <MainContentSection
              section={section}
              content={content}
              key={section.id}
            />
          ),
        )}
      </main>

      <footer className="site-footer">
        <div className="section-shell">
          <p>
            © {profile.copyrightYear} {profile.name}
          </p>
          <p>
            <InlineLatexText text={profile.footerNote} />
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
