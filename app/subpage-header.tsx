"use client";

import { useMemo, useState } from "react";
import { publicPath } from "./public-path";
import {
  defaultMainSections,
  sectionNavigationPlacement,
  siteContent,
} from "./site-content";

export function SubpageHeader({
  activeSectionId,
}: {
  activeSectionId: string;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const sections = useMemo(
    () =>
      siteContent.mainSections?.length
        ? siteContent.mainSections
        : defaultMainSections,
    [],
  );
  const navigation = sections
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
          : publicPath(`/#${section.id}`),
    }));
  const topNavigation = navigation.filter(
    (item) => item.placement === "top",
  );
  const moreNavigation = navigation.filter(
    (item) => item.placement === "more",
  );
  const { profile } = siteContent;
  const navPhotoPath = profile.navPhotoPath || profile.photoPath;
  const homeSection =
    sections.find(
      (section) =>
        section.template === "about" && section.showOnHomepage !== false,
    ) ?? sections[0];

  return (
    <header className="site-header">
      <div className="header-inner">
        <a
          className="wordmark"
          href={publicPath(homeSection ? `/#${homeSection.id}` : "/")}
          aria-label="Back to homepage"
        >
          <span className="wordmark-seal" aria-hidden="true">
            {navPhotoPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={publicPath(navPhotoPath)} alt="" />
            ) : (
              profile.initials
            )}
          </span>
          <span>{profile.name}</span>
        </a>

        <nav className="top-nav" aria-label="Site sections">
          {topNavigation.map((item) => (
            <a
              className={activeSectionId === item.id ? "active" : ""}
              href={item.href}
              aria-current={
                activeSectionId === item.id ? "page" : undefined
              }
              key={item.id}
            >
              {item.label}
            </a>
          ))}
          {moreNavigation.length > 0 && (
            <details className="more-nav">
              <summary
                className={
                  moreNavigation.some(
                    (item) => activeSectionId === item.id,
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
                    className={
                      activeSectionId === item.id ? "active" : ""
                    }
                    href={item.href}
                    aria-current={
                      activeSectionId === item.id ? "page" : undefined
                    }
                    onClick={(event) =>
                      event.currentTarget
                        .closest("details")
                        ?.removeAttribute("open")
                    }
                    key={item.id}
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
          aria-controls="mobile-site-sections"
          onClick={() => setMobileNavOpen((current) => !current)}
        >
          Sections
          <span aria-hidden="true">{mobileNavOpen ? "−" : "+"}</span>
        </button>

        <nav
          className={`mobile-nav-panel${mobileNavOpen ? " open" : ""}`}
          id="mobile-site-sections"
          aria-label="Mobile site sections"
        >
          {navigation.map((item) => (
            <a
              className={activeSectionId === item.id ? "active" : ""}
              href={item.href}
              aria-current={
                activeSectionId === item.id ? "page" : undefined
              }
              onClick={() => setMobileNavOpen(false)}
              key={item.id}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
