// electron.vite.config.ts
import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
var __electron_vite_injected_dirname = "C:\\Users\\juang\\Desktop\\MeetBox\\desktop";
var electron_vite_config_default = defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__electron_vite_injected_dirname, "src/main/index.ts") }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__electron_vite_injected_dirname, "src/preload/index.ts") }
      }
    }
  },
  renderer: {
    resolve: {
      alias: { "@": resolve(__electron_vite_injected_dirname, "src/renderer/src") }
    },
    plugins: [react()],
    css: {
      postcss: resolve(__electron_vite_injected_dirname, "postcss.config.js")
    }
  }
});
export {
  electron_vite_config_default as default
};
