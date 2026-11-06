/**
 * URLs de integración entre la Landing Page y el Sistema POS
 */
export const POS_APP_URL = import.meta.env.VITE_POS_APP_URL || "https://app.jirehpos.com";
export const POS_LOGIN_URL = `${POS_APP_URL}/login`;
export const POS_SIGNUP_API = import.meta.env.VITE_POS_SIGNUP_API || "/api/onboard-trial";
export const SUPPORT_WHATSAPP_PHONE = import.meta.env.VITE_SUPPORT_WHATSAPP_PHONE || "5492664689173";
