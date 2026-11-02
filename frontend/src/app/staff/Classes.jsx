import { useEffect, useRef, useState } from "react";
import { api, saveBlob, upload } from "../api.js";
import { Bar, Box, Crumb, Icon, Loading, useApp } from "../ui.jsx";

export default function Classes() {
  const { t, user, toast } = useApp();
  const [list, setList] = useState(null);
  const [form, setForm] = useState(false);
  const [att, setAtt] = useState({});
  const [teachers, setTeachers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [schoolId, setSchoolId] = useState("");
  const fileFor = useRef(null);
  const file = useRef();
  const c = t.classes;
  const load = () => api("/school/classes").then(setList).catch(() => setList([]));
  useEffect(() => {
    load();
    api("/plan/attendance/overview").then((r) => setAtt(Object.fromEntries(r.map((x) => [x.class_id, x])))).catch(() => {});
  }, []);
  const canEdit = user.role === "teacher" || user.role === "admin";
  const isAdmin = user.role === "admin";
  useEffect(() => {
    if (!isAdmin || !form) return;
    api("/school/users?role=teacher").then(setTeachers).catch(() => setTeachers([]));
    api("/school/schools").then(setSchools).catch(() => setSchools([]));
  }, [isAdmin, form]);

  async function create(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const body = { name: f.name, grade: Number(f.grade) };
    if (isAdmin) {
      body.school_id = Number(f.school);
      if (f.teacher) body.teacher_id = Number(f.teacher);
    }
    let created;
    try { created = await api("/school/classes", { method: "POST", body }); }
    catch (ex) {
      const msg = { no_school: c.noSchool, no_teacher: c.noTeacher, teacher_other_school: c.teacherOtherSchool }[ex.code];
      return toast(msg || t.error);
    }
    setForm(false);
    // Админ может сразу приложить список учеников — заводим их в новый класс.
    if (f.students instanceof File && f.students.size) {
      try {
        saveBlob(await upload(`/school/classes/${created.id}/import`, f.students, { blob: true }), `logins-${created.id}.xlsx`);
        toast(c.importDone("✓"));
      } catch { toast(t.error); }
    }
    load();
  }
  async function newCode(id, teacher = false) {
    try { await api(`/school/classes/${id}/${teacher ? "teacher-code" : "code"}`, { method: "POST" }); load(); } catch { toast(t.error); }
  }
  async function onFile(e) {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      const blob = await upload(`/school/classes/${fileFor.current}/import`, f, { blob: true });
      saveBlob(blob, `logins-${fileFor.current}.xlsx`);
      toast(c.importDone("✓"));
      load();
    } catch { toast(t.error); }
  }
  if (!list) return <Loading />;
  return (
    <>
      <Crumb items={[[c.title]]} />
      <div className="page-head">
        <div><h1>{c.title}</h1><p className="subtitle">{c.sub}</p></div>
        {canEdit && <button className="btn" onClick={() => setForm(!form)}><Icon n="plus" s={18} /> {c.create}</button>}
      </div>
      {user.role === "teacher" && !user.school_id && <p className="note" style={{ marginBottom: 20 }}>{c.noSchool}</p>}
      {form && (
        <form className="card row wrap" style={{ marginBottom: 20, alignItems: "flex-end" }} onSubmit={create}>
          <label className="field grow">{c.name}<input name="name" required maxLength={50} autoFocus /></label>
          <label className="field" style={{ width: 120 }}>{c.grade}<select name="grade" defaultValue="8">{[5, 6, 7, 8, 9, 10, 11].map((g) => <option key={g}>{g}</option>)}</select></label>
          {isAdmin && (
            <label className="field grow">{c.school}
              <select name="school" required value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
                <option value="" disabled>{c.pickSchool}</option>
                {schools.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
          )}
          {isAdmin && (
            <label className="field grow">{c.teacher}
              <select name="teacher" defaultValue="" key={schoolId}>
                <option value="">{c.teacherByCode}</option>
                {teachers.filter((u) => !u.school_id || String(u.school_id) === schoolId)
                  .map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
          )}
          {isAdmin && <label className="field grow">{c.studentsFile}<input type="file" name="students" accept=".xlsx,.csv" /></label>}
          <button className="btn">{t.save}</button>
        </form>
      )}
      <input type="file" ref={file} hidden accept=".xlsx,.csv" onChange={onFile} />
      {list.length ? (
        <div className="grid g-2">
          {list.map((x) => (
            <div className="card" key={x.id}>
              <div className="row between">
                <div className="row"><Box sym={x.name} /><div><div className="card-title">{x.name}</div><div className="muted small">{c.students(x.students)}{x.teacher ? ` · ${x.teacher}` : ""}</div></div></div>
                <a className="btn sm" href={`#/class/${x.id}`}>{c.open}</a>
              </div>
              {att[x.id]?.total > 0 && <ClassToday a={att[x.id]} />}
              {x.code && (
                <div style={{ marginTop: 18 }}>
                  <div className="muted small">{c.code}</div>
                  <div className="row between"><b style={{ fontSize: 26, letterSpacing: 3 }}>{x.code}</b>
                    {canEdit && <button className="link" onClick={() => newCode(x.id)}>{c.newCode}</button>}</div>
                  <p className="muted small" style={{ margin: "4px 0 0" }}>{c.codeHelp}</p>
                </div>
              )}
              {isAdmin && x.teacher_code && (
                <div style={{ marginTop: 18 }}>
                  <div className="muted small">{c.teacherCode}</div>
                  <div className="row between"><b style={{ fontSize: 26, letterSpacing: 3 }}>{x.teacher_code}</b>
                    <button className="link" onClick={() => newCode(x.id, true)}>{c.newCode}</button></div>
                  <p className="muted small" style={{ margin: "4px 0 0" }}>{c.teacherCodeHelp}</p>
                </div>
              )}
              {canEdit && (
                <div style={{ borderTop: "1px solid var(--line)", marginTop: 16, paddingTop: 14 }}>
                  <button className="btn ghost sm" onClick={() => { fileFor.current = x.id; file.current.click(); }}>{c.importTitle}</button>
                  <p className="muted small" style={{ margin: "6px 0 0" }}>{c.importHelp}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : <div className="card empty muted">{c.noClasses}</div>}
    </>
  );
}

// Кто сегодня уже выполнил шаг плана, а кто нет — сразу на главной учителя.
function ClassToday({ a }) {
  const { t } = useApp();
  const at = t.att;
  const pct = Math.round((100 * a.present) / a.total);
  return (
    <div style={{ marginTop: 16 }}>
      <div className="row between small" style={{ marginBottom: 6 }}>
        <b>{at.classToday(a.present, a.total)}</b>
        <span className="muted">{at.rate}: {a.rate == null ? "—" : `${Math.round(a.rate * 100)}%`}</span>
      </div>
      <Bar p={pct} />
      {a.missing.length ? (
        <div className="small" style={{ marginTop: 8 }}>
          <span className="muted">{at.missing} </span>
          {a.missing.slice(0, 6).map((m, i) => (
            <span key={m.id}>{i > 0 && ", "}<a href={`#/student/${m.id}`} title={at.last(m.last_present)}>{m.name}</a></span>
          ))}
          {a.missing.length > 6 && <span className="muted"> +{a.missing.length - 6}</span>}
        </div>
      ) : <p className="small" style={{ margin: "8px 0 0", color: "var(--green)" }}>{at.allIn}</p>}
    </div>
  );
}
