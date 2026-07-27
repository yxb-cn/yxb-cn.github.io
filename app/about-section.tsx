"use client";

import { useEffect, useRef, useState } from "react";
import { InlineLatexText, LatexText } from "./latex-text";
import { publicPath } from "./public-path";
import { siteContent, type SiteContent } from "./site-content";

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <span aria-hidden="true" className="arrow">
      {diagonal ? "↗" : "→"}
    </span>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      className="copy-button"
      type="button"
      onClick={copyValue}
      aria-label={`Copy ${value}`}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function ProfileLinks({
  contacts,
  mobile = false,
}: {
  contacts: typeof siteContent.contacts;
  mobile?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeExpandedLinks(event: PointerEvent) {
      const container = containerRef.current;
      if (
        !container ||
        !(event.target instanceof Node) ||
        container.contains(event.target)
      ) {
        return;
      }

      container
        .querySelectorAll<HTMLDetailsElement>("details[open]")
        .forEach((details) => {
          details.open = false;
        });
    }

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      containerRef.current
        ?.querySelectorAll<HTMLDetailsElement>("details[open]")
        .forEach((details) => {
          details.open = false;
        });
    }

    document.addEventListener("pointerdown", closeExpandedLinks);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeExpandedLinks);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`profile-links${mobile ? " mobile-profile-links" : ""}`}
      aria-label="Academic profiles"
    >
      {contacts.map((contact) => (
        <details
          className="profile-link-item"
          name={mobile ? "mobile-profile-link" : "profile-link"}
          key={contact.label}
        >
          <summary>{contact.label}</summary>
          <div className="profile-link-popover">
            {contact.entries.map((entry, index) => {
              const external = /^https?:\/\//i.test(entry.url);
              const href =
                contact.label === "Email" &&
                !entry.url.startsWith("mailto:")
                  ? `mailto:${entry.url}`
                  : publicPath(entry.url);

              return (
                <div
                  className="profile-link-row"
                  key={`${entry.text}-${index}`}
                >
                  <a
                    href={href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noreferrer" : undefined}
                  >
                    {entry.text}
                  </a>
                  {entry.copyValue && <CopyButton value={entry.copyValue} />}
                </div>
              );
            })}
          </div>
        </details>
      ))}
    </div>
  );
}

export function AboutSection({
  sectionId,
  publicationsSectionId,
  content = siteContent,
}: {
  sectionId: string;
  publicationsSectionId?: string;
  content?: SiteContent;
}) {
  const { profile, contacts } = content;
  const profileFacts = profile.facts.filter(
    (fact) => fact.label.trim() || fact.value.trim(),
  );

  return (
    <section className="hero section-shell" id={sectionId}>
      <aside className="profile-card" aria-label="Academic profile">
        <div className="portrait" aria-hidden={!profile.photoPath}>
          {profile.photoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={publicPath(profile.photoPath)}
              alt={`${profile.name} portrait`}
            />
          ) : (
            <span>{profile.initials}</span>
          )}
        </div>
        <div className="profile-details">
          <dl>
            {profileFacts.map((fact, index) => (
              <div key={`${fact.label}-${index}`}>
                <dt>
                  <InlineLatexText text={fact.label} />
                </dt>
                <dd>
                  <InlineLatexText text={fact.value} />
                </dd>
              </div>
            ))}
          </dl>
          <ProfileLinks contacts={contacts} />
        </div>
      </aside>

      <div className="hero-copy">
        <div className="hero-name-row">
          <h1>{profile.name}</h1>
          {profile.nameChinese && (
            <div className="name-meta">
              <span lang="zh-CN">{profile.nameChinese}</span>
            </div>
          )}
        </div>
        {(profile.position || profile.affiliation) && (
          <p className="hero-position">
            <InlineLatexText text={profile.position} />
            {profile.affiliation && (
              <span className="hero-affiliation">
                <InlineLatexText text={profile.affiliation} />
              </span>
            )}
          </p>
        )}
        <div
          className={`mobile-profile-summary${
            profile.photoPath ? " with-photo" : ""
          }`}
          aria-label="Academic profile and contact links"
        >
          {profile.photoPath && (
            <div className="mobile-portrait">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={publicPath(profile.photoPath)}
                alt={`${profile.name} portrait`}
              />
            </div>
          )}
          <dl className="mobile-profile-meta">
            {profileFacts.map((fact, index) => (
              <div key={`${fact.label}-${index}`}>
                <dt>
                  <InlineLatexText text={fact.label} />
                </dt>
                <dd>
                  <InlineLatexText text={fact.value} />
                </dd>
              </div>
            ))}
          </dl>
          <ProfileLinks contacts={contacts} mobile />
        </div>
        {profile.bio.length > 0 && (
          <div className="hero-bio" lang="en">
            {profile.bio.filter(Boolean).map((paragraph, index) => (
              <LatexText
                key={`${paragraph.slice(0, 24)}-${index}`}
                text={paragraph}
              />
            ))}
          </div>
        )}
        {profile.interests.length > 0 && (
          <ul className="hero-topics" aria-label="Research interests">
            {profile.interests.filter(Boolean).map((interest) => (
              <li key={interest}>
                <InlineLatexText text={interest} />
              </li>
            ))}
          </ul>
        )}
        <div className="hero-links" aria-label="Primary links">
          {publicationsSectionId && (
            <a
              className="button button-primary"
              href={`#${publicationsSectionId}`}
            >
              Publications <Arrow />
            </a>
          )}
          {profile.cvPath && (
            <a
              className="button button-secondary"
              href={publicPath(profile.cvPath)}
              target="_blank"
              rel="noreferrer"
            >
              Curriculum vitae <Arrow diagonal />
            </a>
          )}
        </div>
        <p className="last-updated">
          Last updated <time>{profile.lastUpdated}</time>
        </p>
      </div>
    </section>
  );
}
