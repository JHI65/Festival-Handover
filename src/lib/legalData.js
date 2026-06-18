// ============================================================================
// DATOS LEGALES — EDITA SOLO ESTE BLOQUE
// ============================================================================
// Rellena los placeholders entre corchetes con tus datos reales de autónomo.
// Todas las páginas legales (privacidad, aviso legal, cookies, términos) leen de
// aquí, así que cambiándolos una sola vez quedan actualizadas en todas partes.
//
// CONSEJOS DE PRIVACIDAD (ver conversación):
//   - DOMICILIO: puedes usar una dirección a efectos de notificaciones
//     (gestoría / apartado de correos), no hace falta tu domicilio particular.
//   - EMAIL_PRIVACIDAD: usa un correo dedicado (p. ej. privacidad@tudominio),
//     no tu email personal.
//
// ⚠️ Estos datos serán PÚBLICOS al desplegar (lo exige la ley: el responsable
//    debe ser identificable). Es el destino previsto, no una filtración.
// ============================================================================

export const LEGAL = {
  appName: "Festival Handover",
  appUrl: "https://[TU_USUARIO].github.io/Festival-Handover/",   // o tu dominio propio

  // Responsable del tratamiento / titular del sitio (autónomo)
  responsable: "[NOMBRE_Y_APELLIDOS]",
  nif: "[NIF]",
  domicilio: "[DOMICILIO A EFECTOS DE NOTIFICACIONES]",
  emailContacto: "[EMAIL_CONTACTO]",
  emailPrivacidad: "[EMAIL_PRIVACIDAD]",

  // Fecha de última actualización de los textos (cámbiala cuando los edites)
  ultimaActualizacion: "[FECHA, p. ej. 18 de junio de 2026]",

  // Proveedores (encargados del tratamiento). Revisa que coincidan con tu stack.
  proveedores: [
    { nombre: "Google Ireland Ltd.", finalidad: "Inicio de sesión (OAuth)", pais: "UE / EE. UU. (SCC)" },
    { nombre: "Supabase Inc.", finalidad: "Base de datos, autenticación y backend", pais: "EE. UU. (SCC)" },
    { nombre: "Proveedores de notificaciones push (Apple, Google, Mozilla)", finalidad: "Envío de avisos push", pais: "UE / EE. UU. (SCC)" },
  ],
};

// Versión del texto de consentimiento. Súbela (v2, v3…) si cambias las
// categorías de cookies: forzará a re-pedir el consentimiento a los usuarios.
export const CONSENT_VERSION = "1";
