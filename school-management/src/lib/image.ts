/**
 * Shrinks an image in the browser before upload: phone photos are often 5 MB or more.
 * Output is a JPEG scaled so its longest side is at most maxSide pixels. With { png: true } the output
 * is a PNG that keeps transparency, which is what a logo needs.
 */
export async function compressImage(
  file: File,
  maxSide: number,
  quality: number,
  options: { png?: boolean } = {}
): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    // createImageBitmap applies the photo's EXIF rotation in current browsers.
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This image format is not supported. Use a JPG or PNG photo.");
  }

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("The image could not be processed in this browser.");

  if (!options.png) {
    ctx.fillStyle = "#ffffff"; // JPEG has no transparency, so a transparent PNG becomes white instead of black
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("The image could not be processed."))),
      options.png ? "image/png" : "image/jpeg",
      quality
    )
  );
}
