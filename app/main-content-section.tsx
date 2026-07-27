"use client";

import { Fragment, useState } from "react";
import { getBibtexPublicationDetails } from "./bibtex";
import { InlineLatexText, LatexText } from "./latex-text";
import { publicPath } from "./public-path";
import { getSectionDefinition } from "./section-registry";
import {
  siteContent,
  type ContentLink,
  type MainSection,
  type PublicationAuthor,
  type SiteContent,
} from "./site-content";

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <span aria-hidden="true" className="arrow">
      {diagonal ? "↗" : "→"}
    </span>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="section-heading">
      <div>
        <h2>
          <InlineLatexText text={title} />
        </h2>
      </div>
    </div>
  );
}

function Coauthors({ authors }: { authors: PublicationAuthor[] }) {
  const coauthors = authors.filter((author) => !author.self);

  if (coauthors.length === 0) {
    return null;
  }

  return (
    <span className="coauthors">
      {" "}
      (with{" "}
      {coauthors.map((author, index) => {
        const isLast = index === coauthors.length - 1;
        const separator =
          index === 0
            ? ""
            : coauthors.length === 2
              ? " and "
              : isLast
                ? ", and "
                : ", ";

        return (
          <Fragment key={`${author.name}-${index}`}>
            {separator}
            <InlineLatexText text={author.name} />
            {author.corresponding && (
              <sup
                className="corresponding-author-mark"
                aria-label={`${author.name} is a corresponding author`}
              >
                {"\u2709"}
              </sup>
            )}
          </Fragment>
        );
      })}
      )
    </span>
  );
}

function TalkContribution({ text }: { text: string }) {
  const [presentation, ...details] = text.split(" · ");

  if (details.length === 0) {
    return <InlineLatexText text={text} />;
  }

  return (
    <>
      <InlineLatexText text={presentation} /> {" · "}
      <strong>
        <InlineLatexText text={details.join(" · ")} />
      </strong>
    </>
  );
}

function PublicationTools({
  links,
  abstract,
  abstractId,
}: {
  links: ContentLink[];
  abstract: string;
  abstractId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleLinks = links.filter((link) => link.label && link.url);

  if (!abstract && visibleLinks.length === 0) {
    return null;
  }

  return (
    <div className="publication-tools">
      {abstract && (
        <button
          className="abstract-toggle"
          type="button"
          aria-expanded={expanded}
          aria-controls={abstractId}
          onClick={() => setExpanded((current) => !current)}
        >
          Abstract
        </button>
      )}
      <div className="publication-actions">
        {visibleLinks.map((link, index) => {
          const external = /^https?:\/\//i.test(link.url);
          return (
            <a
              href={publicPath(link.url)}
              key={`${link.label}-${index}`}
              target={external ? "_blank" : undefined}
              rel={external ? "noreferrer" : undefined}
            >
              {link.label} <Arrow diagonal />
            </a>
          );
        })}
      </div>
      {abstract && expanded && (
        <div className="publication-abstract" id={abstractId}>
          <LatexText text={abstract} />
        </div>
      )}
    </div>
  );
}

function sectionContent(section: MainSection, content: SiteContent) {
  if (section.dataKey) {
    return content[section.dataKey];
  }
  return section.content ?? [];
}

export function MainContentSection({
  section,
  content = siteContent,
}: {
  section: MainSection;
  content?: SiteContent;
}) {
  const sectionItems = sectionContent(section, content);
  const renderer = getSectionDefinition(section.template)?.renderer;

  if (renderer === "education") {
    const items = sectionItems as typeof siteContent.education;
    return (
      <section className="content-section section-shell" id={section.id}>
        <SectionHeading title={section.title} />
        <div className="education-list">
          {items.map((item, index) => (
            <article
              className="education-item"
              key={`${item.period}-${item.degree}-${index}`}
            >
              <time>{item.period}</time>
              <div>
                <h3>
                  <InlineLatexText text={item.degree} />
                </h3>
                <p className="education-institution">
                  <InlineLatexText text={item.institution} />
                </p>
              </div>
              <p className="education-details">
                <InlineLatexText text={item.details} />
              </p>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (renderer === "researchTopics") {
    const items = sectionItems as typeof siteContent.researchTopics;
    return (
      <section className="content-section section-shell" id={section.id}>
        <SectionHeading title={section.title} />
        <div className="research-grid">
          {items.map((area, index) => (
            <article
              className="research-area"
              key={`${area.number}-${area.title}-${index}`}
            >
              <p className="research-number">{area.number}</p>
              <h3>
                <InlineLatexText text={area.title} />
              </h3>
              <p>
                <InlineLatexText text={area.text} />
              </p>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (renderer === "publicationGroups") {
    const groups = (sectionItems as typeof siteContent.publicationGroups)
      .map((group) => ({
        ...group,
        papers: group.papers.filter(
          (paper) => paper.showOnHomepage !== false,
        ),
      }))
      .filter((group) => group.papers.length > 0);

    return (
      <section className="content-section section-shell" id={section.id}>
        <SectionHeading title={section.title} />
        {groups.map((group) => (
          <div className="publication-group" key={group.id}>
            <div className="publication-group-heading">
              <h3>
                <InlineLatexText text={group.title} />
              </h3>
              <span>
                {group.papers.length}{" "}
                {group.papers.length === 1 ? "paper" : "papers"}
              </span>
            </div>
            <div className="publication-list">
              {group.papers.map((paper, index) => {
                const bibliography = getBibtexPublicationDetails(paper.bibtex);
                const publicationVenue = bibliography?.venue || paper.venue;
                const publicationYear =
                  paper.year || bibliography?.year || "";
                const publicationDetails = [
                  publicationVenue,
                  bibliography?.volumeIssuePages,
                ]
                  .filter(Boolean)
                  .join(", ");
                const selfIsCorresponding = paper.authors.some(
                  (author) => author.self && author.corresponding,
                );

                return (
                  <article
                    className="publication"
                    key={`${paper.title}-${index}`}
                  >
                    <div className="publication-meta">
                      {paper.type && (
                        <span>
                          <InlineLatexText text={paper.type} />
                        </span>
                      )}
                      {publicationYear && <time>{publicationYear}</time>}
                    </div>
                    <div className="publication-body">
                      <h3>
                        {paper.url ? (
                          <a
                            href={publicPath(paper.url)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <InlineLatexText text={paper.title} />
                            {selfIsCorresponding && (
                              <sup
                                className="corresponding-author-mark"
                                aria-label="The site owner is a corresponding author"
                              >
                                {"\u2709"}
                              </sup>
                            )}
                            {"\u00A0"}
                            <Arrow diagonal />
                          </a>
                        ) : (
                          <>
                            <InlineLatexText text={paper.title} />
                            {selfIsCorresponding && (
                              <sup
                                className="corresponding-author-mark"
                                aria-label="The site owner is a corresponding author"
                              >
                                {"\u2709"}
                              </sup>
                            )}
                          </>
                        )}
                        <Coauthors authors={paper.authors} />
                      </h3>
                      {(publicationDetails || paper.note) && (
                        <p className="venue">
                          {publicationDetails && (
                            <em>
                              <InlineLatexText text={publicationDetails} />
                            </em>
                          )}
                          {paper.note && (
                            <span className="publication-note">
                              <InlineLatexText text={paper.note} />
                            </span>
                          )}
                        </p>
                      )}
                      <PublicationTools
                        links={paper.links}
                        abstract={paper.abstract}
                        abstractId={`${section.id}-${group.id}-abstract-${index}`}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
        {section.dataKey === "publicationGroups" &&
          content.profile.publicationNote && (
            <p className="section-note">
              <InlineLatexText text={content.profile.publicationNote} />
            </p>
          )}
      </section>
    );
  }

  if (renderer === "projects") {
    const items = sectionItems as typeof siteContent.projects;
    return (
      <section className="content-section section-shell" id={section.id}>
        <SectionHeading title={section.title} />
        <div className="project-list">
          {items.map((project, index) => (
            <article
              className="project-row"
              key={`${project.title}-${index}`}
            >
              <p className="project-period">{project.period}</p>
              <div className="project-body">
                <div className="project-labels">
                  <span>
                    <InlineLatexText text={project.type} />
                  </span>
                  <span>
                    <InlineLatexText text={project.role} />
                  </span>
                </div>
                <h4>
                  <InlineLatexText text={project.title} />
                </h4>
                <p className="project-funder">
                  <InlineLatexText text={project.funder} />
                </p>
                <p className="project-details">
                  {project.grantNumber && (
                    <span>
                      <InlineLatexText text={project.grantNumber} />
                    </span>
                  )}
                  {project.principalInvestigator && (
                    <span>
                      <InlineLatexText text={project.principalInvestigator} />
                    </span>
                  )}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (renderer === "codeProjects") {
    const items = sectionItems as typeof siteContent.codeProjects;
    return (
      <section className="content-section section-shell" id={section.id}>
        <SectionHeading title={section.title} />
        <div className="code-list">
          {items.map((project, index) => (
            <article className="code-item" key={`${project.title}-${index}`}>
              <div className="publication-meta">
                <span>
                  <InlineLatexText text={project.type} />
                </span>
              </div>
              <div className="code-body">
                <h3>
                  {project.url ? (
                    <a
                      href={publicPath(project.url)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <InlineLatexText text={project.title} />{" "}
                      <Arrow diagonal />
                    </a>
                  ) : (
                    <InlineLatexText text={project.title} />
                  )}
                </h3>
                <p>
                  <InlineLatexText text={project.description} />
                </p>
                {project.technologies.length > 0 && (
                  <div className="code-footer">
                    <ul aria-label={`${project.title} technologies`}>
                      {project.technologies
                        .filter(Boolean)
                        .map((technology) => (
                          <li key={technology}>
                            <InlineLatexText text={technology} />
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (renderer === "talks") {
    const items = sectionItems as typeof siteContent.talks;
    return (
      <section className="content-section section-shell" id={section.id}>
        <SectionHeading title={section.title} />
        <div className="talk-list">
          {items.map((talk, index) => (
            <article
              className="talk-item"
              key={`${talk.date}-${talk.event}-${index}`}
            >
              <time>{talk.date}</time>
              <div>
                <h3>
                  <InlineLatexText text={talk.event} />
                </h3>
                <p>
                  <TalkContribution text={talk.contribution} />
                </p>
              </div>
              <p className="talk-location">
                <InlineLatexText text={talk.location} />
              </p>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (renderer === "serviceAndSkills") {
    const items = sectionItems as typeof siteContent.serviceAndSkills;
    return (
      <section className="content-section section-shell" id={section.id}>
        <SectionHeading title={section.title} />
        <div className="service-list">
          {items.map((group, index) => (
            <article
              className="service-row"
              key={`${group.title}-${index}`}
            >
              <h3>
                <InlineLatexText text={group.title} />
              </h3>
              <ul aria-label={group.title}>
                {group.items.filter(Boolean).map((item) => (
                  <li key={item}>
                    {group.title === "Referee Service" ? (
                      <em>
                        <InlineLatexText text={item} />
                      </em>
                    ) : (
                      <InlineLatexText text={item} />
                    )}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return null;
}
