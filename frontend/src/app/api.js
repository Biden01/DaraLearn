// Обёртка над fetch для /api: JSON, cookie-сессия, ошибки с кодом.
export class ApiError extends Error {
  constructor(status, code) {
    super(code || `HTTP ${status}`);
    this.status = status;
    this.code = code;
  }
}

export async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch { /* пустой ответ */ }
  if (!res.ok) {
    const code = typeof data?.detail === "string" ? data.detail : null;
    if (res.status === 401) window.dispatchEvent(new Event("dl:unauthorized"));
    throw new ApiError(res.status, code);
  }
  return data;
}
