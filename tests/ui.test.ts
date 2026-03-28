import { describe, it, expect } from "vitest";
import { parseBounds, isInteractive, flattenNodes } from "../src/tools/ui.js";

describe("parseBounds", () => {
  it("should parse valid bounds and return center coordinates", () => {
    const result = parseBounds("[0,0][100,200]");
    expect(result).toEqual({ x: 50, y: 100 });
  });

  it("should handle large coordinates", () => {
    const result = parseBounds("[540,1000][1080,2340]");
    expect(result).toEqual({ x: 810, y: 1670 });
  });

  it("should round center for odd dimensions", () => {
    const result = parseBounds("[0,0][101,201]");
    expect(result).toEqual({ x: 51, y: 101 });
  });

  it("should return undefined for invalid bounds", () => {
    expect(parseBounds("")).toBeUndefined();
    expect(parseBounds("invalid")).toBeUndefined();
    expect(parseBounds("[0,0]")).toBeUndefined();
    expect(parseBounds("[0,0][100]")).toBeUndefined();
  });

  it("should handle zero-size bounds", () => {
    const result = parseBounds("[50,50][50,50]");
    expect(result).toEqual({ x: 50, y: 50 });
  });
});

describe("isInteractive", () => {
  it("should return true for clickable elements", () => {
    expect(isInteractive({ "@_clickable": "true" })).toBe(true);
  });

  it("should return true for focusable elements", () => {
    expect(isInteractive({ "@_focusable": "true" })).toBe(true);
  });

  it("should return true for scrollable elements", () => {
    expect(isInteractive({ "@_scrollable": "true" })).toBe(true);
  });

  it("should return true for long-clickable elements", () => {
    expect(isInteractive({ "@_long-clickable": "true" })).toBe(true);
  });

  it("should return true for checkable elements", () => {
    expect(isInteractive({ "@_checkable": "true" })).toBe(true);
  });

  it("should return false when all attributes are false", () => {
    expect(
      isInteractive({
        "@_clickable": "false",
        "@_focusable": "false",
        "@_scrollable": "false",
        "@_long-clickable": "false",
        "@_checkable": "false",
      }),
    ).toBe(false);
  });

  it("should return false for empty attributes", () => {
    expect(isInteractive({})).toBe(false);
  });

  it("should return true when any one attribute is true", () => {
    expect(
      isInteractive({
        "@_clickable": "false",
        "@_focusable": "false",
        "@_scrollable": "true",
      }),
    ).toBe(true);
  });
});

describe("flattenNodes", () => {
  const makeNode = (overrides: Record<string, unknown> = {}) => ({
    "@_class": "android.widget.Button",
    "@_text": "OK",
    "@_content-desc": "",
    "@_resource-id": "com.example:id/btn_ok",
    "@_clickable": "true",
    "@_focusable": "true",
    "@_scrollable": "false",
    "@_long-clickable": "false",
    "@_checkable": "false",
    "@_bounds": "[100,200][300,400]",
    ...overrides,
  });

  it("should extract interactive elements in compact mode", () => {
    const elements: any[] = [];
    flattenNodes(makeNode(), elements, true);

    expect(elements).toHaveLength(1);
    expect(elements[0].class).toBe("Button");
    expect(elements[0].text).toBe("OK");
    expect(elements[0].resourceId).toBe("btn_ok");
    expect(elements[0].clickable).toBe(true);
    expect(elements[0].center).toEqual({ x: 200, y: 300 });
  });

  it("should skip non-interactive elements in compact mode", () => {
    const elements: any[] = [];
    flattenNodes(
      makeNode({
        "@_clickable": "false",
        "@_focusable": "false",
        "@_scrollable": "false",
        "@_long-clickable": "false",
        "@_checkable": "false",
      }),
      elements,
      true,
    );

    expect(elements).toHaveLength(0);
  });

  it("should include all elements in full mode", () => {
    const elements: any[] = [];
    flattenNodes(
      makeNode({
        "@_clickable": "false",
        "@_focusable": "false",
        "@_scrollable": "false",
        "@_long-clickable": "false",
        "@_checkable": "false",
      }),
      elements,
      false,
    );

    expect(elements).toHaveLength(1);
  });

  it("should recursively flatten child nodes (array)", () => {
    const elements: any[] = [];
    const parent = makeNode({
      node: [
        makeNode({ "@_text": "Child1" }),
        makeNode({ "@_text": "Child2" }),
      ],
    });
    flattenNodes(parent, elements, true);

    expect(elements).toHaveLength(3);
    expect(elements[1].text).toBe("Child1");
    expect(elements[2].text).toBe("Child2");
  });

  it("should recursively flatten single child node (object)", () => {
    const elements: any[] = [];
    const parent = makeNode({
      node: makeNode({ "@_text": "OnlyChild" }),
    });
    flattenNodes(parent, elements, true);

    expect(elements).toHaveLength(2);
    expect(elements[1].text).toBe("OnlyChild");
  });

  it("should strip package prefix from resource-id", () => {
    const elements: any[] = [];
    flattenNodes(
      makeNode({ "@_resource-id": "com.android.chrome:id/toolbar" }),
      elements,
      true,
    );

    expect(elements[0].resourceId).toBe("toolbar");
  });

  it("should extract short class name from full class path", () => {
    const elements: any[] = [];
    flattenNodes(
      makeNode({ "@_class": "android.widget.TextView" }),
      elements,
      true,
    );

    expect(elements[0].class).toBe("TextView");
  });

  it("should not include contentDesc when empty", () => {
    const elements: any[] = [];
    flattenNodes(makeNode({ "@_content-desc": "" }), elements, true);

    expect(elements[0].contentDesc).toBeUndefined();
  });

  it("should include contentDesc when present", () => {
    const elements: any[] = [];
    flattenNodes(
      makeNode({ "@_content-desc": "Submit button" }),
      elements,
      true,
    );

    expect(elements[0].contentDesc).toBe("Submit button");
  });

  it("should assign sequential indexes", () => {
    const elements: any[] = [];
    const parent = makeNode({
      node: [makeNode(), makeNode()],
    });
    flattenNodes(parent, elements, true);

    expect(elements[0].index).toBe(0);
    expect(elements[1].index).toBe(1);
    expect(elements[2].index).toBe(2);
  });

  it("should handle deeply nested hierarchy", () => {
    const elements: any[] = [];
    const deep = makeNode({
      node: makeNode({
        node: makeNode({
          node: makeNode({ "@_text": "DeepLeaf" }),
        }),
      }),
    });
    flattenNodes(deep, elements, true);

    expect(elements.length).toBe(4);
    expect(elements[3].text).toBe("DeepLeaf");
  });
});
