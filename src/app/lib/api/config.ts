export const API_BASE_URL = "https://cis.kku.ac.th/api/classroom";

export function buildApiUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildAppApiUrl(path: string) {
  if (path.startsWith("/api")) return path;
  if (path.startsWith("/")) return `/api${path}`;
  return `/api/${path}`;
}