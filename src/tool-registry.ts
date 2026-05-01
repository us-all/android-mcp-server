import { ToolRegistry, createSearchToolsMetaTool } from "@us-all/mcp-toolkit";
import { config } from "./config.js";

export const CATEGORIES = [
  "device",
  "apps",
  "ui",
  "logcat",
  "emulator",
  "files",
  "system",
  "debug",
  "shell",
  "meta",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const registry = new ToolRegistry<Category>({
  enabledCategories: config.enabledCategories,
  disabledCategories: config.disabledCategories,
});

const meta = createSearchToolsMetaTool(registry, CATEGORIES,
  "Discover tools across the Android MCP surface (device, apps, ui, logcat, emulator, files, system, debug, shell).");

export const searchToolsSchema = meta.schema;
export const searchTools = meta.handler;
