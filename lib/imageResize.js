"use client";

const RESIZABLE = /^image\/(jpeg|png|webp|avif|bmp)$/;

function decode(file) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file).then((bitmap) => ({
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close?.(),
    }));
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () =>
      resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Rasmni o'qib bo'lmadi"));
    };
    img.src = url;
  });
}

/**
 * Rasmni brauzerning o'zida kichraytiradi (uzun tomoni `maxSide` gacha, JPEG).
 *
 * Telefon kamerasi 4000px va 5–10MB rasm beradi — pazlda u 80 marta chiziladi
 * va talabaning internetida sekin yuklanadi. 1600px ekranda farqsiz, lekin
 * hajmi 10 barobar kichik. Kichraytirib bo'lmasa (GIF, noma'lum format yoki
 * xato) asl fayl qaytariladi.
 */
export async function downscaleImage(file, { maxSide = 1600, quality = 0.88 } = {}) {
  if (!RESIZABLE.test(file.type)) return file;
  let decoded;
  try {
    decoded = await decode(file);
    const scale = Math.min(1, maxSide / Math.max(decoded.width, decoded.height));
    if (scale === 1 && file.size <= 1.5 * 1024 * 1024) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(decoded.width * scale));
    canvas.height = Math.max(1, Math.round(decoded.height * scale));
    const ctx = canvas.getContext("2d");
    // PNG'ning shaffof joylari JPEG'da qora bo'lib qolmasin.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || (scale === 1 && blob.size >= file.size)) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  } finally {
    decoded?.release();
  }
}
