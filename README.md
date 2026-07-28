<div align="center">

# ScholarCanvas

**Build and maintain your academic homepage with a visual editor.**

_Edit publications, sections, pages, and files from one local workspace._

<a href="./README.zh-CN.md"><img src="https://img.shields.io/badge/To%20Chinese%20version-%E2%86%92-C2410C.svg?style=for-the-badge" alt="To Chinese version"></a>

<a href="https://yxb-cn.github.io/scholarcanvas/" target="_blank" rel="noopener noreferrer">Template Demo ↗</a> · <a href="https://yxb-cn.github.io/" target="_blank" rel="noopener noreferrer">Author Website ↗</a> · <a href="#quick-start">Quick Start</a>

[![MIT License](https://img.shields.io/badge/license-MIT-173a5e.svg)](LICENSE) ![Pages URL](https://img.shields.io/badge/GitHub%20Pages-URL%20auto--detected-173a5e.svg) ![BibTeX](https://img.shields.io/badge/BibTeX-bulk%20import-173a5e.svg) ![Live Preview](https://img.shields.io/badge/preview-live%20desktop%20%2B%20mobile-173a5e.svg) ![One-click Editors](https://img.shields.io/badge/launchers-Windows%20%2B%20macOS-173a5e.svg)

</div>

<p align="center">
  <img src="public/screenshots/device-preview.png" width="96%" alt="ScholarCanvas responsive homepage previews">
</p>


ScholarCanvas turns an academic homepage repository into a visual workspace: edit the content, watch the responsive site update, and publish a static GitHub Pages site without hand-editing components or calculating repository URLs.

## Why use ScholarCanvas?

| Feature | Why it matters |
| --- | --- |
| **A repository-native visual editor** | Edit profile information, publications, navigation, photos, CV files, and custom sections without hand-editing components. Every change is written back to ordinary repository files that can be reviewed, versioned, and committed. |
| **Live desktop and mobile preview** | Switch device widths inside the editor and see unsaved changes immediately. Check navigation, typography, photos, and long text before writing anything to disk. |
| **One versioned content source** | `content/site-content.json` controls both academic content and homepage structure, while documents and page assets stay in predictable folders. |
| **A publication workflow designed for researchers** | Collapse long paper forms, drag papers between statuses, mark corresponding authors, control visibility, and write Markdown/LaTeX abstracts. Import a complete `.bib` file in one step while preserving journal, volume, issue, page, and year details. |
| **Flexible, template-driven sections** | Reorder sections, choose where they appear in navigation, or create Teaching, Awards, Work Experience, Courses, and Blog sections by reusing an existing layout. |
| **Long-form pages without leaving the editor** | Write or import Markdown, preview LaTeX, generate a table of contents, and upload images or PDFs into a dedicated folder for each entry. |
| **Automatic GitHub Pages URL detection** | The deployment workflow detects the Pages address and repository subpath, then applies them to assets, canonical links, the sitemap, and search metadata. It supports both `username.github.io` and project sites. |
| **One-click launchers for Windows and macOS** | Double-click `Open Homepage Editor.cmd` or `Open Homepage Editor.command`. The launcher installs dependencies on first use, identifies the current project folder, reuses its running editor or selects the next available local port, and opens the correct page automatically. |
| **Automatic checks before publishing** | Every save validates the content and inspects what Git can actually publish. The editor reports the eligible file count and size, confirms that local dependencies are excluded, and blocks unignored build folders, tracked secrets, or files that exceed GitHub’s limit. |

## Visual content editor

### Editor overview

![ScholarCanvas visual content editor](public/screenshots/editor-preview.png)

### Live preview — desktop

![ScholarCanvas live desktop preview inside the editor](public/screenshots/live-preview-desktop.png)

### Live preview — mobile

![ScholarCanvas live mobile preview inside the editor](public/screenshots/live-preview-mobile.png)

The local editor writes directly to `content/site-content.json` and manages profile images, CV files, and independent-page assets inside the repository. The deployed website remains static and read-only.

The editor includes:

- one Site Settings area for site structure, profile, contact links, and optional Umami analytics;
- add, remove, rename, reorder, show, hide, and reposition controls for main sections;
- reusable section templates for new academic or professional content;
- drag-and-drop movement of papers between publication statuses;
- collapsible publication forms, bulk `.bib` import, BibTeX parsing, Markdown/LaTeX abstracts, and per-paper visibility controls;
- a live desktop/mobile homepage preview that updates before content is saved;
- separate 4:5 homepage and square navigation-photo crops;
- import/export backups and validation for required fields, URLs, email addresses, search descriptions, and CV paths;
- a Markdown editor with live preview for independent pages;
- folder, ZIP, Markdown, image, and PDF imports with automatic asset paths;
- an automatic GitHub upload check on every save, including the publishable file count and size, ignored local dependencies, secrets, and oversized files;
- cleanup of generated profile images and page files that are no longer used.

> **Privacy note:** “Hidden from page” is not private. Repository content, uploaded files, and `site-content.json` remain public after deployment.

## Quick Start

### 1. Create your repository

Select **Use this template** for a clean Git history, or **Fork** if you want to keep a visible connection to the upstream project. Clone the new repository into its final folder before opening the editor.

### 2. Open the editor

On Windows, double-click:

```text
Open Homepage Editor.cmd
```

On macOS, double-click:

```text
Open Homepage Editor.command
```

If macOS removes the executable permission while copying the folder, run `chmod +x "Open Homepage Editor.command"` once and then double-click it normally.

The first run installs the required packages and normally opens:

```text
http://127.0.0.1:3001/editor/
```

If port `3001` belongs to another ScholarCanvas project or another program, the editor automatically selects the next available port. Opening the same project again reuses its existing local service instead of starting a duplicate.

On Windows, macOS, or Linux, the equivalent terminal commands are:

```bash
pnpm install
pnpm editor
```

Node.js 22.13 or newer is required. Keep the terminal or command window open while editing.

### 3. Replace the demonstration content

In the editor:

1. update the profile, biography, contact links, education, research, publications, projects, code, talks, and service;
2. upload a profile photo and save both homepage and navigation crops;
3. replace the example CV in `public/documents/`;
4. remove or rewrite the example Blog page;
5. update the Browser Title and Search Description;
6. leave analytics disabled or enter your own Umami configuration;
7. select **Save Changes**.

The source of truth is `content/site-content.json`. The editor saves to that file and to the relevant folders under `public/`.

Each save also runs **GitHub upload check**. When it reports **Ready**, commit everything shown in GitHub Desktop. Do not upload the entire local folder through GitHub’s web interface: installed packages and build caches stay on your computer and are excluded automatically.

### 4. Check and publish

```bash
pnpm check
git add .
git commit -m "Customize academic homepage"
git push
```

Enable **GitHub Actions** under **Settings → Pages**. The included workflow builds and publishes the static site after each push to `main`. Its final GitHub Pages address is detected during deployment and used automatically for canonical links, the sitemap, and search metadata.

The software is reusable under the MIT License. Demonstration content and assets are described separately in [CONTENT_NOTICE.md](CONTENT_NOTICE.md) and should be replaced before publishing a personal site.

## Files and folders

| Path | Purpose |
| --- | --- |
| `app/` | Homepage, content renderer, editor, validation, and section registry |
| `content/site-content.json` | Versioned editable content |
| `public/documents/` | CV and other public documents |
| `public/images/` | Original and generated profile images |
| `public/page-content/<section>/<page>/` | One folder per independent page, containing `index.md`, images, and PDFs |
| `public/screenshots/` | README and documentation images |
| `tools/` | Local-only content, Markdown, image, and photo save endpoints |
| `.github/` | Pull-request checks, Pages deployment, and contribution templates |

Generated build folders, temporary render files, and local image-generation outputs are ignored by Git.

## Photos and documents

The photo editor keeps the original uploaded image in `public/images/` and creates optimized crops for the homepage and sticky navigation. On each save, hashed profile images that are no longer referenced by the content file are removed automatically.

The CV button currently uses:

```text
/documents/Your_Name_CV.pdf
```

The matching LaTeX source is included as `public/documents/Your_Name_CV.tex`. Edit and compile that file, or replace `public/documents/Your_Name_CV.pdf` directly, to update the document without changing the website link.

Everything inside `public/` is public after deployment. Hiding an item from the homepage does not make the underlying data or file private.

## Content format and section templates

The content file includes a `schemaVersion`. Older backups are migrated by the editor before saving.

`app/section-registry.ts` is the central definition for every main-section template. Each entry declares its display name, editor mode, default item, and page renderer. A contributor adding Teaching, Awards, or Work Experience starts there instead of tracing configuration across the project.

The **Independent Pages** template is for navigation destinations that open outside the single-page homepage. It creates a compact row-based index and one Markdown/LaTeX detail page per entry. Headings written with `#`, `##`, or `###` automatically become the detail page's left-side table of contents.

Open an Independent Pages entry in the local editor to use its dedicated Write/Split/Preview workspace. Give the entry a Page Slug before adding files. You can then:

- import one Markdown file and its images or PDFs together;
- import a complete folder, preserving relative file paths;
- import a ZIP containing Markdown, images, and PDFs;
- paste or drag supported files directly into the writing area;
- use **Add File** for JPG, PNG, WebP, GIF, or PDF files.

After an upload, the editor inserts the appropriate Markdown image or download link automatically. It also displays the resulting public file path with a **Copy path** button, so the same attachment can be referenced elsewhere in the page.

Each entry owns one folder:

```text
public/page-content/<section-id>/<page-slug>/
├── index.md
├── figure-name-<hash>.png
└── paper-name-<hash>.pdf
```

The folder is created automatically when the first file is uploaded. Selecting **Save Changes** writes `index.md` into the same folder. These files should be committed with the rest of the repository. A save also removes unreferenced files and folders, so deleted pages do not leave old assets behind. Content saved with the earlier `content/pages/` and `public/page-assets/` structure is migrated automatically the next time it is saved.

## Markdown, LaTeX, and languages

Editable text supports Markdown such as `**bold**`, `*italic*`, and `[links](https://example.com)`, plus inline and display mathematics:

```text
$R_{t+1} = \alpha + \beta x_t + \varepsilon_{t+1}$

$$
\hat{\beta} = (X^\top X)^{-1}X^\top y
$$
```

The project uses UTF-8 and can mix English, Chinese, accented characters, and mathematical symbols.

## Optional Umami analytics

Analytics is included as an optional configuration and is disabled by default for a clean template fork. In the local editor, open **Analytics** and enter the values shown in the Umami tracking code:

- **Enable Analytics**
- **Provider:** Umami
- **Script URL**
- **Website ID**

The tracking script is added to the exported site only when analytics is enabled and both values are present. The Website ID and Script URL are public browser configuration; never paste an Umami password, API key, or access token into the content file.

## Check and build

Requires Node.js 22.13 or newer.

```bash
pnpm install
pnpm lint
pnpm build
```

The production build is written to `out/` as a static site. Pull requests run `pnpm check` automatically.

To remove generated preview and build folders without deleting installed dependencies or source files:

```bash
pnpm clean
```

## Publish with GitHub Pages

1. Create a GitHub repository and upload this project.
2. Keep the default branch named `main`.
3. Open **Settings → Pages**.
4. Choose **GitHub Actions** under **Build and deployment**.
5. Push to `main` or run **Deploy to GitHub Pages** manually.

The deployment workflow supports both project sites such as `username.github.io/repository-name/` and root sites such as `username.github.io/`. You do not need to calculate or enter that address in the content editor. **Published Site URL (optional override)** is available for manual builds outside the included GitHub Pages workflow.

To offer the project through GitHub's **Use this template** button, also enable **Settings → General → Template repository** after the repository is created.

## FAQ

### Is “Hidden” private?

No. Hidden content is removed from the rendered homepage only. It remains in the public repository and content JSON.

### What is the Search Description?

It is the short summary search engines and social platforms may show beside the page title. Placeholder text such as “Search Description” makes search results look unfinished, so the editor warns before saving.

### Does the deployed site need a server or database?

No. GitHub Pages serves the exported HTML, CSS, JavaScript, images, JSON, and PDF files. The writable save endpoint runs locally only.

### How do I update the site later?

Open the local editor, save the new content, commit the changed files, and push them to GitHub. GitHub Pages deploys the update automatically.

### Do I need to enter my GitHub Pages URL?

No. The included Pages workflow detects root sites, project sites, and the configured Pages address automatically. Use the optional Published Site URL field only when building the site through another workflow or host.

### What happens if port 3001 is already in use?

ScholarCanvas checks the identity of every running local editor. It reopens the service belonging to the current project when one already exists; otherwise, it selects the next available port and opens the correct editor automatically.

### Can I recover from a bad edit?

Import a previously exported JSON backup before saving. Git history provides an additional recovery layer after files have been committed.

### Can I add analytics?

Yes. Open **Analytics** in the local editor, paste the Script URL and Website ID from Umami, turn on **Enable Analytics**, and save. The template default is off, so people who fork the repository do not send data to the original owner's Umami account.

## License and provenance

The code in this repository is licensed under the MIT License. Personal demonstration content and assets are described in [CONTENT_NOTICE.md](CONTENT_NOTICE.md).

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
