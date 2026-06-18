import { useEffect } from "react";
import { LEGAL } from "../lib/legalData";

// Páginas legales (RGPD/LOPDGDD + LSSI-CE + mención CCPA). Texto en español, que
// es la versión vinculante para un autónomo en España. Los datos del responsable
// se leen de src/lib/legalData.js (edita solo ese fichero).
//
// page: "privacy" | "legal" | "cookies" | "terms"

const C = {
  bg: "#0F0A07",
  card: "#1A1410",
  text: "#F5EFE0",
  muted: "#B0A090",
  faint: "#9A8772",
  accent: "#D4A843",
  accent2: "#C94A2A",
  border: "rgba(245,239,224,0.12)",
};

const PAGES = [
  { key: "privacy", label: "Privacidad", title: "Política de Privacidad" },
  { key: "legal", label: "Aviso legal", title: "Aviso Legal" },
  { key: "cookies", label: "Cookies", title: "Política de Cookies" },
  { key: "terms", label: "Términos", title: "Términos de Uso" },
];

const s = {
  h2: { fontSize: 15, color: C.accent, fontFamily: "'DM Mono',monospace", fontWeight: 700, letterSpacing: "0.04em", margin: "26px 0 10px" },
  p: { fontSize: 13.5, color: C.muted, lineHeight: 1.65, margin: "0 0 12px", fontFamily: "'DM Sans',sans-serif" },
  li: { fontSize: 13.5, color: C.muted, lineHeight: 1.6, margin: "0 0 7px", fontFamily: "'DM Sans',sans-serif" },
  strong: { color: C.text, fontWeight: 700 },
  a: { color: C.accent, textDecoration: "underline" },
};

const P = ({ children }) => <p style={s.p}>{children}</p>;
const H = ({ children }) => <h2 style={s.h2}>{children}</h2>;
const B = ({ children }) => <strong style={s.strong}>{children}</strong>;
const UL = ({ children }) => <ul style={{ margin: "0 0 12px", paddingLeft: 20 }}>{children}</ul>;
const LI = ({ children }) => <li style={s.li}>{children}</li>;

function IdentityBlock() {
  return (
    <UL>
      <LI><B>Responsable:</B> {LEGAL.responsable}</LI>
      <LI><B>NIF:</B> {LEGAL.nif}</LI>
      <LI><B>Domicilio:</B> {LEGAL.domicilio}</LI>
      <LI><B>Correo de contacto:</B> {LEGAL.emailContacto}</LI>
      <LI><B>Sitio / aplicación:</B> {LEGAL.appName} — {LEGAL.appUrl}</LI>
    </UL>
  );
}

function Privacy() {
  return (
    <>
      <P>En {LEGAL.appName} respetamos tu privacidad. Esta política explica qué datos personales tratamos, con qué finalidad, sobre qué base jurídica y qué derechos tienes, conforme al Reglamento (UE) 2016/679 (RGPD) y a la Ley Orgánica 3/2018 (LOPDGDD).</P>

      <H>1. Responsable del tratamiento</H>
      <IdentityBlock />
      <P>Para cualquier cuestión sobre tus datos puedes escribir a <B>{LEGAL.emailPrivacidad}</B>.</P>

      <H>2. Qué datos tratamos y con qué finalidad</H>
      <UL>
        <LI><B>Datos de cuenta</B> (al iniciar sesión con Google): nombre, dirección de correo y, en su caso, foto de perfil. Finalidad: autenticarte e identificarte dentro de la aplicación.</LI>
        <LI><B>Datos de contenido</B> que tú introduces: festivales, escenarios, artistas, técnicos, horarios, notas y configuraciones. Finalidad: prestar el servicio y sincronizarlo en tiempo real con las personas de tu equipo a las que invites.</LI>
        <LI><B>Datos técnicos:</B> token de suscripción a notificaciones push (si las activas) y preferencias (idioma, tema) almacenadas en tu dispositivo. Finalidad: enviarte avisos y recordar tus preferencias.</LI>
      </UL>
      <P>No elaboramos perfiles ni tomamos decisiones automatizadas con efectos jurídicos sobre ti.</P>

      <H>3. Base jurídica</H>
      <UL>
        <LI><B>Ejecución de un contrato</B> (art. 6.1.b RGPD): el tratamiento de los datos de cuenta y de contenido es necesario para prestarte el servicio que solicitas.</LI>
        <LI><B>Consentimiento</B> (art. 6.1.a RGPD): para el envío de notificaciones push, que solo activamos si lo solicitas expresamente. Puedes retirarlo en cualquier momento.</LI>
        <LI><B>Interés legítimo</B> (art. 6.1.f RGPD): para garantizar la seguridad de la aplicación y prevenir abusos.</LI>
      </UL>

      <H>4. Destinatarios y encargados del tratamiento</H>
      <P>No vendemos ni cedemos tus datos a terceros con fines comerciales. Para prestar el servicio nos apoyamos en proveedores que actúan como encargados del tratamiento bajo contrato:</P>
      <UL>
        {LEGAL.proveedores.map((p, i) => (
          <LI key={i}><B>{p.nombre}:</B> {p.finalidad} ({p.pais}).</LI>
        ))}
      </UL>
      <P>Los datos de contenido de un festival son visibles para las personas a las que tú (o el propietario del festival) inviten a colaborar.</P>

      <H>5. Transferencias internacionales</H>
      <P>Algunos proveedores pueden tratar datos fuera del Espacio Económico Europeo. En esos casos las transferencias se amparan en las Cláusulas Contractuales Tipo (SCC) aprobadas por la Comisión Europea u otras garantías adecuadas previstas en el RGPD.</P>

      <H>6. Conservación</H>
      <P>Conservamos tus datos mientras tu cuenta esté activa. Puedes <B>eliminar tu cuenta y todos tus datos</B> en cualquier momento desde los ajustes de la aplicación; el borrado es efectivo e irreversible. También eliminamos los datos cuando dejan de ser necesarios para las finalidades descritas.</P>

      <H>7. Tus derechos</H>
      <P>Puedes ejercer los derechos de <B>acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad</B>, así como retirar tu consentimiento, escribiendo a {LEGAL.emailPrivacidad}. Si consideras que no hemos atendido correctamente tu solicitud, puedes reclamar ante la Agencia Española de Protección de Datos (<a style={s.a} href="https://www.aepd.es" target="_blank" rel="noreferrer">www.aepd.es</a>).</P>

      <H>8. Usuarios residentes en California (CCPA)</H>
      <P>Si resides en California, dispones del derecho a saber qué información personal tratamos, a solicitar su eliminación y a no ser discriminado por ejercer tus derechos. <B>No vendemos</B> tu información personal en el sentido de la CCPA. Para ejercer estos derechos, escribe a {LEGAL.emailPrivacidad}.</P>

      <H>9. Menores de edad</H>
      <P>La aplicación no está dirigida a menores de 14 años. Si eres titular de la patria potestad y detectas que un menor nos ha facilitado datos, contáctanos y los eliminaremos.</P>

      <H>10. Seguridad</H>
      <P>Aplicamos medidas técnicas y organizativas para proteger tus datos: cifrado en tránsito (HTTPS), control de acceso por roles, aislamiento de datos entre cuentas y minimización de la información tratada.</P>

      <H>11. Cambios en esta política</H>
      <P>Podemos actualizar esta política para reflejar cambios legales o del servicio. Publicaremos la versión vigente en esta misma página con su fecha de actualización.</P>
    </>
  );
}

function LegalNotice() {
  return (
    <>
      <P>En cumplimiento del artículo 10 de la Ley 34/2002 de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa de los siguientes datos.</P>

      <H>1. Datos identificativos del titular</H>
      <IdentityBlock />

      <H>2. Objeto</H>
      <P>{LEGAL.appName} es una aplicación que permite gestionar y compartir información técnica de directos (handovers de sonido) entre equipos. El presente Aviso Legal regula el acceso y uso del sitio y la aplicación.</P>

      <H>3. Condiciones de acceso y uso</H>
      <P>El acceso es gratuito, salvo por el coste de la conexión. El usuario se compromete a hacer un uso lícito y diligente de la aplicación, conforme a la ley, a la buena fe y a estos términos, y a no emplearla con fines ilícitos o lesivos para terceros.</P>

      <H>4. Propiedad intelectual e industrial</H>
      <P>El código, el diseño, la marca y los demás elementos de la aplicación pertenecen al titular o cuentan con la correspondiente licencia. No se permite su reproducción, distribución o transformación sin autorización. Los datos y contenidos que introduce cada usuario siguen siendo de su titularidad.</P>

      <H>5. Exclusión de responsabilidad</H>
      <P>El titular presta el servicio «tal cual» y no garantiza la ausencia de interrupciones o errores. No se responsabiliza de los daños derivados del mal uso de la aplicación ni de la veracidad de los datos introducidos por los usuarios.</P>

      <H>6. Legislación aplicable y jurisdicción</H>
      <P>Estas condiciones se rigen por la legislación española. Para la resolución de cualquier controversia, las partes se someten a los Juzgados y Tribunales del domicilio del usuario cuando este sea consumidor; en caso contrario, a los del domicilio del titular.</P>
    </>
  );
}

function Cookies() {
  return (
    <>
      <P>Esta política explica el almacenamiento que {LEGAL.appName} utiliza en tu dispositivo, conforme al artículo 22.2 de la LSSI-CE y a la guía de la AEPD.</P>

      <H>1. Qué es</H>
      <P>Las «cookies» y tecnologías similares (como el almacenamiento local del navegador) son pequeños archivos de datos que una web o aplicación guarda en tu dispositivo para funcionar o recordar información.</P>

      <H>2. Qué utiliza esta aplicación</H>
      <P>{LEGAL.appName} <B>solo usa almacenamiento técnico necesario</B> para funcionar. No empleamos cookies de analítica, publicidad ni seguimiento de terceros. En concreto:</P>
      <UL>
        <LI><B>Sesión de usuario</B> (almacenamiento local de Supabase): te mantiene con la sesión iniciada. Necesaria. Persistente hasta que cierras sesión.</LI>
        <LI><B>Preferencia de idioma y tema:</B> recuerdan tu idioma y el modo claro/oscuro. Necesarias para tu experiencia.</LI>
        <LI><B>Registro de consentimiento</B> (<code>cookieConsent</code>): guarda la elección que haces en el banner. Necesaria para no volver a preguntártelo.</LI>
        <LI><B>Suscripción a notificaciones push:</B> solo si las activas, para poder enviarte avisos.</LI>
      </UL>
      <P>Como solo usamos almacenamiento necesario, la aplicación funciona sin que tengas que aceptar cookies no esenciales. Si en el futuro incorporamos analítica o medición, te lo pediremos previamente mediante el banner de consentimiento.</P>

      <H>3. Cómo gestionarlo</H>
      <P>Puedes borrar este almacenamiento en cualquier momento desde los ajustes de tu navegador (borrar datos de navegación del sitio) o desinstalando la aplicación. Ten en cuenta que, al ser almacenamiento necesario, eliminarlo cerrará tu sesión y restablecerá tus preferencias.</P>

      <H>4. Cambios</H>
      <P>Si cambiamos el almacenamiento que utilizamos, actualizaremos esta página y, cuando proceda, volveremos a solicitar tu consentimiento.</P>
    </>
  );
}

function Terms() {
  return (
    <>
      <P>Estos Términos regulan el uso de {LEGAL.appName}. Al crear una cuenta o utilizar la aplicación, los aceptas.</P>

      <H>1. Objeto</H>
      <P>{LEGAL.appName} es una herramienta para crear, gestionar y compartir información técnica de directos entre equipos de sonido. El titular es {LEGAL.responsable}.</P>

      <H>2. Cuenta de usuario</H>
      <P>Para usar la aplicación necesitas iniciar sesión con una cuenta de Google. Eres responsable de la actividad realizada desde tu cuenta y de mantener la confidencialidad del acceso.</P>

      <H>3. Uso aceptable</H>
      <P>Te comprometes a no usar la aplicación con fines ilícitos, a no introducir contenido que infrinja derechos de terceros o la ley, y a no intentar vulnerar la seguridad del servicio ni acceder a datos de otros usuarios sin autorización.</P>

      <H>4. Contenido del usuario</H>
      <P>Conservas la titularidad de los datos y contenidos que introduces. Nos concedes únicamente la licencia necesaria para almacenarlos, procesarlos y mostrarlos con el fin de prestarte el servicio y compartirlos con las personas que invites. Eres responsable de la legalidad de los datos que introduces, incluidos los de terceros (p. ej. datos de contacto de técnicos), para lo que debes contar con base legitimadora.</P>

      <H>5. Precio</H>
      <P>El servicio se ofrece actualmente de forma <B>gratuita</B>. En el futuro podrán introducirse planes o funciones de pago; en tal caso se informará con claridad de las condiciones, precios y, cuando proceda, del derecho de desistimiento, antes de cualquier contratación. Ninguna función de pago se activará sin tu consentimiento expreso.</P>

      <H>6. Disponibilidad y garantías</H>
      <P>El servicio se presta «tal cual» y «según disponibilidad». No garantizamos que sea ininterrumpido o libre de errores. Podremos modificar, suspender o discontinuar funciones, procurando avisar con antelación razonable cuando sea posible.</P>

      <H>7. Limitación de responsabilidad</H>
      <P>En la medida permitida por la ley, el titular no será responsable de daños indirectos o pérdida de datos derivados del uso o la imposibilidad de uso de la aplicación. Nada en estos términos limita la responsabilidad que no pueda excluirse legalmente.</P>

      <H>8. Suspensión y terminación</H>
      <P>Puedes eliminar tu cuenta cuando quieras desde los ajustes. Podemos suspender o cancelar cuentas que incumplan estos términos o la ley.</P>

      <H>9. Modificaciones</H>
      <P>Podemos actualizar estos Términos. La versión vigente se publicará en esta página con su fecha. El uso continuado tras los cambios implica su aceptación.</P>

      <H>10. Ley aplicable</H>
      <P>Estos Términos se rigen por la legislación española, con sometimiento a los tribunales competentes conforme a la normativa de consumidores cuando resulte aplicable.</P>
    </>
  );
}

const BODIES = { privacy: Privacy, legal: LegalNotice, cookies: Cookies, terms: Terms };

export default function LegalView({ page = "privacy", onClose, onNavigate }) {
  const current = PAGES.find(p => p.key === page) || PAGES[0];
  const Body = BODIES[current.key];

  // Bloquear el scroll del fondo mientras está abierto.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: C.bg, display: "flex", flexDirection: "column", fontFamily: "'DM Sans',sans-serif" }}>
      {/* Header */}
      <div style={{ flexShrink: 0, borderBottom: `1px solid ${C.border}`, padding: "calc(14px + env(safe-area-inset-top,0px)) 18px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", background: C.card }}>
        <div style={{ fontSize: 18, fontFamily: "'Bebas Neue',sans-serif", color: C.text, letterSpacing: "0.05em" }}>{current.title}</div>
        <button onClick={onClose} aria-label="Cerrar" style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 8, width: 34, height: 34, cursor: "pointer", fontSize: 16 }}>✕</button>
      </div>

      {/* Nav entre documentos */}
      <div style={{ flexShrink: 0, display: "flex", gap: 6, padding: "10px 14px", overflowX: "auto", background: C.card, borderBottom: `1px solid ${C.border}` }}>
        {PAGES.map(p => (
          <button key={p.key} onClick={() => onNavigate?.(p.key)} style={{
            flexShrink: 0, padding: "7px 12px", borderRadius: 999, cursor: "pointer",
            fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
            border: `1px solid ${p.key === current.key ? C.accent : C.border}`,
            background: p.key === current.key ? "rgba(212,168,67,0.14)" : "transparent",
            color: p.key === current.key ? C.accent : C.faint,
          }}>{p.label}</button>
        ))}
      </div>

      {/* Cuerpo */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px calc(40px + env(safe-area-inset-bottom,0px))", maxWidth: 760, margin: "0 auto", width: "100%" }}>
        <div style={{ fontSize: 11, color: C.faint, fontFamily: "'DM Mono',monospace", margin: "16px 0 4px", letterSpacing: "0.06em" }}>
          Última actualización: {LEGAL.ultimaActualizacion}
        </div>
        <Body />
        <div style={{ height: 1, background: C.border, margin: "28px 0 16px" }} />
        <div style={{ fontSize: 11, color: C.faint, fontFamily: "'DM Mono',monospace", lineHeight: 1.6 }}>
          {LEGAL.appName} · {LEGAL.responsable} · {LEGAL.emailContacto}
        </div>
      </div>
    </div>
  );
}
