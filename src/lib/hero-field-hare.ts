/*
 * The hare: its body paths, its hop cycle, and the one function that draws it.
 *
 * Everything here is pure. The paths are in the hare's own drawing units,
 * `hopFrame` derives a pose from the cycle, and `drawHare` takes the palette as
 * an argument rather than closing over it, so nothing in this file knows the
 * size of the box it lands in.
 */
import { FOOT_Y } from './hero-field-scene';
import type { HeroPalette } from './hero-field-scene';

const bodyPath = (ctx: CanvasRenderingContext2D): void => {
  ctx.beginPath();
  ctx.moveTo(46, -16);
  ctx.bezierCurveTo(43, -24, 35, -29, 27, -28);
  ctx.bezierCurveTo(19, -27, 13, -22, 7, -21);
  ctx.bezierCurveTo(-6, -22, -19, -29, -28, -22);
  ctx.bezierCurveTo(-35, -17, -38, -5, -35, 4);
  ctx.bezierCurveTo(-32, 11, -25, 15, -15, 16);
  ctx.bezierCurveTo(-3, 18, 10, 16, 20, 11);
  ctx.bezierCurveTo(28, 7, 35, 1, 41, -4);
  ctx.bezierCurveTo(45, -8, 48, -12, 46, -16);
  ctx.closePath();
};

const earPath = (
  ctx: CanvasRenderingContext2D,
  length: number,
  width: number,
): void => {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(
    -width,
    -length * 0.34,
    -width * 0.78,
    -length * 0.84,
    0,
    -length,
  );
  ctx.bezierCurveTo(width * 0.78, -length * 0.84, width, -length * 0.34, 0, 0);
  ctx.closePath();
};

/*
 * The hind leg, with `tuck` running 0 (extended, foot planted) to 1 (folded
 * under the body at the top of the arc). The foot lands at FOOT_Y, which is
 * also where the shadow goes; they were six units apart for a while and the
 * hare hovered.
 */
const hindLeg = (ctx: CanvasRenderingContext2D, tuck: number): void => {
  ctx.beginPath();
  ctx.ellipse(-20, 1, 16, 14, 0.12, 0, Math.PI * 2);
  ctx.stroke();

  const x = -26 + tuck * 12;
  const y = FOOT_Y - tuck * 8;
  ctx.beginPath();
  ctx.moveTo(-28, 5);
  ctx.quadraticCurveTo(-31 + tuck * 8, 12 - tuck * 3, x - 2, y - 4);
  ctx.stroke();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.1 + tuck * 0.95);
  ctx.beginPath();
  ctx.ellipse(2, 0, 15 - tuck * 3, 4.4, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};

const foreLeg = (ctx: CanvasRenderingContext2D, tuck: number): void => {
  const x = 22 - tuck * 7;
  const y = FOOT_Y - tuck * 12;
  ctx.beginPath();
  ctx.moveTo(17, 8);
  ctx.quadraticCurveTo(21 - tuck * 3, 14 - tuck * 5, x, y - 3);
  ctx.stroke();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.08 - tuck * 0.7);
  ctx.beginPath();
  ctx.ellipse(1, 0, 8.5 - tuck * 1.5, 3.6, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};

export interface HopFrame {
  /** 0 on the ground, 1 at the top of the arc. */
  readonly air: number;
  readonly pitch: number;
  readonly tuckFore: number;
  readonly tuckHind: number;
  readonly squash: number;
  readonly earNear: number;
  readonly earFar: number;
  readonly sit: number;
}

/*
 * One hop, and the four signs that are easy to get backwards.
 *
 * The pitch is NEGATIVE cosine, so the animal noses up as it rises; the
 * other sign dives off the ground on take-off. The ears TRAIL for the same
 * reason, swinging back on the rise, which is the opposite of a naive
 * `+velocity`. The front foot tucks 0.06 of a cycle ahead of the back one
 * and lands first, because both landing together reads as a belly-flop.
 * `squash` is compression on landing only, from `land`, which spikes near
 * either end of the cycle rather than across it.
 */
export const hopFrame = (
  cycle: number,
  sit: number,
  seconds: number,
): HopFrame => {
  const velocity = Math.cos(cycle * Math.PI);
  const land = Math.max(0, 1 - Math.min(cycle, 1 - cycle) * 9);
  const sitting = sit > 0.05;

  /* An occasional ear flick, and a constant one while sitting. */
  let twitch =
    Math.sin(seconds * 2.3 + 1.7) > 0.86 ? Math.sin(seconds * 15) * 0.18 : 0;
  if (sit > 0.3) twitch += Math.sin(seconds * 2.7) * 0.22;

  return {
    air: sitting ? 0 : Math.sin(cycle * Math.PI),
    pitch: sitting ? 0 : -velocity * 0.28,
    tuckFore: sitting
      ? 0
      : Math.pow(
          Math.max(0, Math.sin(Math.min(1, cycle + 0.06) * Math.PI)),
          0.8,
        ),
    tuckHind: sitting
      ? 0
      : Math.pow(
          Math.max(0, Math.sin(Math.max(0, cycle - 0.1) * Math.PI)),
          0.7,
        ),
    squash: 1 - land * 0.14,
    earNear: -0.92 - velocity * 0.32 - twitch,
    earFar: -1.2 - velocity * 0.26 + twitch,
    sit,
  };
};

/*
 * Draw order matters more than any single line here. The far-side legs go
 * down first at low opacity, then the ears, then the near legs, and only
 * then is the body FILLED with the page colour before its outline is
 * stroked. Without that fill every limb shows through the torso.
 */
export const drawHare = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  frame: HopFrame,
  palette: HeroPalette,
): void => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(frame.pitch + frame.sit * -0.5);
  ctx.scale(scale, scale * frame.squash);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = palette.text;
  ctx.lineWidth = 2.1;

  ctx.globalAlpha = 0.45;
  ctx.save();
  ctx.translate(-4, 0);
  hindLeg(ctx, frame.tuckHind);
  ctx.restore();
  ctx.save();
  ctx.translate(-5, 0);
  foreLeg(ctx, frame.tuckFore);
  ctx.restore();
  ctx.globalAlpha = 1;

  const ears: readonly (readonly [number, number, number, number, number])[] = [
    [24, -27, frame.earFar, 5.2, 27],
    [26, -28, frame.earNear, 6, 31],
  ];
  for (const [ex, ey, angle, width, length] of ears) {
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(angle);
    earPath(ctx, length, width);
    ctx.stroke();
    /* The inner fold, which is what stops an ear reading as a leaf. */
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.quadraticCurveTo(width * 0.3, -length * 0.55, 0, -length * 0.82);
    ctx.stroke();
    ctx.restore();
  }

  hindLeg(ctx, frame.tuckHind);
  foreLeg(ctx, frame.tuckFore);

  ctx.fillStyle = palette.background;
  bodyPath(ctx);
  ctx.fill();
  bodyPath(ctx);
  ctx.stroke();

  /* Scut, knocked out of the body the same way. */
  ctx.beginPath();
  ctx.arc(-33, -9, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = palette.text;
  ctx.beginPath();
  ctx.arc(31, -20, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(45, -15, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};
