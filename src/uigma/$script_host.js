// Uigma's host page script (/uigma/host.js). The editor runs in a frame on an origin of its own and has no way into
// Hyper; this page — Hyper's — fetches the file for it, saves every copy it hands back, and relays what an agent
// asks of it. The messages are listed in the editor's bridge (editor/speca.patch, src/app/host/bridge.ts):
//   host → editor   {uigma:'init', doc, name, type, canEdit, theme} · {uigma:'call', id, command, args}
//                   {uigma:'cancel', id} · {uigma:'flush'} · {uigma:'theme', theme}
//   editor → host   {uigma:'ready'} · {uigma:'loaded', summary} · {uigma:'dirty'} · {uigma:'clean'}
//                   {uigma:'save', seq, bytes, summary} · {uigma:'result', id, ok, result|error} · {uigma:'failed', error}
// The canvas around tells this page its theme: {hyperCanvas: 1, type: 'theme', theme}.
(() => {
  const root = document.querySelector(".uigma");
  if (!root || root.dataset.on) return;
  root.dataset.on = "1";
  const name = root.dataset.name, type = root.dataset.type, base = root.dataset.editor, csrf = root.dataset.csrf || "";
  const frame = root.querySelector(".uigma-frame"), over = root.querySelector(".uigma-over"), msg = root.querySelector(".uigma-msg"), note = root.querySelector(".uigma-note");
  const W = JSON.parse(root.querySelector(".uigma-words").textContent);
  const enc = encodeURIComponent(name);
  let canEdit = root.dataset.canEdit === "true";
  let origin = "";            // the editor's origin: the only one listened to and posted to
  let loaded = false;         // the editor has the file
  let rev = 0;                // the revision the editor's file started from — named back with each save
  let editorDirty = false;    // the editor has edits it has not handed over yet
  let slot = null;            // the newest copy not saved yet {bytes, summary, force?}
  let inflight = null;        // the copy being saved now
  let conflict = false;       // the file changed elsewhere: the person chooses, nothing is saved meanwhile
  let held = null;            // the copy kept for "save mine over it"
  let es = null, retryT = 0, readyT = 0, turn = 0;
  let theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const setTheme = (t) => { theme = t; document.documentElement.dataset.theme = t; };
  setTheme(theme);

  const show = (text, ...acts) => { msg.textContent = text; over.hidden = false; for (const b of root.querySelectorAll("[data-act]")) b.hidden = !acts.includes(b.dataset.act); };
  const say = (text) => { note.textContent = text || ""; note.hidden = !text; };
  const toEditor = (m, transfer) => { if (origin && frame.contentWindow) frame.contentWindow.postMessage(m, origin, transfer || []); };
  const closeBridge = () => { es?.close(); es = null; };

  // ── the way in: the editor's address with the theme of the moment ──
  function enter() {
    const mine = ++turn;
    loaded = false; editorDirty = false; delete root.dataset.ready; closeBridge(); clearTimeout(readyT);
    show(W.opening);
    const url = new URL(base);
    url.searchParams.set("theme", theme);
    origin = url.origin;
    frame.hidden = false;
    frame.src = url.href;
    readyT = setTimeout(() => { if (!loaded && mine === turn) show(W.failed, "retry"); }, 60_000);
  }

  // ── the editor is up: give it the file ──
  async function open() {
    const mine = turn;
    const r = await fetch(`/uigma/doc/${enc}`, { cache: "no-store", credentials: "same-origin" }).catch(() => null);
    if (mine !== turn) return;
    if (!r || (!r.ok && r.status !== 204)) return r?.status === 404 ? show(W.gone) : show(W.failed, "retry");
    rev = Number(r.headers.get("x-uigma-rev")) || 0;
    const doc = r.status === 200 ? await r.arrayBuffer() : null;
    if (mine !== turn) return;
    toEditor({ uigma: "init", doc, name, type, canEdit, theme }, doc ? [doc] : []);
  }

  // ── saving: one request at a time, always the newest copy ──
  async function pump() {
    if (inflight || !slot || conflict || !canEdit) return;
    const job = (inflight = slot); slot = null;
    clearTimeout(retryT);
    const form = new FormData();
    form.append("summary", JSON.stringify(job.summary || {}));
    form.append("file", new Blob([job.bytes], { type: "application/octet-stream" }), type === "board" ? "board.jam" : "file.fig");
    const r = await fetch(`/uigma/save/${enc}?base=${rev}${job.force ? "&force=1" : ""}`, { method: "POST", credentials: "same-origin", headers: { "x-csrf-token": csrf }, body: form }).catch(() => null);
    inflight = null;
    if (r?.ok) { rev = (await r.json().catch(() => ({}))).rev ?? rev; say(""); root.dataset.rev = String(rev); return pump(); }
    if (r?.status === 409) { conflict = true; held = slot || job; slot = null; return show(W.conflict, "reload", "mine"); }
    if (r?.status === 413) return say(W.tooLarge);
    if (r?.status === 404 || r?.status === 403) { canEdit = false; slot = null; closeBridge(); return say(W.viewOnly); }
    // the network or the server: the newest copy stays and goes again
    slot = slot || job; say(W.saveFailed); retryT = setTimeout(pump, 5000);
  }

  // ── the agent's line: what it asks comes as server-sent events, the editor's answer goes back by POST ──
  const reply = (m) => fetch(`/uigma/reply/${enc}`, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "x-csrf-token": csrf }, body: JSON.stringify({ id: m.id, ok: m.ok === true, result: m.result, error: m.error }) }).catch(() => {});
  function openBridge() {
    if (es || !canEdit) return;
    es = new EventSource(`/uigma/bridge/${enc}`);
    es.addEventListener("ask", (e) => {
      const a = JSON.parse(e.data);
      if (!loaded || conflict) return void reply({ id: a.id, ok: false, error: conflict ? "the file was changed in another window; the person has to choose which one stays" : "the editor is still opening the file" });
      toEditor({ uigma: "call", id: a.id, command: a.command, args: a.args });
    });
    es.addEventListener("cancel", (e) => toEditor({ uigma: "cancel", id: JSON.parse(e.data).id }));
  }

  addEventListener("message", (e) => {
    const m = e.data; if (!m || typeof m !== "object") return;
    // the canvas around (Hyper's page that frames this one) says its theme
    if (e.source === parent && m.hyperCanvas === 1 && m.type === "theme" && (m.theme === "dark" || m.theme === "light")) {
      if (m.theme !== theme) { setTheme(m.theme); toEditor({ uigma: "theme", theme: m.theme }); }
      return;
    }
    if (!origin || e.source !== frame.contentWindow || e.origin !== origin) return;
    switch (m.uigma) {
      case "ready": loaded = false; open(); break;
      case "loaded":
        loaded = true; clearTimeout(readyT); over.hidden = true; say(canEdit ? "" : W.viewOnly);
        setTimeout(() => { if (loaded) root.dataset.ready = "1"; }, 600);     // its first frame is drawn
        openBridge();
        break;
      case "dirty": editorDirty = true; break;
      case "clean": editorDirty = false; break;
      case "save":
        editorDirty = false;
        if (!canEdit || !(m.bytes instanceof ArrayBuffer)) break;
        if (conflict) held = { bytes: m.bytes, summary: m.summary }; else { slot = { bytes: m.bytes, summary: m.summary }; pump(); }
        break;
      case "result": if (typeof m.id === "string") reply(m); break;
      case "failed": if (m.saving) say(W.saveFailed); else { clearTimeout(readyT); show(W.failed, "retry"); } break;
    }
  });

  root.addEventListener("click", (e) => {
    const act = e.target.closest?.("[data-act]")?.dataset.act;
    if (act === "retry") enter();
    else if (act === "reload") { slot = held = null; conflict = false; enter(); }       // theirs stays: what was not saved here is let go
    else if (act === "mine" && held) { slot = { ...held, force: true }; held = null; conflict = false; over.hidden = true; pump(); }
  });
  const unsaved = () => editorDirty || !!slot || !!inflight || !!held;
  addEventListener("beforeunload", (e) => { if (!unsaved()) return; toEditor({ uigma: "flush" }); e.preventDefault(); e.returnValue = ""; });
  addEventListener("pagehide", () => { toEditor({ uigma: "flush" }); closeBridge(); });
  // the canvas tells the theme on load; start a moment later with whichever came
  setTimeout(enter, 150);
})();
