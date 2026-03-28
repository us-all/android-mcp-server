import { z } from "zod";
import { XMLParser } from "fast-xml-parser";
import { adb, adbShell, adbRawBuffer } from "../adb.js";
import { assertWriteAllowed } from "./utils.js";

// --- Schemas ---

export const takeScreenshotSchema = z.object({
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const dumpUiHierarchySchema = z.object({
  compact: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Return compact format (interactive elements only) for token efficiency. Default: true.",
    ),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const tapSchema = z.object({
  x: z.coerce.number().describe("X coordinate to tap."),
  y: z.coerce.number().describe("Y coordinate to tap."),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const longPressSchema = z.object({
  x: z.coerce.number().describe("X coordinate to long press."),
  y: z.coerce.number().describe("Y coordinate to long press."),
  duration: z
    .coerce
    .number()
    .optional()
    .default(1000)
    .describe("Duration in milliseconds (default: 1000)."),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const swipeSchema = z.object({
  x1: z.coerce.number().describe("Start X coordinate."),
  y1: z.coerce.number().describe("Start Y coordinate."),
  x2: z.coerce.number().describe("End X coordinate."),
  y2: z.coerce.number().describe("End Y coordinate."),
  duration: z
    .coerce
    .number()
    .optional()
    .default(300)
    .describe("Duration in milliseconds (default: 300)."),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const inputTextSchema = z.object({
  text: z.string().describe("Text to input. Special characters will be escaped."),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const pressKeySchema = z.object({
  key: z
    .string()
    .describe(
      "Key to press. Examples: 'KEYCODE_BACK', 'KEYCODE_HOME', 'KEYCODE_ENTER', 'KEYCODE_VOLUME_UP'. Full list: https://developer.android.com/reference/android/view/KeyEvent",
    ),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

// --- Helpers ---

interface UiElement {
  index: number;
  class: string;
  text?: string;
  contentDesc?: string;
  resourceId?: string;
  clickable: boolean;
  focusable: boolean;
  scrollable: boolean;
  bounds: string;
  center?: { x: number; y: number };
}

export function parseBounds(boundsStr: string): { x: number; y: number } | undefined {
  const match = boundsStr.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (!match) return undefined;
  const x1 = parseInt(match[1], 10);
  const y1 = parseInt(match[2], 10);
  const x2 = parseInt(match[3], 10);
  const y2 = parseInt(match[4], 10);
  return { x: Math.round((x1 + x2) / 2), y: Math.round((y1 + y2) / 2) };
}

export function isInteractive(attrs: Record<string, string>): boolean {
  return (
    attrs["@_clickable"] === "true" ||
    attrs["@_long-clickable"] === "true" ||
    attrs["@_focusable"] === "true" ||
    attrs["@_scrollable"] === "true" ||
    attrs["@_checkable"] === "true"
  );
}

export function flattenNodes(
  node: Record<string, unknown>,
  result: UiElement[],
  compact: boolean,
): void {
  const attrs = node as Record<string, string>;
  const bounds = attrs["@_bounds"] ?? "";
  const interactive = isInteractive(attrs);

  if (!compact || interactive) {
    const element: UiElement = {
      index: result.length,
      class: (attrs["@_class"] ?? "").split(".").pop() ?? "",
      clickable: attrs["@_clickable"] === "true",
      focusable: attrs["@_focusable"] === "true",
      scrollable: attrs["@_scrollable"] === "true",
      bounds,
    };

    if (attrs["@_text"]) element.text = attrs["@_text"];
    if (attrs["@_content-desc"]) element.contentDesc = attrs["@_content-desc"];
    if (attrs["@_resource-id"]) {
      element.resourceId = attrs["@_resource-id"].split("/").pop();
    }
    if (bounds) element.center = parseBounds(bounds);

    result.push(element);
  }

  const children = node["node"];
  if (Array.isArray(children)) {
    for (const child of children) {
      flattenNodes(child, result, compact);
    }
  } else if (children && typeof children === "object") {
    flattenNodes(children as Record<string, unknown>, result, compact);
  }
}

// --- Handlers ---

export async function takeScreenshot(
  params: z.infer<typeof takeScreenshotSchema>,
) {
  const opts = params.serial ? { serial: params.serial } : undefined;
  const buffer = await adbRawBuffer(["exec-out", "screencap", "-p"], opts);
  return {
    base64: buffer.toString("base64"),
    mimeType: "image/png",
  };
}

export async function dumpUiHierarchy(
  params: z.infer<typeof dumpUiHierarchySchema>,
) {
  const opts = params.serial ? { serial: params.serial } : undefined;

  await adbShell("uiautomator dump /sdcard/window_dump.xml", opts);
  const xml = await adbShell("cat /sdcard/window_dump.xml", opts);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });

  const parsed = parser.parse(xml);
  const hierarchy = parsed?.hierarchy;
  if (!hierarchy) {
    return { elements: [], raw: xml.substring(0, 500) };
  }

  const elements: UiElement[] = [];
  flattenNodes(hierarchy, elements, params.compact);

  return {
    elementCount: elements.length,
    elements,
  };
}

export async function tap(params: z.infer<typeof tapSchema>) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  await adbShell(`input tap ${params.x} ${params.y}`, opts);
  return { result: `Tapped at (${params.x}, ${params.y})` };
}

export async function longPress(params: z.infer<typeof longPressSchema>) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  await adbShell(
    `input swipe ${params.x} ${params.y} ${params.x} ${params.y} ${params.duration}`,
    opts,
  );
  return {
    result: `Long pressed at (${params.x}, ${params.y}) for ${params.duration}ms`,
  };
}

export async function swipe(params: z.infer<typeof swipeSchema>) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  await adbShell(
    `input swipe ${params.x1} ${params.y1} ${params.x2} ${params.y2} ${params.duration}`,
    opts,
  );
  return {
    result: `Swiped from (${params.x1}, ${params.y1}) to (${params.x2}, ${params.y2})`,
  };
}

export async function inputText(params: z.infer<typeof inputTextSchema>) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  const escaped = params.text.replace(/ /g, "%s").replace(/'/g, "\\'");
  await adbShell(`input text '${escaped}'`, opts);
  return { result: `Typed: "${params.text}"` };
}

export async function pressKey(params: z.infer<typeof pressKeySchema>) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  const keycode = params.key.startsWith("KEYCODE_")
    ? params.key
    : `KEYCODE_${params.key.toUpperCase()}`;
  await adbShell(`input keyevent ${keycode}`, opts);
  return { result: `Pressed key: ${keycode}` };
}

// --- v1.1.0 additions ---

export const dragAndDropSchema = z.object({
  x1: z.coerce.number().describe("Start X coordinate."),
  y1: z.coerce.number().describe("Start Y coordinate."),
  x2: z.coerce.number().describe("End X coordinate."),
  y2: z.coerce.number().describe("End Y coordinate."),
  duration: z
    .coerce
    .number()
    .optional()
    .default(1000)
    .describe("Duration in milliseconds (default: 1000)."),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const screenRecordStartSchema = z.object({
  fileName: z
    .string()
    .optional()
    .default("recording.mp4")
    .describe("Output file name on device (default: recording.mp4)."),
  timeLimit: z
    .coerce
    .number()
    .optional()
    .default(30)
    .describe("Max recording duration in seconds (default: 30, max: 180)."),
  size: z
    .string()
    .optional()
    .describe("Video resolution WxH. Example: '720x1280'. Uses device resolution if omitted."),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const screenRecordPullSchema = z.object({
  fileName: z
    .string()
    .optional()
    .default("recording.mp4")
    .describe("Recording file name on device (default: recording.mp4)."),
  localPath: z
    .string()
    .describe("Local path to save the recording."),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export async function dragAndDrop(
  params: z.infer<typeof dragAndDropSchema>,
) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  await adbShell(
    `input draganddrop ${params.x1} ${params.y1} ${params.x2} ${params.y2} ${params.duration}`,
    opts,
  );
  return {
    result: `Dragged from (${params.x1}, ${params.y1}) to (${params.x2}, ${params.y2})`,
  };
}

export async function screenRecordStart(
  params: z.infer<typeof screenRecordStartSchema>,
) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  const remotePath = `/sdcard/${params.fileName}`;
  let cmd = `screenrecord --time-limit ${Math.min(params.timeLimit, 180)} ${remotePath}`;
  if (params.size) cmd = `screenrecord --size ${params.size} --time-limit ${Math.min(params.timeLimit, 180)} ${remotePath}`;

  // screenrecord blocks, so run it without waiting
  adbShell(cmd, { ...opts, timeout: (params.timeLimit + 5) * 1000 }).catch(
    () => {},
  );

  return {
    result: `Recording started: ${remotePath} (max ${params.timeLimit}s)`,
    remotePath,
  };
}

export async function screenRecordPull(
  params: z.infer<typeof screenRecordPullSchema>,
) {
  const opts = params.serial ? { serial: params.serial } : undefined;
  const remotePath = `/sdcard/${params.fileName}`;
  const output = await adb(["pull", remotePath, params.localPath], opts);
  return { result: output };
}

// --- v1.2.0 additions ---

export const doubleTapSchema = z.object({
  x: z.coerce.number().describe("X coordinate to double tap."),
  y: z.coerce.number().describe("Y coordinate to double tap."),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export async function doubleTap(params: z.infer<typeof doubleTapSchema>) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;
  await adbShell(`input tap ${params.x} ${params.y}`, opts);
  await adbShell(`input tap ${params.x} ${params.y}`, opts);
  return { result: `Double tapped at (${params.x}, ${params.y})` };
}

// --- Annotated screenshot + UI map ---

export const takeAnnotatedScreenshotSchema = z.object({
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export const tapElementSchema = z.object({
  index: z
    .coerce
    .number()
    .describe("Element index from dump-ui-hierarchy or take-annotated-screenshot result."),
  serial: z
    .string()
    .optional()
    .describe("Device serial number. Uses default device if omitted."),
});

export async function takeAnnotatedScreenshot(
  params: z.infer<typeof takeAnnotatedScreenshotSchema>,
) {
  const opts = params.serial ? { serial: params.serial } : undefined;

  // Capture screenshot and UI hierarchy in parallel
  const [screenshotBuffer, _] = await Promise.all([
    adbRawBuffer(["exec-out", "screencap", "-p"], opts),
    adbShell("uiautomator dump /sdcard/window_dump.xml", opts),
  ]);
  const xml = await adbShell("cat /sdcard/window_dump.xml", opts);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });

  const parsed = parser.parse(xml);
  const hierarchy = parsed?.hierarchy;
  const elements: UiElement[] = [];
  if (hierarchy) {
    flattenNodes(hierarchy, elements, true);
  }

  // Build element map with numbered labels
  const elementMap = elements.map((el, i) => ({
    index: i,
    class: el.class,
    text: el.text ?? el.contentDesc ?? el.resourceId ?? "",
    center: el.center,
    bounds: el.bounds,
    clickable: el.clickable,
  }));

  return {
    base64: screenshotBuffer.toString("base64"),
    mimeType: "image/png",
    metadata: {
      elementCount: elements.length,
      elements: elementMap,
      usage: "Use tap-element with the index number to interact with an element. Or use tap with center coordinates.",
    },
  };
}

export async function tapElement(
  params: z.infer<typeof tapElementSchema>,
) {
  assertWriteAllowed();
  const opts = params.serial ? { serial: params.serial } : undefined;

  // Get current UI hierarchy to find the element
  await adbShell("uiautomator dump /sdcard/window_dump.xml", opts);
  const xml = await adbShell("cat /sdcard/window_dump.xml", opts);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });

  const parsed = parser.parse(xml);
  const hierarchy = parsed?.hierarchy;
  if (!hierarchy) throw new Error("Could not dump UI hierarchy");

  const elements: UiElement[] = [];
  flattenNodes(hierarchy, elements, true);

  if (params.index < 0 || params.index >= elements.length) {
    throw new Error(
      `Element index ${params.index} out of range (0-${elements.length - 1})`,
    );
  }

  const target = elements[params.index];
  if (!target.center) {
    throw new Error(`Element ${params.index} has no center coordinates`);
  }

  await adbShell(
    `input tap ${target.center.x} ${target.center.y}`,
    opts,
  );

  return {
    result: `Tapped element [${params.index}] "${target.text ?? target.contentDesc ?? target.class}" at (${target.center.x}, ${target.center.y})`,
  };
}
