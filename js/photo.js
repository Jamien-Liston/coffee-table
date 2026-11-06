// Shrinks a photo from the camera or photo library to at most 600px on its
// longest side and returns it as JPEG text (a data: URL) for storage.

const Photo = (() => {
  const MAX_EDGE = 600;
  const QUALITY = 0.8;

  function canvasOf(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  // Free a canvas's memory straight away; iOS caps the total canvas memory.
  function release(canvas) {
    canvas.width = 0;
    canvas.height = 0;
  }

  async function shrink(file) {
    if (!file || (file.type && !file.type.startsWith('image/'))) {
      throw new Error('Not an image');
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      // Decoding through <img> applies the photo's EXIF orientation, so a
      // portrait shot stays upright.
      await img.decode();
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      if (!width || !height) throw new Error('Empty image');

      const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
      const targetW = Math.max(1, Math.round(width * scale));
      const targetH = Math.max(1, Math.round(height * scale));

      // Halve in steps until close to the target: smoother than one big jump.
      let source = img;
      let sourceW = width;
      let sourceH = height;
      const steps = [];
      while (sourceW / 2 >= targetW && sourceH / 2 >= targetH) {
        const step = canvasOf(Math.round(sourceW / 2), Math.round(sourceH / 2));
        step.getContext('2d').drawImage(source, 0, 0, step.width, step.height);
        steps.push(step);
        source = step;
        sourceW = step.width;
        sourceH = step.height;
      }

      const out = canvasOf(targetW, targetH);
      const ctx = out.getContext('2d');
      ctx.fillStyle = '#ffffff'; // JPEG has no transparency
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, 0, 0, targetW, targetH);
      const dataUrl = out.toDataURL('image/jpeg', QUALITY);

      steps.forEach(release);
      release(out);
      return dataUrl;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return { shrink };
})();
