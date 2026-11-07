import { expect, test, type Page } from './test';
import { gotoSettled } from './settle';

/**
 * SC 1.4.3 for the homepage name and stickers: the hare may hop past text but
 * never rests on it, so no frame the pause control can stop on puts it there,
 * and no meadow pixel lies under the name. Frames are pumped by hand, so page
 * time does not depend on the machine's speed.
 */
const HERO_ROUTE = '/';
const HERO_PAUSE_NAME = /pause the hero animation/i;
const HERO_PLAY_NAME = /play the hero animation/i;

/** `MAX_FRAME_RATE` in src/scripts/hero-field.ts. */
const FRAME_RATE = 30;

/** Frames run before each pause. At 844x390 the hare passes behind "Ridet" at frames 1180 and 1270. */
const PAUSE_AT_FRAMES = [150, 600, 1000, 1270, 2000] as const;

/** 844x390 is the window the hare crosses a sticker in; the others are a desktop and a phone. */
const CROSSING_VIEWPORT = { width: 844, height: 390 } as const;
const VIEWPORTS = [
  CROSSING_VIEWPORT,
  { width: 1440, height: 900 },
  { width: 375, height: 812 },
] as const;

/** Reduced motion draws one still frame; these add the other landscape phone. */
const STILL_VIEWPORTS = [...VIEWPORTS, { width: 667, height: 375 }] as const;

/** The near canvas is blurred by CSS; its ink spreads about twice the radius. */
const BLUR_REACH = 2;

interface HeroProbe {
  pumpFrames: (count: number) => void;
  rabbitOnly: HTMLCanvasElement | null;
  rabbitDrawn: boolean;
}

/**
 * Hand-pumped animation frames, and a copy of every rabbit draw on the middle
 * canvas onto a canvas of its own, so the rabbit's pixels are known exactly.
 */
const installProbe = (page: Page) =>
  page.addInitScript((frameRate) => {
    const probe = window as unknown as HeroProbe;
    const queue = new Map<number, FrameRequestCallback>();
    let nextId = 0;
    let now = 0;
    window.requestAnimationFrame = (callback) => {
      nextId += 1;
      queue.set(nextId, callback);
      return nextId;
    };
    window.cancelAnimationFrame = (id) => {
      queue.delete(id);
    };
    /* `start()` in motion-loop.ts reads it; the real clock would skip frames on a slow machine. */
    performance.now = () => now;
    /* Only the frame a pause lands on is checked, so the frames before it step without painting. */
    let painting = true;
    probe.pumpFrames = (count) => {
      for (let frame = 0; frame < count; frame += 1) {
        painting = frame === count - 1;
        now += 1000 / frameRate;
        const due = [...queue.entries()];
        for (const [id] of due) queue.delete(id);
        for (const [, callback] of due) callback(now);
      }
      painting = true;
    };
    const skipsPaint = (ctx: CanvasRenderingContext2D) =>
      !painting && ctx.canvas.classList.contains('hero-field-layer');
    const proto = CanvasRenderingContext2D.prototype;
    for (const name of ['fill', 'stroke', 'fillRect'] as const) {
      const paint = proto[name] as (...args: unknown[]) => void;
      Object.defineProperty(proto, name, {
        configurable: true,
        writable: true,
        value(this: CanvasRenderingContext2D, ...args: unknown[]) {
          if (!skipsPaint(this)) Reflect.apply(paint, this, args);
        },
      });
    }

    probe.rabbitOnly = null;
    probe.rabbitDrawn = false;
    const middle = () =>
      document.querySelectorAll<HTMLCanvasElement>(
        'canvas.hero-field-layer',
      )[1];
    const copyFor = (target: HTMLCanvasElement) => {
      probe.rabbitOnly ??= document.createElement('canvas');
      const copy = probe.rabbitOnly;
      if (copy.width !== target.width) copy.width = target.width;
      if (copy.height !== target.height) copy.height = target.height;
      return copy.getContext('2d')!;
    };

    const { clearRect, drawImage } = CanvasRenderingContext2D.prototype;
    CanvasRenderingContext2D.prototype.clearRect = function (x, y, w, h) {
      if (skipsPaint(this)) return;
      if (this.canvas === middle()) {
        const copy = copyFor(this.canvas);
        copy.resetTransform();
        clearRect.call(copy, 0, 0, copy.canvas.width, copy.canvas.height);
      }
      clearRect.call(this, x, y, w, h);
    };
    /* The rabbit is the one image the middle layer draws; its shadow and stems are paths. */
    CanvasRenderingContext2D.prototype.drawImage = function (
      this: CanvasRenderingContext2D,
      ...args: Parameters<CanvasRenderingContext2D['drawImage']>
    ) {
      if (skipsPaint(this)) return;
      if (this.canvas === middle() && args[0] instanceof HTMLCanvasElement) {
        const copy = copyFor(this.canvas);
        copy.setTransform(this.getTransform());
        Reflect.apply(drawImage, copy, args);
        probe.rabbitDrawn = true;
      }
      Reflect.apply(drawImage, this, args);
    } as CanvasRenderingContext2D['drawImage'];
  }, FRAME_RATE);

const openHero = async (
  page: Page,
  viewport: { width: number; height: number },
) => {
  await installProbe(page);
  await page.setViewportSize(viewport);
  await gotoSettled(page, HERO_ROUTE);
  await page.waitForFunction(
    () => (window as unknown as HeroProbe).rabbitDrawn,
    undefined,
    { timeout: 10_000 },
  );
};

interface Clearance {
  /** Text the rabbit is drawn over and that does not hide it. */
  onText: string[];
  /** Stickers the rabbit is behind, each on top and opaque there. */
  behindSticker: string[];
  /** Canvas layers with ink under a line of the name. */
  underName: string[];
}

/** Where this frame's rabbit and meadow fall against the name and the visible stickers. */
const clearance = (page: Page): Promise<Clearance> =>
  page.evaluate((blurReach) => {
    const probe = window as unknown as HeroProbe;
    const layers = [
      ...document.querySelectorAll<HTMLCanvasElement>(
        'canvas.hero-field-layer',
      ),
    ];
    const middle = layers[1];
    const rabbit = probe.rabbitOnly?.getContext('2d');
    if (!middle || !rabbit)
      throw new Error('the hero has no middle layer or no rabbit drawn.');
    const box = middle.getBoundingClientRect();
    const scale = middle.width / box.width;
    const marks = document
      .querySelector('.hero-marks')
      ?.getBoundingClientRect();
    if (!marks) throw new Error('the hero has no .hero-marks.');

    type Rect = { left: number; top: number; right: number; bottom: number };
    const pixelsIn = (rect: Rect, pad = 0) => {
      const x0 = Math.max(0, Math.floor((rect.left - pad - box.left) * scale));
      const y0 = Math.max(0, Math.floor((rect.top - pad - box.top) * scale));
      const x1 = Math.min(
        middle.width,
        Math.ceil((rect.right + pad - box.left) * scale),
      );
      const y1 = Math.min(
        middle.height,
        Math.ceil((rect.bottom + pad - box.top) * scale),
      );
      return x1 > x0 && y1 > y0 ? { x0, y0, w: x1 - x0, h: y1 - y0 } : null;
    };
    const inkPoints = (ctx: CanvasRenderingContext2D, rect: Rect, pad = 0) => {
      const area = pixelsIn(rect, pad);
      if (!area) return [];
      const { data } = ctx.getImageData(area.x0, area.y0, area.w, area.h);
      const points: { x: number; y: number }[] = [];
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] === 0) continue;
        const pixel = (i - 3) / 4;
        points.push({
          x: box.left + (area.x0 + (pixel % area.w) + 0.5) / scale,
          y: box.top + (area.y0 + Math.floor(pixel / area.w) + 0.5) / scale,
        });
      }
      return points;
    };

    const result: Clearance = { onText: [], behindSticker: [], underName: [] };
    const nameLines = [
      ...document.querySelectorAll<HTMLElement>('.hero-plate h1 > span'),
    ];
    const blur = Number.parseFloat(
      /blur\(([\d.]+)px\)/.exec(layers[2]?.style.filter ?? '')?.[1] ?? '0',
    );
    for (const line of nameLines) {
      const word = line.textContent?.trim() ?? '';
      const rect = line.getBoundingClientRect();
      if (inkPoints(rabbit, rect).length > 0) result.onText.push(word);
      layers.forEach((layer, index) => {
        const pad = index === layers.length - 1 ? blurReach * blur : 0;
        if (inkPoints(layer.getContext('2d')!, rect, pad).length > 0)
          result.underName.push(`${word} over layer ${index}`);
      });
    }

    /* Hit-testing follows paint order once the canvases take pointer events. */
    for (const layer of layers) layer.style.pointerEvents = 'auto';
    for (const sticker of document.querySelectorAll<HTMLElement>(
      '.hero-sticker',
    )) {
      const word = sticker.textContent?.trim() ?? '';
      const own = sticker.getBoundingClientRect();
      const shown = {
        left: Math.max(own.left, marks.left),
        top: Math.max(own.top, marks.top),
        right: Math.min(own.right, marks.right),
        bottom: Math.min(own.bottom, marks.bottom),
      };
      if (shown.right <= shown.left || shown.bottom <= shown.top) continue;
      const points = inkPoints(rabbit, shown);
      if (points.length === 0) continue;
      const style = getComputedStyle(sticker);
      const opaque =
        style.opacity === '1' &&
        !/rgba\([^)]*,\s*0?\.\d+\)/.test(style.backgroundColor);
      /* The box of a tilted sticker has corners the sticker does not cover. */
      const stacks = points
        .map(({ x, y }) => document.elementsFromPoint(x, y))
        .filter((stack) => stack.some((el) => sticker.contains(el)));
      if (stacks.length === 0) continue;
      const hidden = stacks.every(
        (stack) =>
          stack.findIndex((el) => sticker.contains(el)) < stack.indexOf(middle),
      );
      if (opaque && hidden) result.behindSticker.push(word);
      else result.onText.push(word);
    }
    for (const layer of layers) layer.style.pointerEvents = '';
    return result;
  }, BLUR_REACH);

test.describe('the homepage hare and meadow keep clear of text (SC 1.4.3)', () => {
  for (const viewport of VIEWPORTS)
    test(`no paused frame rests the hare on text at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      test.slow();
      await openHero(page, viewport);
      const field = page.locator('.hero-field');
      let pumped = 0;
      let crossings = 0;
      for (const frame of PAUSE_AT_FRAMES) {
        await page.evaluate(
          (count) => (window as unknown as HeroProbe).pumpFrames(count),
          frame - pumped,
        );
        pumped = frame;
        await page.getByRole('button', { name: HERO_PAUSE_NAME }).click();
        await expect(field).toHaveAttribute('data-hero-motion', 'paused');

        const { onText, behindSticker, underName } = await clearance(page);
        expect(
          onText,
          `paused at frame ${frame}, the hare is drawn over text it does not sit behind; only behind an opaque sticker may it overlap one.`,
        ).toEqual([]);
        expect(
          underName,
          `paused at frame ${frame}, the meadow paints under the name, so its contrast is no longer the gold's.`,
        ).toEqual([]);
        crossings += behindSticker.length;

        await page.getByRole('button', { name: HERO_PLAY_NAME }).click();
        await expect(field).toHaveAttribute('data-hero-motion', 'running');
      }
      if (viewport === CROSSING_VIEWPORT)
        expect(
          crossings,
          'no paused frame falls where the hare passes behind a sticker; PAUSE_AT_FRAMES no longer covers the crossing.',
        ).toBeGreaterThan(0);
    });

  for (const viewport of STILL_VIEWPORTS)
    test(`the reduced-motion frame keeps the hare off text at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openHero(page, viewport);
      const { onText, behindSticker, underName } = await clearance(page);
      expect(
        [...onText, ...behindSticker],
        'the reduced-motion frame draws the hare over the name or a sticker.',
      ).toEqual([]);
      expect(
        underName,
        'the reduced-motion frame paints the meadow under the name.',
      ).toEqual([]);
    });
});
