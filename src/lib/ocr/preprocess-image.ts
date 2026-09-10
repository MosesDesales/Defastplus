/** Image preprocessing for OCR — deskew approximation, contrast, sharpening. */

export type PreprocessResult = {
  buffer: Buffer;
  steps: string[];
  width?: number;
  height?: number;
};

/**
 * Prepare invoice images for OCR:
 * - Auto-orient (EXIF)
 * - Grayscale + contrast normalize
 * - Sharpen
 * - Upscale small mobile captures
 */
export async function preprocessImageForOcr(input: Buffer): Promise<PreprocessResult> {
  const sharp = (await import("sharp")).default;
  const steps: string[] = [];

  let pipeline = sharp(input).rotate();
  steps.push("auto_orient");

  const meta = await pipeline.metadata();
  const width = meta.width ?? 0;

  if (width > 0 && width < 1400) {
    pipeline = pipeline.resize({ width: 1800, withoutEnlargement: false });
    steps.push("upscale_small_image");
  }

  pipeline = pipeline
    .grayscale()
    .normalize()
    .linear(1.15, -18)
    .sharpen({ sigma: 1.2, m1: 1.2, m2: 0.4 });

  steps.push("grayscale_contrast_sharpen");

  const buffer = await pipeline.png({ compressionLevel: 6 }).toBuffer();
  const outMeta = await sharp(buffer).metadata();

  return {
    buffer,
    steps,
    width: outMeta.width,
    height: outMeta.height,
  };
}

export async function preprocessIfImage(mime: string, buffer: Buffer): Promise<PreprocessResult> {
  if (!mime.startsWith("image/")) {
    return { buffer, steps: [] };
  }
  return preprocessImageForOcr(buffer);
}
