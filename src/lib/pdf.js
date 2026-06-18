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
  // label proviene de t() (texto estático de traducción, seguro); value es dato de usuario → escapar.
  const field = (label, value) => value
    ? `<div class="field"><span class="label">${label}</span><span class="value">${esc(value)}</span></div>`
    : `<div class="field"><span class="label">${label}</span><span class="value empty">${t("Sin confirmar")}</span></div>`;

  const artistBlocks = artists.map(art => {
    const ckey = `${festId}__${dayId}__${art.id}`;
    const scDone = !!checks[`${ckey}__sc`];
    const showDone = !!checks[`${ckey}__show`];
    const myNotes = notes[ckey] || [];
    const mySlots = slots[ckey] || [];
    const extraStatic = (art.extraSlots || []).filter(s => s.label);
    const comments = art.comments || [];

    return `
      <div class="artist-block">
        <div class="artist-header">
          <div class="artist-name">${esc(art.artist) || "—"}</div>
          <div class="pills">
            <span class="pill ${scDone ? "pill-ok" : ""}">SC${scDone ? " ✓" : ""}</span>
            <span class="pill ${showDone ? "pill-show" : ""}">SHOW${showDone ? " ✓" : ""}</span>
          </div>
        </div>

        <div class="section-title">${t("Setup técnico")}</div>
        <div class="grid2">
          ${field(t("Mesa"), art.console)}
          ${field(t("Técnico"), art.tecnico)}
          <div class="field full-width">
            <span class="label">${t("Preset")}</span>
            <span class="value ${art.presetOk ? "preset-ok" : ""}">${esc(art.preset) || t("Sin confirmar")}${art.presetOk ? " ✓" : ""}</span>
          </div>
        </div>

        <div class="section-title">${t("Conexiones")}</div>
        <div class="grid2">
          ${field(t("Señal"), art.signal)}
          ${field(t("Conexión"), art.connection)}
        </div>

        ${art.corriente ? `<div class="section-title">${t("Corriente")}</div><div class="note-block">${esc(art.corriente)}</div>` : ""}

        ${(art.toLx || art.toMon) ? `
          <div class="section-title">${t("Rutas")}</div>
          <div class="grid2">
            ${art.toLx ? `<div class="route-chip">💡 TO LX &nbsp;<strong>${esc(art.toLx)}</strong></div>` : ""}
            ${art.toMon ? `<div class="route-chip">🎧 TO MON &nbsp;<strong>${esc(art.toMon)}</strong></div>` : ""}
          </div>` : ""}

        ${extraStatic.length ? `
          <div class="section-title">${t("Campos extra")}</div>
          <div class="grid2">
            ${extraStatic.map(s => `<div class="route-chip">📋 ${esc(s.label)} &nbsp;<strong>${esc(s.value) || "—"}</strong></div>`).join("")}
          </div>` : ""}

        ${comments.length ? `
          <div class="section-title">${t("Notas previas")}</div>
          ${comments.map(c => `<div class="note-block">${esc(c)}</div>`).join("")}` : ""}

        ${mySlots.length ? `
          <div class="section-title">${t("Slots en directo")}</div>
          <div class="grid2">
            ${mySlots.map(s => `<div class="route-chip">📋 ${esc(s.label)} &nbsp;<strong>${esc(s.value) || "—"}</strong></div>`).join("")}
          </div>` : ""}

        ${myNotes.length ? `
          <div class="section-title">${t("Notas FOH")}</div>
          ${myNotes.map(n => `<div class="note-block">${esc(n.text)}</div>`).join("")}` : ""}
      </div>`;
  }).join('<div class="page-break"></div>');

  const html = `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8">
  <title>Handover – ${esc(festName)} · ${esc(stageName)} · ${esc(dayLabel)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Arial', sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; padding: 24px; }
    .doc-header { border-bottom: 3px solid #C94A2A; padding-bottom: 12px; margin-bottom: 20px; }
    .doc-title { font-size: 22px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
    .doc-sub { font-size: 11px; color: #666; margin-top: 4px; letter-spacing: 0.08em; text-transform: uppercase; }
    .artist-block { margin-bottom: 0; }
    .artist-header { display: flex; justify-content: space-between; align-items: center; background: #1A1410; color: #F5EFE0; padding: 10px 14px; border-radius: 6px 6px 0 0; margin-bottom: 1px; }
    .artist-name { font-size: 16px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
    .pills { display: flex; gap: 6px; }
    .pill { font-size: 10px; padding: 3px 10px; border-radius: 99px; border: 1px solid #555; color: #aaa; font-weight: 600; }
    .pill-ok { background: #dcfce7; color: #166534; border-color: #86efac; }
    .pill-show { background: #dbeafe; color: #1e40af; border-color: #93c5fd; }
    .section-title { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #888; padding: 8px 14px 4px; background: #fafafa; border-left: 3px solid #C94A2A; margin: 1px 0; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #e5e7eb; margin-bottom: 1px; }
    .field { padding: 8px 12px; background: #fff; }
    .full-width { grid-column: 1 / -1; }
    .label { display: block; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #888; margin-bottom: 3px; }
    .value { font-size: 13px; font-weight: 500; }
    .value.empty { font-style: italic; color: #aaa; font-weight: 400; font-size: 12px; }
    .preset-ok { color: #16a34a; }
    .route-chip { padding: 8px 12px; background: #fff; font-size: 12px; }
    .note-block { font-size: 12px; line-height: 1.5; padding: 7px 12px; background: #f8fafc; border-left: 2px solid #cbd5e1; margin: 1px 0; }
    .page-break { page-break-after: always; margin: 20px 0; }
    .footer { margin-top: 20px; font-size: 10px; color: #aaa; text-align: right; border-top: 1px solid #e5e7eb; padding-top: 8px; }
    @media print {
      body { padding: 12px; }
      .page-break { margin: 0; }
    }
  </style></head><body>
  <div class="doc-header">
    <div class="doc-title">${esc(festName)}</div>
    <div class="doc-sub">${esc(stageName)} · ${esc(dayLabel)}${dateStr ? " · " + dateStr : ""}</div>
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
