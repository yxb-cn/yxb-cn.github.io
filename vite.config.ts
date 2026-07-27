import vinext from "vinext";
import { defineConfig } from "vite";
import { contentEditorPlugin } from "./tools/local-content-editor";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

export default defineConfig({
  server: isCodexSeatbeltSandbox
    ? { watch: { useFsEvents: false, usePolling: true } }
    : undefined,
  plugins: [contentEditorPlugin(), vinext()],
});
