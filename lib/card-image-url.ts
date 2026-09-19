export function protectCardImageUrl(value?: string) {
  if (!value || value.startsWith("/api/card-images?")) return value;
  try {
    const url = new URL(value, "http://card.local");
    const marker = "/storage/v1/object/public/card-images/";
    const index = url.pathname.indexOf(marker);
    if (index < 0) return value;
    const path = decodeURIComponent(url.pathname.slice(index + marker.length));
    return `/api/card-images?path=${encodeURIComponent(path)}`;
  } catch {
    return value;
  }
}
