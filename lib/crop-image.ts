export default async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number }
): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', (err) => reject(err));
    img.setAttribute('crossOrigin', 'anonymous');
    img.src = imageSrc;
  });

  // Limit crop size to max 1200px for HD print quality but small file size
  let targetWidth = pixelCrop.width;
  let targetHeight = pixelCrop.height;
  const MAX_DIMENSION = 1200;
  if (targetWidth > MAX_DIMENSION) {
    const ratio = MAX_DIMENSION / targetWidth;
    targetWidth = MAX_DIMENSION;
    targetHeight = Math.round(pixelCrop.height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetWidth,
    targetHeight
  );

  return new Promise<Blob>((resolve, reject) => {
    // Compress as JPEG at 0.85 quality - looks incredible but stays under 1MB
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas is empty'));
        return;
      }
      resolve(blob);
    }, 'image/jpeg', 0.85);
  });
}
