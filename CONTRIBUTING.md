# Contributing

Thank you for helping improve this academic homepage template.

## Before opening an issue

- Search existing issues for the same problem or request.
- Use the local editor for ordinary profile and homepage-content changes.
- Do not include private documents, credentials, analytics secrets, or other
  personal data in an issue.

## Local setup

Requirements:

- Node.js 22.13 or newer
- pnpm 11

```bash
pnpm install
pnpm editor
```

Open `http://127.0.0.1:3001/editor/`. The editor writes changes to
`content/site-content.json` and the relevant folders under `public/`.

## Project structure

- `content/site-content.json` contains the editable site content.
- `app/section-registry.ts` is the central registry for section templates.
- `app/main-content-section.tsx` renders homepage section layouts.
- `app/editor/` contains the local visual editor.
- `tools/local-content-editor.ts` contains local-only save and upload routes.
- `public/page-content/` stores Markdown pages and their attachments.

When adding a reusable section type, define its name, default data, editor
behavior, and renderer through the section registry instead of adding
one-off configuration in multiple files.

## Making a change

1. Keep changes focused and preserve the static GitHub Pages build.
2. Maintain backward compatibility for existing `site-content.json` files when
   changing the content format.
3. Keep the content schema version unchanged unless a real migration is
   required.
4. Treat everything in `public/` and `content/site-content.json` as public.
5. Add or update documentation when behavior changes.

Run the complete check before submitting:

```bash
pnpm check
```

Run `pnpm clean` when you want to remove local preview and build outputs.

## Pull requests

Describe the problem, the resulting behavior, and any user-facing changes.
Include screenshots only when layout or interaction has changed. By
contributing, you agree that your code contribution is licensed under the MIT
License.

Please follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) in all project spaces.
