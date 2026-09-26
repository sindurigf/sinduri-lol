/// <reference types="astro/client" />

/*
 * Astro reaches bindings only through `cloudflare:workers`
 * (`Astro.locals.runtime.env` throws). Every ContactEnv field is optional, so
 * each caller handles a missing binding at runtime.
 */
declare module 'cloudflare:workers' {
  import type { ContactEnv } from './lib/contact-env';
  export const env: ContactEnv;
}

/* js-yaml 4 ships no types; `unknown` makes every caller validate the result. */
declare module 'js-yaml' {
  export function load(source: string): unknown;
}
