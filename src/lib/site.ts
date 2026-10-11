export const SITE_NAME = 'sinduri.lol';

/* The home screen label: the manifest's short_name and iOS's web app title. */
export const SITE_SHORT_NAME = 'sinduri';

/** Bing Webmaster Tools reads this on the homepage; removing it unverifies the site. */
export const BING_SITE_VERIFICATION = '43CC5D0A5D1436DBF68D869408DF0A34';

/** `why` names what needs absolute URLs; the build fails with it. */
export const requireSite = (site: URL | undefined, why: string): URL => {
  if (!site) throw new Error(`Set \`site\` in astro.config.mjs: ${why}`);
  return site;
};
