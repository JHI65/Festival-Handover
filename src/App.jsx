import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import Style from "./components/Style";
import Splash from "./components/Splash";
import Main from "./components/Main";

/* ---------- login screen ---------- */
const INSTALL_STEPS = {
  ios: [
    <>"Compartir" <span style={{ color: "#D4A843" }}>⎙</span> en la barra inferior</>,
    <>"<span style={{ color: "#D4A843" }}>Añadir a pantalla de inicio</span>"</>,
    <>Pulsa "<span style={{ color: "#D4A843" }}>Añadir</span>"</>,
  ],
  android: [
    <>Menú <span style={{ color: "#D4A843" }}>⋮</span> arriba a la derecha</>,
    <>"<span style={{ color: "#D4A843" }}>Añadir a pantalla de inicio</span>"</>,
    <>Pulsa "<span style={{ color: "#D4A843" }}>Instalar</span>"</>,
  ],
  mac: [
    <>Clic en "Compartir" <span style={{ color: "#D4A843" }}>⎙</span> en la barra superior</>,
    <>"<span style={{ color: "#D4A843" }}>Añadir al Dock</span>"</>,
    <>Pulsa "<span style={{ color: "#D4A843" }}>Añadir</span>"</>,
  ],
  desktop: [
    <>Menú <span style={{ color: "#D4A843" }}>⋮</span> arriba a la derecha</>,
    <>"Más herramientas" → "<span style={{ color: "#D4A843" }}>Crear acceso directo...</span>"</>,
    <>Marca "Abrir como ventana" y pulsa "<span style={{ color: "#D4A843" }}>Crear</span>"</>,
  ],
};

function isMobileOrTabletDevice() {
  const ua = navigator.userAgent;
  const isTouchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1; // iPadOS reports as Mac
  return /iPhone|iPad|iPod|Android/i.test(ua) || isTouchMac;
}

function InstallSteps({ icon, title, steps }) {
  return (
    <div style={{ background: "rgba(245,239,224,0.05)", borderRadius: 16, padding: "16px 18px", border: "1px solid rgba(245,239,224,0.08)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 13, color: "#F5EFE0", fontFamily: "'DM Sans',sans-serif", fontWeight: 700 }}>{title}</span>
      </div>
      {steps.map((step, t) => (
        <div key={t} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: t < 2 ? 8 : 0 }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(212,168,67,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#D4A843", fontFamily: "'DM Mono',monospace", flexShrink: 0, marginTop: 1 }}>{t + 1}</div>
          <div style={{ fontSize: 13, color: "#9A8772", fontFamily: "'DM Sans',sans-serif", lineHeight: 1.45 }}>{step}</div>
        </div>
      ))}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}

function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showInstall, setShowInstall] = useState(
    () => !(window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches)
  );
  const isMobileOrTablet = isMobileOrTabletDevice();

  useEffect(() => {
    const el = document.documentElement;
    el.style.backgroundImage = "url('./bg-login.jpg')";
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center 30%";
    el.style.backgroundRepeat = "no-repeat";
    return () => {
      el.style.backgroundImage = "";
      el.style.backgroundSize = "";
      el.style.backgroundPosition = "";
      el.style.backgroundRepeat = "";
    };
  }, []);

  async function loginWithGoogle() {
    setLoading(true);
    setError(null);
    const sp = new URLSearchParams(window.location.search);
    const joinParam = sp.get("join") || sp.get("fest");
    const redirectTo = window.location.origin + "/Festival-Handover/" + (joinParam ? `?join=${encodeURIComponent(joinParam)}` : "");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) { setError(error.message); setLoading(false); }
  }

  return (
    <div style={{ minHeight: "100vh", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Sans',sans-serif" }}>
      <Style />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "url('./bg-login.jpg')", backgroundSize: "cover", backgroundPosition: "center 30%", zIndex: 0 }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(10,7,5,0.45) 0%, rgba(15,10,7,0.55) 100%)", zIndex: 0 }} />

      <div className="lg-card" style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 380, background: "rgba(28,22,17,0.10)", border: "1px solid rgba(245,239,224,0.15)", borderRadius: 20, padding: "44px 34px 30px", boxShadow: "0 30px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(245,239,224,0.05)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", textAlign: "center" }}>
        <div style={{ width: 72, height: 72, margin: "0 auto 22px", borderRadius: 18, background: "linear-gradient(145deg, #221A14, #14100B)", border: "1px solid rgba(245,239,224,0.10)", boxShadow: "0 8px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(245,239,224,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="lg-mark" style={{ display: "flex", alignItems: "center", gap: 4, height: 32 }}>
            <span /><span /><span /><span /><span />
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#B0A090", letterSpacing: "0.32em", fontFamily: "'DM Mono',monospace", marginBottom: 10 }}>FESTIVAL HANDOVER</div>
        <div style={{ fontSize: 46, lineHeight: 1, fontFamily: "'Bebas Neue',sans-serif", color: "#F5EFE0", letterSpacing: "0.04em", marginBottom: 12 }}>
          TUS <span style={{ color: "#D4A843" }}>FESTIVALES</span>
        </div>
        <div style={{ fontSize: 13, color: "#9A8772", marginBottom: 30, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.5 }}>
          Gestiona y sincroniza tus handovers de sonido en tiempo real con todo tu equipo.
        </div>
        <button onClick={loginWithGoogle} disabled={loading} className="lg-btn" style={{
          display: "flex", alignItems: "center", gap: 12,
          background: "#F5EFE0", border: "none", borderRadius: 12,
          padding: "15px 24px", fontSize: 14, fontWeight: 700,
          fontFamily: "'DM Mono',monospace", cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1, color: "#1A1410",
          boxShadow: "0 4px 18px rgba(0,0,0,0.4)",
          width: "100%", justifyContent: "center",
        }}>
          <GoogleIcon />
          {loading ? "Conectando…" : "Continuar con Google"}
        </button>
        {error && (
          <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(201,74,42,0.12)", border: "1px solid rgba(201,74,42,0.3)", color: "#E58A6E", fontSize: 12, textAlign: "center", fontFamily: "'DM Mono',monospace" }}>{error}</div>
        )}
      </div>

      {showInstall && (
        <div onClick={() => setShowInstall(false)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(10,7,5,0.30)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 20px", animation: "lg-fade .3s cubic-bezier(.2,.7,.3,1) both" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 360, background: "linear-gradient(160deg, #2E2318, #1E1610)", border: "1px solid rgba(245,239,224,0.14)", borderRadius: 28, padding: "30px 26px 26px", boxShadow: "0 24px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(245,239,224,0.08)", textAlign: "center" }}>
            <div style={{ fontSize: 44, marginBottom: 14, lineHeight: 1 }}>{isMobileOrTablet ? "📲" : "🖥️"}</div>
            <div style={{ fontSize: 11, color: "#C94A2A", letterSpacing: "0.25em", fontFamily: "'DM Mono',monospace", marginBottom: 6 }}>INSTALAR APP</div>
            <div style={{ fontSize: 26, fontFamily: "'Bebas Neue',sans-serif", color: "#F5EFE0", letterSpacing: "0.04em", marginBottom: 8 }}>Úsala como app nativa</div>
            <div style={{ fontSize: 13, color: "#9A8772", fontFamily: "'DM Sans',sans-serif", lineHeight: 1.6, marginBottom: 24 }}>
              {isMobileOrTablet
                ? "Añádela a tu pantalla de inicio para abrirla en pantalla completa, sin barras del navegador."
                : "Añádela a tu escritorio para abrirla en pantalla completa, sin barras del navegador."}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "left", marginBottom: 24 }}>
              {isMobileOrTablet ? (
                <>
                  <InstallSteps icon="🍎" title="iPhone / iPad — Safari" steps={INSTALL_STEPS.ios} />
                  <InstallSteps icon="🤖" title="Android — Chrome" steps={INSTALL_STEPS.android} />
                </>
              ) : (
                <>
                  <InstallSteps icon="🍎" title="Mac — Safari" steps={INSTALL_STEPS.mac} />
                  <InstallSteps icon="💻" title="Windows / Mac — Chrome" steps={INSTALL_STEPS.desktop} />
                </>
              )}
            </div>
            <button onClick={() => setShowInstall(false)} className="lg-btn" style={{ width: "100%", padding: "15px", borderRadius: 14, background: "#D4A843", border: "none", color: "#1A1410", fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: "0.12em", boxShadow: "0 4px 18px rgba(212,168,67,0.3)" }}>¡ENTENDIDO!</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================ */
export default function App() {
  const [session, setSession] = useState(undefined);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, []);

  // Mantener el Service Worker al día (clave en la app instalada de iOS/Android)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const checkForUpdate = () => {
      navigator.serviceWorker.getRegistration().then(reg => { if (reg) reg.update(); }).catch(() => {});
    };
    const onVisible = () => { if (document.visibilityState === 'visible') checkForUpdate(); };
    document.addEventListener('visibilitychange', onVisible);
    checkForUpdate();

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (session === undefined) return <Splash />;
  return (
    <>
      {!isOnline && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 99999, background: "#7C3A1A", color: "#F5EFE0", fontFamily: "'DM Mono',monospace", fontSize: 12, textAlign: "center", padding: "8px 16px", letterSpacing: "0.08em" }}>
          SIN CONEXIÓN — mostrando últimos datos guardados
        </div>
      )}
      {!session ? <LoginScreen /> : <Main session={session} offlineBannerOffset={!isOnline} />}
    </>
  );
}
