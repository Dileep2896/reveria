/* ── Strip markdown formatting from story text ── */
export function cleanText(text) {
  return text
    .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`(.*?)`/g, '$1');
}

/* ── Check if browser has cached an image ── */
export function isImageCached(url) {
  if (!url || url === 'error') return false;
  const img = new Image();
  img.src = url;
  return img.complete;
}
