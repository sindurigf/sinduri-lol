/* Pure. Paths are in the hare's own drawing units, independent of the box. */
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
 * `tuck`: 0 planted, 1 folded at the top of the arc. The foot and the shadow
 * share FOOT_Y, or the hare hovers.
 */
const hindLeg = (ctx: CanvasRenderingContext2D, tuck: number): void => {
  ctx.beginPath();
  ctx.ellipse(-20, 1, 16, 14, 0.12, 0, Math.PI * 2);
  ctx.fill();
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
  ctx.fill();
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
  ctx.fill();
  ctx.stroke();
  ctx.restore();
};

interface HopFrame {
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
 * Signs that are easy to invert: pitch is negative cosine (nose up on the
 * rise), ears trail, and the front foot leads by 0.06 of a cycle.
 */
export const hopFrame = (
  cycle: number,
  sit: number,
  seconds: number,
): HopFrame => {
  const velocity = Math.cos(cycle * Math.PI);
  const land = Math.max(0, 1 - Math.min(cycle, 1 - cycle) * 9);
  const sitting = sit > 0.05;

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

const drawFarLegs = (ctx: CanvasRenderingContext2D, frame: HopFrame): void => {
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
};

const drawEars = (ctx: CanvasRenderingContext2D, frame: HopFrame): void => {
  const ears: readonly (readonly [number, number, number, number, number])[] = [
    [24, -27, frame.earFar, 5.2, 27],
    [26, -28, frame.earNear, 6, 31],
  ];
  for (const [ex, ey, angle, width, length] of ears) {
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(angle);
    earPath(ctx, length, width);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.quadraticCurveTo(width * 0.3, -length * 0.55, 0, -length * 0.82);
    ctx.stroke();
    ctx.restore();
  }
};

const drawBody = (
  ctx: CanvasRenderingContext2D,
  palette: HeroPalette,
): void => {
  ctx.fillStyle = palette.background;
  bodyPath(ctx);
  ctx.fill();
  bodyPath(ctx);
  ctx.stroke();

  /* Only the scut's outer arc is stroked, or its ring crosses the body. */
  ctx.beginPath();
  ctx.arc(-33, -9, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-33, -9, 6, Math.PI * 0.42, Math.PI * 1.72);
  ctx.stroke();
};

const drawFace = (
  ctx: CanvasRenderingContext2D,
  palette: HeroPalette,
): void => {
  ctx.fillStyle = palette.border;
  ctx.beginPath();
  ctx.arc(31, -20, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(45, -15, 1.5, 0, Math.PI * 2);
  ctx.fill();
};

/*
 * Every closed shape fills with the page colour before stroking, or limbs and
 * grass show through. Ink is `border` to match the field.
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
  ctx.strokeStyle = palette.border;
  ctx.fillStyle = palette.background;
  ctx.lineWidth = 2.1;

  drawFarLegs(ctx, frame);
  drawEars(ctx, frame);
  hindLeg(ctx, frame.tuckHind);
  foreLeg(ctx, frame.tuckFore);
  drawBody(ctx, palette);
  drawFace(ctx, palette);

  ctx.restore();
};
