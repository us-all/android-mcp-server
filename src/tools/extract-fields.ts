/**
 * Field projection helper — comma-separated dotted paths with `*` wildcard.
 * Used to dramatically reduce response token usage on large entities.
 *
 * Examples:
 *   "id,name,description"
 *   "columns.*.name"
 *   "owner.name,tags.*.tagFQN"
 *   "service.`fully.qualified.name`"
 */

function parsePath(path: string): string[] {
  const parts: string[] = [];
  let buf = "";
  let inBacktick = false;
  for (const ch of path) {
    if (ch === "`") { inBacktick = !inBacktick; continue; }
    if (ch === "." && !inBacktick) {
      if (buf) parts.push(buf);
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf) parts.push(buf);
  return parts;
}

type SelectNode = { leaf: boolean; children: Map<string, SelectNode> };

function newNode(): SelectNode {
  return { leaf: false, children: new Map() };
}

function buildSelectTree(paths: string[][]): SelectNode {
  const root = newNode();
  for (const parts of paths) {
    let cursor = root;
    for (const part of parts) {
      let next = cursor.children.get(part);
      if (!next) {
        next = newNode();
        cursor.children.set(part, next);
      }
      cursor = next;
    }
    cursor.leaf = true;
  }
  return root;
}

function project(data: unknown, node: SelectNode): unknown {
  if (node.leaf || node.children.size === 0) return data;
  if (data === null || data === undefined) return data;
  const wildcard = node.children.get("*");
  if (Array.isArray(data)) {
    return data.map((v) => project(v, wildcard ?? node));
  }
  if (typeof data !== "object") return data;
  const obj = data as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (wildcard) {
    for (const [k, v] of Object.entries(obj)) out[k] = project(v, wildcard);
  }
  for (const [key, child] of node.children) {
    if (key === "*") continue;
    if (key in obj) out[key] = project(obj[key], child);
  }
  return out;
}

export function applyExtractFields<T>(data: T, expr?: string): T | unknown {
  if (!expr || !expr.trim()) return data;
  if (data === null || typeof data !== "object") return data;
  const paths = expr.split(",").map((s) => s.trim()).filter(Boolean).map(parsePath);
  if (paths.length === 0) return data;
  const tree = buildSelectTree(paths);
  return project(data, tree);
}

export const extractFieldsDescription =
  "Comma-separated dotted paths to project from response (e.g. 'id,name,owner.name,columns.*.name'). " +
  "Use `*` as wildcard for arrays/objects. Wrap field names with dots in backticks. " +
  "Reduces response tokens dramatically on large entities.";
