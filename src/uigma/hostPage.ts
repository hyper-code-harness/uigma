/**
 * Renders the host page of one Uigma document — the page a canvas tab frames: it frames the editor (on its own
 * origin), hands it the file, saves every copy it hands back, relays the agent's requests to it and shows what the
 * person should know (opening, not installed, saving failed, changed elsewhere). Its script is /uigma/host.js; the
 * messages are those of the editor's bridge (editor/speca.patch, src/app/host/bridge.ts). No CDN.
 * @param opts.name Document name.
 * @param opts.type design or board.
 * @param opts.csrf CSRF token for the page's saves and replies.
 * @param opts.editorUrl The editor's address without theme (origin + hosted-mode query); empty: not installed.
 * @param opts.lang ru or en. @default en
 * @param opts.canEdit The person may change the document. @default true
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Document name. */
    name: string;
    /** design or board. */
    type: "design" | "board";
    /** CSRF token for the page's saves and replies. */
    csrf: string;
    /** The editor's address without theme (origin + hosted-mode query); empty: not installed. */
    editorUrl: string;
    /** ru or en. @default en */
    lang?: string;
    /** The person may change the document. @default true */
    canEdit?: boolean;
}): Promise<string> {
    const esc = (text: unknown) => ctx.fns.w.escape({ text });
    const ru = opts.lang === "ru";
    const W = ru ? {
        opening: "Открываю редактор…",
        missing: "Редактор Uigma ещё не установлен. Агент ставит его вызовом uigma.installEditor({}) (или укажите готовую сборку в настройке uigma.editorDir), затем перезагрузите вкладку.",
        failed: "Редактор не открылся.", retry: "Повторить", gone: "Этого документа больше нет.",
        viewOnly: "Только просмотр — изменения не сохраняются", saveFailed: "Не удалось сохранить — пробую ещё раз",
        tooLarge: "Файл слишком большой — последние изменения не сохранены", conflict: "Этот файл изменили в другом окне.",
        reload: "Открыть свежую версию", keepMine: "Сохранить мою поверх", saved: "Сохранено",
    } : {
        opening: "Opening the editor…",
        missing: "The Uigma editor is not installed yet. An agent installs it with uigma.installEditor({}) (or point the uigma.editorDir setting at a build), then reload this tab.",
        failed: "The editor did not open.", retry: "Try again", gone: "This document is gone.",
        viewOnly: "View only — changes are not saved", saveFailed: "Could not save — trying again",
        tooLarge: "The file is too large — the last changes are not saved", conflict: "This file was changed in another window.",
        reload: "Open the fresh version", keepMine: "Save mine over it", saved: "Saved",
    };
    const words = JSON.stringify(W).replace(/</g, "\\u003c");
    const missing = !opts.editorUrl;
    return `<!doctype html>
<html lang="${ru ? "ru" : "en"}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.name)} · Uigma</title>
<style>
  :root { color-scheme: light dark; --bg: #f3f4f6; --fg: #202124; --fg2: #5f6368; --line: #dadce0; }
  html[data-theme=dark] { --bg: #1e1e1e; --fg: #e8eaed; --fg2: #9aa0a6; --line: #3c4043; }
  html, body { margin: 0; height: 100%; background: var(--bg); color: var(--fg); font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  .uigma { position: relative; height: 100%; display: flex; }
  .uigma [hidden] { display: none !important; }
  .uigma-frame { flex: 1; width: 100%; height: 100%; border: 0; display: block; background: var(--bg); }
  .uigma-over { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 24px; background: var(--bg); text-align: center; }
  .uigma-msg { margin: 0; max-width: 52ch; color: var(--fg2); }
  .uigma-msg code { font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; }
  .uigma-acts { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  .uigma-acts button { min-height: 36px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--line); background: transparent; color: var(--fg); font: inherit; cursor: pointer; }
  .uigma-acts button[data-act="retry"], .uigma-acts button[data-act="reload"] { background: var(--fg); color: var(--bg); border-color: var(--fg); }
  .uigma-note { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); margin: 0; padding: 6px 12px; max-width: calc(100% - 28px); border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--fg2); font-size: 12px; pointer-events: none; }
</style>
</head><body>
<div class="uigma" data-name="${esc(opts.name)}" data-type="${opts.type === "board" ? "board" : "design"}" data-csrf="${esc(opts.csrf)}" data-editor="${esc(opts.editorUrl)}" data-can-edit="${opts.canEdit === false ? "false" : "true"}">
  <iframe class="uigma-frame" title="Uigma" allow="clipboard-read; clipboard-write; local-fonts; fullscreen"${missing ? " hidden" : ""}></iframe>
  <div class="uigma-over">
    <p class="uigma-msg" role="status">${esc(missing ? W.missing : W.opening)}</p>
    <div class="uigma-acts">
      <button type="button" data-act="retry" hidden>${esc(W.retry)}</button>
      <button type="button" data-act="reload" hidden>${esc(W.reload)}</button>
      <button type="button" data-act="mine" hidden>${esc(W.keepMine)}</button>
    </div>
  </div>
  <p class="uigma-note" role="status" hidden></p>
  <script type="application/json" class="uigma-words">${words}</script>
</div>
${missing ? "" : `<script src="/uigma/host.js"></script>`}
</body></html>`;
}
