import {
  CLICK_EVENTS,
  DOWNLOAD_EXTENSIONS,
  MAX_LABEL_LENGTH,
  type ClickEventData,
  type ClickEventName,
} from '../lib/analytics';

/*
 * Sends a Umami event for every link and button a reader activates.
 *
 * NOT the tracker's own `data-umami-event` attributes. For a marked same-tab
 * link the tracker calls preventDefault, awaits its request, and only then
 * navigates, with no timeout: a slow or blocked collector would hold the
 * click. This listener never touches the event, and `umami.track` sends with
 * `keepalive`, so the request outlives the navigation it rides along with.
 *
 * Whether anything is sent is the tracker's decision, not this file's:
 * `umami.track` drops the event under Do Not Track and on any host outside
 * `data-domains`. So this can run everywhere, tests included.
 */

declare global {
  interface Window {
    umami?: { track: (name: string, data?: ClickEventData) => unknown };
  }
}

const CLICKABLE =
  'a[href], button, summary, input[type="submit"], input[type="button"]';

/*
 * Keyed by tag name. `closest` with all of them returns the nearest, so a link
 * in the mobile menu dialog reports the menu rather than the header around it.
 */
const AREAS: Readonly<Record<string, string>> = {
  dialog: 'menu',
  header: 'header',
  footer: 'footer',
  main: 'main',
};
const AREA_SELECTOR = Object.keys(AREAS).join(', ');
const NO_AREA = 'page';

const MIDDLE_BUTTON = 1;

const labelOf = (element: Element): string => {
  const text =
    element.getAttribute('aria-label') ??
    (element instanceof HTMLInputElement ? element.value : element.textContent);
  return (text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL_LENGTH);
};

const areaOf = (element: Element): string => {
  const tag = element.closest(AREA_SELECTOR)?.localName;
  return (tag && AREAS[tag]) ?? NO_AREA;
};

const isDownload = (url: URL): boolean =>
  DOWNLOAD_EXTENSIONS.some((extension) =>
    url.pathname.toLowerCase().endsWith(extension),
  );

const describeLink = (
  link: HTMLAnchorElement,
  origin: string,
): { name: ClickEventName; label?: string; target?: string } => {
  const url = new URL(link.href);

  /*
   * A fixed label, not the link's text: that text is often the address itself,
   * and /privacy says an email click never sends it.
   */
  if (url.protocol === 'mailto:') {
    return { name: CLICK_EVENTS.email, label: CLICK_EVENTS.email };
  }

  /*
   * The query string is dropped from outbound URLs, where it can carry another
   * site's tokens, and kept nowhere else because no link here has one.
   */
  if (url.origin !== origin) {
    return {
      name: CLICK_EVENTS.outboundLink,
      target: `${url.origin}${url.pathname}`,
    };
  }

  return {
    name:
      link.hasAttribute('download') || isDownload(url)
        ? CLICK_EVENTS.download
        : CLICK_EVENTS.internalLink,
    target: `${url.pathname}${url.hash}`,
  };
};

const describeClick = (
  target: EventTarget | null,
  origin: string,
): { name: ClickEventName; data: ClickEventData } | null => {
  if (!(target instanceof Element)) return null;

  const element = target.closest(CLICKABLE);
  if (!element) return null;

  const data: ClickEventData = {
    label: labelOf(element),
    area: areaOf(element),
  };

  if (element instanceof HTMLAnchorElement) {
    const { name, label, target: destination } = describeLink(element, origin);
    const linkData = label === undefined ? data : { ...data, label };
    return {
      name,
      data:
        destination === undefined
          ? linkData
          : { ...linkData, target: destination },
    };
  }

  return { name: CLICK_EVENTS.button, data };
};

const send = (event: MouseEvent): void => {
  if (event.type === 'auxclick' && event.button !== MIDDLE_BUTTON) return;

  const click = describeClick(event.target, window.location.origin);
  if (click) window.umami?.track(click.name, click.data);
};

/*
 * Capture phase, so a component that stops propagation still gets counted.
 * `auxclick` is the middle-button click that opens a link in a new tab, which
 * `click` never receives.
 */
document.addEventListener('click', send, { capture: true, passive: true });
document.addEventListener('auxclick', send, { capture: true, passive: true });
