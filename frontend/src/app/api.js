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

// Загрузка файла (multipart). blob=true — ответ файлом (например, Excel с логинами).
export async function upload(path, file, { blob = false } = {}) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`/api${path}`, { method: "POST", body: fd, credentials: "same-origin" });
  if (!res.ok) {
    let code = null;
    try { code = (await res.json()).detail; } catch { /* */ }
    throw new ApiError(res.status, typeof code === "string" ? code : null);
  }
  return blob ? res.blob() : res.json();
}

export function saveBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function download(path, name) {
  const res = await fetch(`/api${path}`, { credentials: "same-origin" });
  if (!res.ok) throw new ApiError(res.status, null);
  saveBlob(await res.blob(), name);
}
