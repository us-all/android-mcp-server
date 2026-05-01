import { z } from "zod/v4";
import { config } from "./config.js";

/**
 * Categories used by ANDROID_TOOLS / ANDROID_DISABLE env toggles.
 */
export const CATEGORIES = [
  "device",     // device list, info, connect/disconnect
  "apps",       // install, uninstall, list, clear, permissions
  "ui",         // tap, swipe, screenshot, dump hierarchy, find, scroll, annotated
  "logcat",     // logcat capture, filter, crash extraction
  "emulator",   // AVD start/stop/snapshot
  "files",      // push, pull, exists, ls
  "system",     // settings, network, battery, display, locale, broadcast
  "debug",      // dumpsys, getprop, processes, doctor
  "shell",      // raw shell exec
  "meta",       // search-tools (always enabled)
] as const;

export type Category = (typeof CATEGORIES)[number];

interface ToolEntry {
  name: string;
  description: string;
  category: Category;
}

export class ToolRegistry {
  private tools: ToolEntry[] = [];

  register(name: string, description: string, category: Category): boolean {
    this.tools.push({ name, description, category });
    return this.isEnabled(category);
  }

  isEnabled(category: Category): boolean {
    if (category === "meta") return true;
    if (config.enabledCategories) {
      return config.enabledCategories.includes(category);
    }
    if (config.disabledCategories) {
      return !config.disabledCategories.includes(category);
    }
    return true;
  }

  list(): ToolEntry[] {
    return this.tools;
  }

  search(query: string, category?: string, limit = 20): ToolEntry[] {
    const q = query.trim().toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);

    const scored = this.tools
      .filter((t) => !category || t.category === category)
      .map((t) => {
        const haystack = `${t.name} ${t.description}`.toLowerCase();
        let score = 0;
        for (const tok of tokens) {
          if (t.name.toLowerCase().includes(tok)) score += 5;
          if (haystack.includes(tok)) score += 1;
        }
        return { tool: t, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map((s) => s.tool);
  }

  summary() {
    const byCategory = new Map<string, number>();
    for (const t of this.tools) {
      byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + 1);
    }
    return {
      total: this.tools.length,
      enabledCategories: CATEGORIES.filter((c) => this.isEnabled(c)),
      categoryBreakdown: Object.fromEntries(byCategory),
    };
  }
}

export const registry = new ToolRegistry();

export const searchToolsSchema = z.object({
  query: z.string().describe("Natural language query (e.g. 'screenshot', 'install app', 'logcat errors')"),
  category: z.enum([...CATEGORIES]).optional().describe("Restrict search to a specific category"),
  limit: z.coerce.number().optional().default(20).describe("Max results (default 20)"),
});

export async function searchTools(params: z.infer<typeof searchToolsSchema>) {
  const matches = registry.search(params.query, params.category, params.limit);
  return {
    query: params.query,
    matchCount: matches.length,
    summary: registry.summary(),
    matches: matches.map((t) => ({ name: t.name, description: t.description, category: t.category })),
  };
}
