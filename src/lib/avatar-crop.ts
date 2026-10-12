import type { Area } from "react-easy-crop";

const OUTPUT_SIZE = 512;

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The photo could not be read."));
    image.src = source;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function getCroppedBlob(imageSource: string, crop: Area): Promise<Blob> {
  const image = await loadImage(imageSource);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser does not support photo processing.");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  const webp = await canvasBlob(canvas, "image/webp", 0.85);
  if (webp?.type === "image/webp") return webp;

  context.globalCompositeOperation = "destination-over";
  context.fillStyle = "white";
  context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  const jpeg = await canvasBlob(canvas, "image/jpeg", 0.85);
  if (!jpeg) throw new Error("The photo could not be processed.");
  return jpeg;
}
