/// <reference types="astro/client" />

/*
 * `cloudflare:workers` is the Worker runtime's virtual module, and since Astro
 * v6 it is the only way to reach a binding: `Astro.locals.runtime.env` was
 * removed and throws at runtime rather than returning undefined.
 *
 * Typed with this site's own binding surface rather than the platform's, so a
 * binding that is not declared in wrangler.jsonc is a type error here instead
 * of an undefined in the handler.
 */
declare module 'cloudflare:workers' {
  import type { ContactEnv } from './lib/contact-env';
  export const env: ContactEnv;
}
