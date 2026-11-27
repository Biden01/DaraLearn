import { useState } from "react";
import { api } from "./api.js";
import { useApp } from "./ui.jsx";

// 3D-аватарки учеников (картинки от нейросети, /public/avatars/<id>.webp). Набор зависит от пола,
// который ученик выбирает сам; id начинается с g (девочки) или b (мальчики) — так же проверяет бэкенд.
export const AVATARS = {
  f: Array.from({ length: 15 }, (_, i) => `g${String(i + 1).padStart(2, "0")}`),
  m: Array.from({ length: 12 }, (_, i) => `b${String(i + 1).padStart(2, "0")}`),
};

export const avatarSrc = (id) => `/avatars/${id}.webp`;

// Выбор: сначала «девочка / мальчик», затем сетка картинок. Сохраняет сразу по нажатию.
export function AvatarPicker({ onDone }) {
  const { t, user, setUser, toast } = useApp();
  const a = t.avatar;
  const [gender, setGender] = useState(user.gender || (user.avatar ? (user.avatar[0] === "g" ? "f" : "m") : null));
  const [busy, setBusy] = useState(false);

  async function save(body) {
    setBusy(true);
    try { setUser(await api("/auth/me", { method: "PATCH", body })); return true; }
    catch { toast(t.error); return false; } finally { setBusy(false); }
  }
  async function pick(id) {
    if (await save({ gender, avatar: id })) { toast(t.saved); onDone?.(); }
  }

  return (
    <div className="ava-picker">
      <div className="tabs" role="group" aria-label={a.who}>
        {[["f", a.girl], ["m", a.boy]].map(([g, label]) => (
          <button key={g} type="button" className={gender === g ? "on" : ""} aria-pressed={gender === g}
            onClick={() => setGender(g)}>{label}</button>
        ))}
      </div>
      {gender ? (
        <div className="ava-grid" role="radiogroup" aria-label={a.pick}>
          {AVATARS[gender].map((id, i) => (
            <button key={id} type="button" role="radio" aria-checked={user.avatar === id} aria-label={a.n(i + 1)}
              className={`ava-opt ${user.avatar === id ? "on" : ""}`} disabled={busy} onClick={() => pick(id)}>
              <img src={avatarSrc(id)} alt="" loading="lazy" width="96" height="96" />
            </button>
          ))}
        </div>
      ) : <p className="muted small" style={{ margin: "12px 0 0" }}>{a.chooseFirst}</p>}
    </div>
  );
}

// Один раз предлагаем ученику без аватарки выбрать её (в этом браузере больше не спрашиваем).
export function AvatarAsk() {
  const { t, user } = useApp();
  const key = `dl-ava-asked-${user.id}`;
  const [open, setOpen] = useState(() => {
    if (user.role !== "student" || user.avatar) return false;
    try { return !localStorage.getItem(key); } catch { return false; }
  });
  if (!open) return null;
  const close = () => { try { localStorage.setItem(key, "1"); } catch { /* */ } setOpen(false); };
  return (
    <div className="dev-modal ava-ask" role="dialog" aria-modal="true" aria-labelledby="ava-ask-h" onClick={close}>
      <div className="card" onClick={(e) => e.stopPropagation()}>
        <h2 id="ava-ask-h" style={{ margin: "0 0 6px" }}>{t.avatar.askTitle}</h2>
        <p className="muted" style={{ margin: "0 0 16px" }}>{t.avatar.askText}</p>
        <AvatarPicker onDone={close} />
        <button type="button" className="btn ghost" style={{ marginTop: 16 }} onClick={close}>{t.avatar.later}</button>
      </div>
    </div>
  );
}
