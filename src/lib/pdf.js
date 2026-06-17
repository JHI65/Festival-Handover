export function printHandoverPDF(artists, { festName, stageName, dayLabel, dayDate, notes, checks, slots, festId, dayId }) {
  const dateStr = dayDate ? new Date(dayDate + "T12:00").toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" }) : "";
  const field = (label, value) => value
    ? `<div class="field"><span class="label">${label}</span><span class="value">${value}</span></div>`
    : `<div class="field"><span class="label">${label}</span><span class="value empty">Sin confirmar</span></div>`;

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
          <div class="artist-name">${art.artist || "—"}</div>
          <div class="pills">
            <span class="pill ${scDone ? "pill-ok" : ""}">SC${scDone ? " ✓" : ""}</span>
            <span class="pill ${showDone ? "pill-show" : ""}">SHOW${showDone ? " ✓" : ""}</span>
          </div>
        </div>

        <div class="section-title">Setup técnico</div>
        <div class="grid2">
          ${field("Mesa", art.console)}
          ${field("Técnico", art.tecnico)}
          <div class="field full-width">
            <span class="label">Preset</span>
            <span class="value ${art.presetOk ? "preset-ok" : ""}">${art.preset || "Sin confirmar"}${art.presetOk ? " ✓" : ""}</span>
          </div>
        </div>

        <div class="section-title">Conexiones</div>
        <div class="grid2">
          ${field("Señal", art.signal)}
          ${field("Conexión", art.connection)}
        </div>

        ${art.corriente ? `<div class="section-title">Corriente</div><div class="note-block">${art.corriente}</div>` : ""}

        ${(art.toLx || art.toMon) ? `
          <div class="section-title">Rutas</div>
          <div class="grid2">
            ${art.toLx ? `<div class="route-chip">💡 TO LX &nbsp;<strong>${art.toLx}</strong></div>` : ""}
            ${art.toMon ? `<div class="route-chip">🎧 TO MON &nbsp;<strong>${art.toMon}</strong></div>` : ""}
          </div>` : ""}

        ${extraStatic.length ? `
          <div class="section-title">Campos extra</div>
          <div class="grid2">
            ${extraStatic.map(s => `<div class="route-chip">📋 ${s.label} &nbsp;<strong>${s.value || "—"}</strong></div>`).join("")}
          </div>` : ""}

        ${comments.length ? `
          <div class="section-title">Notas previas</div>
          ${comments.map(c => `<div class="note-block">${c}</div>`).join("")}` : ""}

        ${mySlots.length ? `
          <div class="section-title">Slots en directo</div>
          <div class="grid2">
            ${mySlots.map(s => `<div class="route-chip">📋 ${s.label} &nbsp;<strong>${s.value || "—"}</strong></div>`).join("")}
          </div>` : ""}

        ${myNotes.length ? `
          <div class="section-title">Notas FOH</div>
          ${myNotes.map(n => `<div class="note-block">${n.text}</div>`).join("")}` : ""}
      </div>`;
  }).join('<div class="page-break"></div>');

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Handover – ${festName} · ${stageName} · ${dayLabel}</title>
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
    <div class="doc-title">${festName}</div>
    <div class="doc-sub">${stageName} · ${dayLabel}${dateStr ? " · " + dateStr : ""}</div>
  </div>
  ${artistBlocks}
  <div class="footer">Generado: ${new Date().toLocaleString("es")}</div>
  </body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 400);
}
