export function getClientToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem("classroomToken");
  if (stored) {
    return stored;
  }

  const match = document.cookie.match(/(?:^|;\s*)classroom-token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function clearClientSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem("classroomToken");
  window.localStorage.removeItem("classroomProfile");
  document.cookie = "classroom-token=; path=/; max-age=0";
}