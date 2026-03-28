# Contributing to Android MCP Server

## Development Setup

```bash
git clone https://github.com/thkim-us/android-mcp-server.git
cd android-mcp-server
pnpm install
pnpm run build
```

## Adding a New Tool

1. **Define schema + handler** in `src/tools/<category>.ts`:

```typescript
import { z } from "zod";
import { adbShell } from "../adb.js";
import { assertWriteAllowed } from "./utils.js";

export const myToolSchema = z.object({
  param1: z.string().describe("Description of param1"),
  serial: z.string().optional().describe("Device serial number."),
});

export async function myTool(params: z.infer<typeof myToolSchema>) {
  const opts = params.serial ? { serial: params.serial } : undefined;
  const output = await adbShell(`some-command ${params.param1}`, opts);
  return { result: output };
}
```

2. **Register in `src/index.ts`**:

```typescript
import { myToolSchema, myTool } from "./tools/category.js";

server.tool(
  "my-tool",
  "Human-readable description of what this tool does",
  myToolSchema.shape,
  wrapToolHandler(myTool),
);
```

3. **Use `assertWriteAllowed()`** for any tool that modifies device state.

4. **Use `assertShellAllowed()`** for tools that execute arbitrary commands.

5. **Build and test**:

```bash
pnpm run build
pnpm test
```

## Code Style

- TypeScript strict mode
- ES modules (`.js` extension in imports)
- All tool parameters must have `.describe()` for MCP schema generation
- Use `zod` for input validation
- Wrap handlers with `wrapToolHandler()` or `wrapImageToolHandler()`

## Testing

```bash
pnpm test             # Unit tests
pnpm test:watch       # Watch mode
node scripts/e2e-test.mjs  # E2E tests (requires connected device)
```

## Pull Request Guidelines

- One feature/fix per PR
- Include tests for new tools
- Update README.md tool tables if adding tools
- Run `pnpm run build && pnpm test` before submitting
