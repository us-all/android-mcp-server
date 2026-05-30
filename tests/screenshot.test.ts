/**
 * takeScreenshot — format/quality/maxWidth pipeline (v1.14.0).
 *
 * The default code path returns the raw screencap PNG unchanged. We only
 * touch jimp when the caller asks for JPEG or downscaling — so the test
 * pins (a) the fast-path passthrough, (b) the JPEG conversion shrinks
 * payload while changing mimeType, and (c) maxWidth actually resizes.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Jimp } from "jimp";

const mockAdbRawBuffer = vi.fn();
vi.mock("../src/adb.js", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("../src/adb.js");
  return { ...actual, adbRawBuffer: mockAdbRawBuffer };
});

const { takeScreenshot } = await import("../src/tools/ui.js");

async function makePngBuffer(width: number, height: number): Promise<Buffer> {
  const img = new Jimp({ width, height, color: 0xff0000ff });
  return img.getBuffer("image/png");
}

beforeEach(() => {
  mockAdbRawBuffer.mockReset();
});

describe("takeScreenshot fast path (no transform requested)", () => {
  it("returns the raw screencap PNG untouched when format=png and no maxWidth", async () => {
    const buf = await makePngBuffer(40, 60);
    mockAdbRawBuffer.mockResolvedValueOnce(buf);

    const result = await takeScreenshot({ format: "png", quality: 80 });

    expect(result.mimeType).toBe("image/png");
    expect(result.base64).toBe(buf.toString("base64"));
    // Fast path does NOT decode + re-encode, so no width/height in the
    // payload — those only appear when jimp ran.
    expect((result as Record<string, unknown>).width).toBeUndefined();
  });
});

describe("takeScreenshot JPEG conversion", () => {
  it("returns image/jpeg with width/height and a much smaller payload", async () => {
    // Solid-color PNG compresses tiny; use a noisy buffer so PNG > JPEG.
    const img = new Jimp({ width: 400, height: 400, color: 0x00000000 });
    for (let y = 0; y < 400; y += 1) {
      for (let x = 0; x < 400; x += 1) {
        const r = (x * 7) & 0xff;
        const g = (y * 11) & 0xff;
        const b = ((x + y) * 3) & 0xff;
        img.setPixelColor(((r << 24) | (g << 16) | (b << 8) | 0xff) >>> 0, x, y);
      }
    }
    const noisy = await img.getBuffer("image/png");
    mockAdbRawBuffer.mockResolvedValueOnce(noisy);

    const result = await takeScreenshot({ format: "jpeg", quality: 60 });

    expect(result.mimeType).toBe("image/jpeg");
    expect(result.width).toBe(400);
    expect(result.height).toBe(400);
    expect(result.originalWidth).toBe(400);
    const jpegBytes = Buffer.from(result.base64, "base64").length;
    expect(jpegBytes).toBeLessThan(noisy.length);
  });
});

describe("takeScreenshot maxWidth downscale", () => {
  it("downscales preserving aspect ratio when image is wider than maxWidth", async () => {
    const buf = await makePngBuffer(800, 400);
    mockAdbRawBuffer.mockResolvedValueOnce(buf);

    const result = await takeScreenshot({
      format: "png",
      quality: 80,
      maxWidth: 200,
    });

    expect(result.width).toBe(200);
    expect(result.height).toBe(100); // aspect preserved
    expect(result.originalWidth).toBe(800);
    expect(result.originalHeight).toBe(400);
  });

  it("does not upscale when image is already narrower than maxWidth", async () => {
    const buf = await makePngBuffer(100, 50);
    mockAdbRawBuffer.mockResolvedValueOnce(buf);

    const result = await takeScreenshot({
      format: "png",
      quality: 80,
      maxWidth: 500,
    });

    expect(result.width).toBe(100);
    expect(result.height).toBe(50);
  });
});
