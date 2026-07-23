// Escapa HTML para evitar XSS: los festivales son colaborativos, así que cualquier
// campo (nombre de artista, notas, comentarios…) puede contener marcado malicioso
// inyectado por otro miembro. Sin esto, document.write ejecutaría ese marcado en el
// origen de la app y podría robar la sesión de Supabase.
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

export function printHandoverPDF(artists, { festName, stageName, dayLabel, dayDate, notes, checks, slots, festId, dayId }, t = (s) => s, lang = "es") {
  const locale = ({ es: "es", en: "en-GB", fr: "fr" })[lang] || "es";
  const dateStr = dayDate ? new Date(dayDate + "T12:00").toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }) : "";
  const ctxLine = `${esc(festName)} · ${esc(stageName)} · ${esc(dayLabel)}${dateStr ? " · " + esc(dateStr) : ""}`;
  // label proviene de t() (texto estático de traducción, seguro); value es dato de usuario → escapar.
  const field = (label, value) => value
    ? `<div class="field"><span class="label">${label}</span><span class="value">${esc(value)}</span></div>`
    : `<div class="field"><span class="label">${label}</span><span class="value empty">${t("Sin confirmar")}</span></div>`;
  // fila flexible: si solo hay un campo, ocupa todo el ancho en vez de dejar un hueco vacío
  const row = (...fields) => `<div class="row">${fields.join("")}</div>`;
  const chip = (icon, label, value) => `<div class="chip"><span class="chip-label">${icon} ${label}</span><strong class="chip-value">${esc(value) || "—"}</strong></div>`;

  const artistBlocks = artists.map(art => {
    const ckey = `${festId}__${dayId}__${art.id}`;
    const scDone = !!checks[`${ckey}__sc`];
    const showDone = !!checks[`${ckey}__show`];
    const myNotes = notes[ckey] || [];
    const mySlots = slots[ckey] || [];
    const extraStatic = (art.extraSlots || []).filter(s => s.label);
    const comments = art.comments || [];

    return `
      <div class="artist-card">
        <div class="ctx-bar">${ctxLine}</div>
        <div class="artist-header">
          <div class="artist-name">${esc(art.artist) || "—"}</div>
          <div class="pills">
            <span class="pill ${scDone ? "pill-ok" : ""}">SC${scDone ? " ✓" : ""}</span>
            <span class="pill ${showDone ? "pill-show" : ""}">SHOW${showDone ? " ✓" : ""}</span>
          </div>
        </div>

        <div class="section-title">🎚️ ${t("Setup técnico")}</div>
        ${row(field(t("Mesa"), art.console), field(t("Técnico"), art.tecnico))}
        ${row(`<div class="field"><span class="label">${t("Preset")}</span><span class="value ${art.presetOk ? "preset-ok" : ""}">${esc(art.preset) || t("Sin confirmar")}${art.presetOk ? " ✓" : ""}</span></div>`)}

        <div class="section-title">🔌 ${t("Conexiones")}</div>
        ${row(field(t("Señal"), art.signal), field(t("Conexión"), art.connection))}

        ${art.corriente ? `<div class="section-title">⚡ ${t("Corriente")}</div><div class="note-block">${esc(art.corriente)}</div>` : ""}

        ${(art.toLx || art.toMon) ? `
          <div class="section-title">🔀 ${t("Rutas")}</div>
          <div class="chip-row">
            ${art.toLx ? chip("💡", "TO LX", art.toLx) : ""}
            ${art.toMon ? chip("🎧", "TO MON", art.toMon) : ""}
          </div>` : ""}

        ${extraStatic.length ? `
          <div class="section-title">📋 ${t("Campos extra")}</div>
          <div class="chip-row">
            ${extraStatic.map(s => chip("📋", esc(s.label), s.value)).join("")}
          </div>` : ""}

        ${comments.length ? `
          <div class="section-title">🗒️ ${t("Notas previas")}</div>
          ${comments.map(c => `<div class="note-block">${esc(c)}</div>`).join("")}` : ""}

        ${mySlots.length ? `
          <div class="section-title">🎬 ${t("Slots en directo")}</div>
          <div class="chip-row">
            ${mySlots.map(s => chip("📋", esc(s.label), s.value)).join("")}
          </div>` : ""}

        ${myNotes.length ? `
          <div class="section-title">📝 ${t("Notas FOH")}</div>
          ${myNotes.map(n => `<div class="note-block">${esc(n.text)}</div>`).join("")}` : ""}
      </div>`;
  }).join('<div class="page-break"></div>');

  const html = `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8">
  <title>Handover – ${esc(festName)} · ${esc(stageName)} · ${esc(dayLabel)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Arial', sans-serif; font-size: 12px; color: #1a1a1a; background: #f3f4f6; padding: 24px; }
    .doc-header { border-bottom: 3px solid #C94A2A; padding-bottom: 12px; margin-bottom: 20px; }
    .doc-title { font-size: 24px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
    .doc-sub { font-size: 11px; color: #666; margin-top: 4px; letter-spacing: 0.08em; text-transform: uppercase; }

    .artist-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; margin-bottom: 14px; }
    .ctx-bar { padding: 6px 16px; background: #f8fafc; border-bottom: 1px solid #eef0f2; font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8; font-weight: 600; }
    .artist-header { display: flex; justify-content: space-between; align-items: center; background: #1A1410; color: #F5EFE0; padding: 12px 16px; }
    .artist-name { font-size: 17px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
    .pills { display: flex; gap: 6px; flex-shrink: 0; }
    .pill { font-size: 10px; padding: 4px 11px; border-radius: 99px; border: 1px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.06); color: #d6d3d1; font-weight: 700; letter-spacing: 0.04em; }
    .pill-ok { background: #dcfce7; color: #166534; border-color: #86efac; }
    .pill-show { background: #dbeafe; color: #1e40af; border-color: #93c5fd; }

    .section-title { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #78716c; padding: 10px 16px 6px; background: #fafaf9; }
    .row { display: flex; background: #edeef0; gap: 1px; }
    .row:not(:last-child) { margin-bottom: 1px; }
    .field { flex: 1 1 0; min-width: 0; padding: 9px 16px; background: #fff; }
    .label { display: block; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #a1a1aa; margin-bottom: 3px; }
    .value { font-size: 13.5px; font-weight: 600; word-break: break-word; }
    .value.empty { font-style: italic; color: #b0aeac; font-weight: 400; font-size: 12.5px; }
    .preset-ok { color: #16a34a; }

    .chip-row { display: flex; flex-wrap: wrap; gap: 8px; padding: 2px 16px 12px; }
    .chip { flex: 1 1 220px; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 12px; background: #fafaf9; border: 1px solid #eef0f2; border-radius: 8px; font-size: 12px; }
    .chip-label { color: #78716c; font-weight: 600; }
    .chip-value { font-size: 13px; }

    .note-block { font-size: 12.5px; line-height: 1.55; padding: 9px 16px; margin: 0 16px 8px; background: #fffbeb; border-left: 3px solid #fcd34d; border-radius: 0 6px 6px 0; white-space: pre-wrap; }
    .note-block:first-of-type { margin-top: 2px; }

    .page-break { page-break-after: always; }
    .footer { margin-top: 4px; font-size: 10px; color: #999; text-align: right; }

    @media print {
      body { padding: 0; background: #fff; }
      .artist-card { border-radius: 0; border: none; border-bottom: 1px solid #e5e7eb; margin-bottom: 0; }
      .page-break { margin: 0; }
    }
  </style></head><body>
  <div class="doc-header">
    <div class="doc-title">${esc(festName)}</div>
    <div class="doc-sub">${esc(stageName)} · ${esc(dayLabel)}${dateStr ? " · " + esc(dateStr) : ""}</div>
  </div>
  ${artistBlocks}
  <div class="footer">${t("Generado:")} ${new Date().toLocaleString(locale)}</div>
  </body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 400);
}
