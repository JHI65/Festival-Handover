import Style from "./Style";
import { makeT, detectLang } from "../lib/i18n";

function Splash() {
  const t = makeT(detectLang());
  return (
    <div style={{ minHeight: "100vh", background: "#F5EFE0", display: "flex", alignItems: "center", justifyContent: "center", color: "#B0A090", fontFamily: "'DM Mono',monospace" }}>
      <Style />
      {t("cargando…")}
    </div>
  );
}

export default Splash;
