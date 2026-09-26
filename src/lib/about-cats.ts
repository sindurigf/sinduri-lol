/*
 * Behaviour for the About cats: which move each cat plays, where on its card
 * it plays it, when they nap, and the one that watches the pointer.
 * AboutCats.vue owns the DOM, the frame loop and the SC 2.2.2 control.
 */
import {
  MOVES,
  HELA_WEIGHTS,
  WEIGHTS,
  WALK_SPEED,
  clonePose,
  duration,
  extent,
  gait,
  mixPose,
  pose,
  sample,
  walkMove,
  type Move,
  type MoveName,
  type Pose,
} from './about-cats-moves';
import {
  createProp,
  renderCat,
  settleTail,
  type CatRig,
  type PropRig,
} from './about-cats-rig';

/** Play time after waking before they nap; pointing at a cat restarts it. */
export const NAP_AFTER_MS = 20_000;

/** Distance from each card end the cat's origin keeps. */
const TRACK_MARGIN = 40;
/** Room at the right end for the pause control. */
const CONTROL_ROOM = 48;
const TRAVEL_CHANCE = 0.2;
const TRAVEL_MIN = 40;
const TRAVEL_MAX = 180;
const POINTER_IDLE_MS = 4000;
const FOLLOW_FAR = 220;
const FOLLOW_NEAR = 110;
const FACE_DEADBAND = 20;
const WATCH_EASE = 0.12;
/** Below this body height the watcher is standing, so it keeps walking to the near mark. */
const STANDING_HEIGHT = 25;
const TILT_GAIN = 20;
const MAX_TILT = 25;
const TURN_EASE = 0.15;
const BLINK_EVERY_MS = [2500, 5000] as const;
/** The pointer-watcher's walk, per 60fps frame at WALK_SPEED. */
const WATCH_STEP = WALK_SPEED / 60;

/** One cat as the page passes it in: names, roles and the dialog photo. */
export interface CatInfo {
  id: CatRig['id'];
  name: string;
  role: string;
  about: string;
  photo: {
    src: string;
    srcset: string;
    width: number;
    height: number;
    alt: string;
  };
}

export interface CatSpot {
  id: CatRig['id'];
  rig: CatRig;
  props: SVGGElement;
  /** Starting place along the track, 0 to 1. */
  start: number;
  /** Starting direction: 1 faces right. */
  facing: 1 | -1;
}

interface Playing {
  move: Move;
  from: Pose;
  t0: number;
  length: number;
  origin: number;
  dir: number;
  prop?: PropRig;
  then?: () => void;
}

interface CatState extends CatSpot {
  width: number;
  groundY: number;
  min: number;
  max: number;
  pose: Pose;
  playing?: Playing;
  asleep: boolean;
  nextBlink: number;
  blinkUntil: number;
  /** The pointer-watcher's pose before its walk cycle is added. */
  rest?: Pose;
}

const rand = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);
const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

const pickWeighted = (weights: Partial<Record<MoveName, number>>): MoveName => {
  const entries = Object.entries(weights) as [MoveName, number][];
  let roll = Math.random() * entries.reduce((sum, [, w]) => sum + w, 0);
  for (const [name, w] of entries) {
    roll -= w;
    if (roll <= 0) return name;
  }
  return entries[0][0];
};

export interface Colony {
  layout: (
    sizes: Map<CatSpot['id'], { width: number; height: number }>,
  ) => void;
  frame: (now: number) => boolean;
  wake: (now: number) => void;
  pause: () => void;
  still: () => void;
  pointer: (
    x: number,
    y: number,
    now: number,
    rects: Map<CatSpot['id'], DOMRect>,
  ) => void;
  watcher: () => CatSpot['id'] | '';
}

export const createColony = (spots: CatSpot[]): Colony => {
  const cats: CatState[] = spots.map((spot) => ({
    ...spot,
    width: 0,
    groundY: 0,
    min: 0,
    max: 0,
    pose: pose('sit', { face: spot.facing }),
    asleep: false,
    nextBlink: 0,
    blinkUntil: 0,
  }));
  let napAt = 0;
  let awake = false;
  let watcherId: CatSpot['id'] | '' = '';
  const pointerAt = new Map<CatSpot['id'], { x: number; y: number }>();
  let pointerTime = -Infinity;

  const draw = (cat: CatState, now: number): void => {
    const p = clonePose(cat.pose);
    if (now < cat.blinkUntil) p.eyes = 0;
    renderCat(cat.rig, p, now, p.x, cat.groundY);
  };

  const endMove = (cat: CatState): void => {
    const playing = cat.playing;
    if (!playing) return;
    playing.prop?.node.remove();
    cat.playing = undefined;
    cat.pose.face = Math.sign(cat.pose.face) || 1;
    playing.then?.();
  };

  const play = (
    cat: CatState,
    move: Move,
    now: number,
    dir: number,
    then?: () => void,
  ): void => {
    const from = clonePose(cat.pose);
    const origin = from.x;
    from.x = 0;
    from.face = from.face * dir;
    cat.rest = undefined;
    const prop = move.prop ? createProp(cat.props, move.prop) : undefined;
    cat.playing = {
      move,
      from,
      t0: now,
      length: duration(move),
      origin,
      dir,
      prop,
      then,
    };
  };

  const fits = (cat: CatState, move: Move, dir: number): boolean => {
    const [back, forward] = extent(move);
    const a = cat.pose.x + dir * back;
    const b = cat.pose.x + dir * forward;
    return Math.min(a, b) >= cat.min && Math.max(a, b) <= cat.max;
  };

  const travel = (
    cat: CatState,
    to: number,
    now: number,
    then: () => void,
  ): void => {
    const target = clamp(to, cat.min, cat.max);
    const distance = target - cat.pose.x;
    if (Math.abs(distance) < 1) {
      then();
      return;
    }
    play(cat, walkMove(Math.abs(distance)), now, Math.sign(distance), then);
  };

  const next = (cat: CatState, now: number): void => {
    if (!awake) return;
    if (now >= napAt) {
      play(cat, MOVES.sleep(), now, Math.sign(cat.pose.face) || 1, () => {
        cat.asleep = true;
      });
      return;
    }
    if (cat.id === watcherId) return;
    if (Math.random() < TRAVEL_CHANCE) {
      const to =
        cat.pose.x +
        rand(TRAVEL_MIN, TRAVEL_MAX) * (Math.random() < 0.5 ? -1 : 1);
      travel(cat, to, now, () => next(cat, performance.now()));
      return;
    }
    const name = pickWeighted(cat.id === 'hela' ? HELA_WEIGHTS : WEIGHTS);
    const move = MOVES[name]();
    const facing = Math.sign(cat.pose.face) || 1;
    if (move.edge) {
      const end =
        cat.pose.x - cat.min < cat.max - cat.pose.x ? cat.min : cat.max;
      travel(cat, end, now, () =>
        play(cat, move, performance.now(), end === cat.min ? -1 : 1, () =>
          next(cat, performance.now()),
        ),
      );
      return;
    }
    const dir = fits(cat, move, facing)
      ? facing
      : fits(cat, move, -facing)
        ? -facing
        : 0;
    if (dir === 0) {
      travel(cat, (cat.min + cat.max) / 2, now, () =>
        next(cat, performance.now()),
      );
      return;
    }
    play(cat, move, now, dir, () => next(cat, performance.now()));
  };

  const watch = (cat: CatState, now: number): void => {
    const target = pointerAt.get(cat.id);
    const base = cat.rest ?? cat.pose;
    const idle = now - pointerTime > POINTER_IDLE_MS || !target;
    let calm: Pose;
    let moving = false;
    if (idle) {
      calm = mixPose(
        base,
        pose('sit', {
          x: base.x,
          face: base.face,
          hr: 8 * Math.sin(now / 1800),
        }),
        WATCH_EASE,
      );
    } else {
      const dx = target.x - base.x;
      moving =
        Math.abs(dx) > FOLLOW_FAR ||
        (base.by < STANDING_HEIGHT && Math.abs(dx) > FOLLOW_NEAR);
      const want =
        Math.abs(dx) > FACE_DEADBAND
          ? Math.sign(dx)
          : Math.sign(base.face) || 1;
      const x = moving
        ? clamp(base.x + Math.sign(dx) * WATCH_STEP, cat.min, cat.max)
        : base.x;
      const tilt = clamp(
        -Math.atan2(cat.groundY - target.y, Math.abs(dx) + 1) * TILT_GAIN,
        -MAX_TILT,
        0,
      );
      calm = mixPose(
        base,
        pose(moving ? 'stand' : 'sit', { x, hr: moving ? 0 : tilt }),
        WATCH_EASE,
      );
      calm.x = x;
      calm.face = base.face + (want - base.face) * TURN_EASE;
    }
    cat.rest = calm;
    const shown = clonePose(calm);
    if (moving) gait(shown, shown.x);
    cat.pose = shown;
  };

  const frame = (now: number): boolean => {
    let busy = false;
    for (const cat of cats) {
      const playing = cat.playing;
      if (playing) {
        const t = Math.min(now - playing.t0, playing.length);
        const p = sample(playing.move.steps, playing.from, t);
        for (const mod of playing.move.mods) {
          if (t >= mod.from && t <= mod.to)
            mod.apply(
              p,
              t - mod.from,
              (t - mod.from) / (mod.to - mod.from || 1),
            );
        }
        p.x = playing.origin + playing.dir * p.x;
        p.face *= playing.dir;
        cat.pose = p;
        if (playing.prop && playing.move.propAt) {
          const s = playing.move.propAt(t);
          playing.prop.draw(
            { ...s, x: playing.origin + playing.dir * s.x },
            now,
          );
        }
        busy = true;
        if (t >= playing.length) endMove(cat);
      } else if (awake && cat.id === watcherId) {
        if (now >= napAt) next(cat, now);
        else watch(cat, now);
        busy = true;
      } else if (awake && !cat.asleep) {
        next(cat, now);
        busy = true;
      }
      if (awake && !cat.asleep && now > cat.nextBlink) {
        cat.blinkUntil = now + 160;
        cat.nextBlink = now + rand(...BLINK_EVERY_MS);
      }
      draw(cat, now);
    }
    if (awake && cats.every((c) => c.asleep && !c.playing)) {
      awake = false;
      watcherId = '';
    }
    return (
      busy || cats.some((c) => c.rig.tailSpeed.some((v) => Math.abs(v) > 0.02))
    );
  };

  return {
    layout: (sizes) => {
      for (const cat of cats) {
        const size = sizes.get(cat.id);
        if (!size) continue;
        const first = cat.width === 0;
        cat.width = size.width;
        cat.groundY = size.height;
        cat.props.setAttribute('transform', `translate(0 ${size.height})`);
        cat.min = TRACK_MARGIN;
        cat.max = Math.max(cat.min, size.width - TRACK_MARGIN - CONTROL_ROOM);
        if (first) cat.pose.x = cat.min + (cat.max - cat.min) * cat.start;
        cat.pose.x = clamp(cat.pose.x, cat.min, cat.max);
        settleTail(cat.rig);
        draw(cat, performance.now());
      }
    },
    frame,
    wake: (now) => {
      napAt = now + NAP_AFTER_MS;
      if (awake) return;
      awake = true;
      watcherId = cats[Math.floor(Math.random() * cats.length)].id;
      for (const cat of cats) {
        cat.nextBlink = now + rand(...BLINK_EVERY_MS);
        if (cat.asleep) {
          cat.asleep = false;
          play(cat, MOVES.wake(), now, Math.sign(cat.pose.face) || 1);
        }
      }
    },
    pause: () => {
      awake = false;
      watcherId = '';
      const now = performance.now();
      for (const cat of cats) {
        if (cat.playing) {
          cat.playing.prop?.node.remove();
          cat.playing = undefined;
        }
        cat.pose = pose('sleep', {
          x: cat.pose.x,
          face: Math.sign(cat.pose.face) || 1,
        });
        cat.asleep = true;
        settleTail(cat.rig);
        draw(cat, now);
      }
    },
    still: () => {
      awake = false;
      const now = performance.now();
      for (const cat of cats) {
        cat.playing?.prop?.node.remove();
        cat.playing = undefined;
        cat.pose = pose('sit', { x: cat.pose.x, face: cat.facing });
        cat.asleep = false;
        settleTail(cat.rig);
        draw(cat, now);
      }
    },
    pointer: (x, y, now, rects) => {
      pointerTime = now;
      for (const [id, rect] of rects)
        pointerAt.set(id, { x: x - rect.left, y: y - rect.top });
    },
    watcher: () => watcherId,
  };
};
