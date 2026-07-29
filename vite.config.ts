import vinext from "vinext";
import { defineConfig } from "vite";
import { contentEditorPlugin } from "./tools/local-content-editor";

export default defineConfig({
  plugins: [contentEditorPlugin(), vinext()],
});
