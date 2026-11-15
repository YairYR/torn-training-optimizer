// GA4 ya está cargado por gtag en cada HTML. Esto solo evita que un bloqueador
// de anuncios (gtag ausente) rompa un clic.
export function track(event: string, params: Record<string, string | number> = {}) {
  (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.('event', event, params);
}
