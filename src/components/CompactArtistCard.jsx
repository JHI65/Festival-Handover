import { useTheme, LT, DK, makeS } from "../lib/theme";
import { useLang } from "../lib/i18n";
import { sigColor, noInfo } from "../lib/utils";
import { PALETTE } from "../lib/constants";

function CompactArtistCard({ a, fest, day, checks, colorIdx, onSelect }) {
  const color = sigColor(a.signal);
  const { t } = useLang();
  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);

  const cardBg = T.card;
  const cardText = T.text;
  const borderC = T.border;
  const chipBg = T.card2;
  const chipBorder = T.border;
  const textTertiary = T.text4;
  const textSecondary = T.text3;
  const accentLeft = PALETTE[(colorIdx ?? 0) % PALETTE.length];

  const ckey = fest && day ? `${fest.id}__${day.id}__${a.id}` : null;
  const scDone = ckey ? !!checks?.[`${ckey}__sc`] : false;
  const showDone = ckey ? !!checks?.[`${ckey}__show`] : false;

  return (
    <div
      onClick={() => onSelect(a.id)}
      style={{
        border: `1px solid ${borderC}`,
        borderLeft: `5px solid ${accentLeft}`,
        borderRadius: 4,
        background: cardBg,
        color: cardText,
        cursor: "pointer",
        overflow: "hidden",
        position: "relative",
      }}>

      {/* header: name + tecnico/mesa */}
      <div style={{ padding: "16px 18px 12px 18px", borderBottom: `1px solid ${borderC}`, background: T.card2 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 5, marginBottom: 8 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 10, fontWeight: 500, padding: "2px 8px", borderRadius: 99,
            background: scDone ? "#E1F5EE" : chipBg,
            color: scDone ? "#085041" : textTertiary,
            border: `0.5px solid ${scDone ? "#1D9E7555" : chipBorder}`,
          }}>
            {scDone && <span style={{ width: 4, height: 4, background: "#1D9E75", borderRadius: "50%", display: "inline-block" }} />}
            SC
          </span>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 10, fontWeight: 500, padding: "2px 8px", borderRadius: 99,
            background: showDone ? "#E6F1FB" : chipBg,
            color: showDone ? "#0C447C" : textTertiary,
            border: `0.5px solid ${showDone ? "#2563eb55" : chipBorder}`,
          }}>
            {showDone && <span style={{ width: 4, height: 4, background: "#2563eb", borderRadius: "50%", display: "inline-block" }} />}
            SHOW
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 22, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.03em", lineHeight: 1, color: cardText }}>
            {a.artist || "—"}
          </span>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexShrink: 0, lineHeight: 1 }}>
            {a.tecnico && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 8, color: textTertiary, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'DM Mono',monospace" }}>{t("técnico")}</div>
                <div style={{ fontSize: 13, fontFamily: "'DM Mono',monospace" }}>{noInfo(a.tecnico)}</div>
              </div>
            )}
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 8, color: textTertiary, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'DM Mono',monospace" }}>{t("mesa")}</div>
              <div style={{ fontSize: 15, fontFamily: "'DM Mono',monospace" }}>{noInfo(a.console) || "—"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* body: signal chain chips */}
      <div style={{ padding: "12px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", padding: "4px 10px", borderRadius: 2, background: chipBg, border: `1px solid ${chipBorder}`, color: cardText }}>
            {noInfo(a.connection) || "—"}
          </span>
          <span style={{ color: textTertiary, fontSize: 12 }}>·</span>
          <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", padding: "4px 10px", borderRadius: 2, background: chipBg, border: `1px solid ${chipBorder}`, color }}>
            {noInfo(a.signal) || "—"}
          </span>
          {a.preset && (
            <span style={{
              marginLeft: "auto", fontSize: 11, fontFamily: "'DM Mono',monospace",
              padding: "4px 10px", borderRadius: 2,
              background: a.presetOk ? "rgba(42,107,107,0.1)" : chipBg,
              border: `1px solid ${a.presetOk ? "#2A6B6B" : chipBorder}`,
              color: a.presetOk ? "#2A6B6B" : textSecondary,
              display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              ⚙ {noInfo(a.preset)}
            </span>
          )}
        </div>

        {/* footer: lx · mon */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: textSecondary, paddingTop: 10, borderTop: `1px solid ${borderC}` }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, opacity: a.toLx ? 1 : 0.45 }}>
            💡 LX <strong style={{ color: cardText, fontFamily: "'DM Mono',monospace", fontWeight: 500 }}>{noInfo(a.toLx) || t("No")}</strong>
          </span>
          <span style={{ color: textTertiary }}>·</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, opacity: a.toMon ? 1 : 0.45 }}>
            🎧 Mon <strong style={{ color: cardText, fontFamily: "'DM Mono',monospace", fontWeight: 500 }}>{noInfo(a.toMon) || t("No")}</strong>
          </span>
          {a.corriente && (
            <>
              <span style={{ color: textTertiary }}>·</span>
              <span style={{
                fontSize: 9, fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em",
                padding: "2px 6px", borderRadius: 2,
                background: "#FFF8EC", border: "1px solid #D4A843", color: "#8a6e2a",
                display: "inline-flex", alignItems: "center", gap: 3,
                maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>⚡ {a.corriente}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default CompactArtistCard;
