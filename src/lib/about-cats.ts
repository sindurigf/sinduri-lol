/*
 * Behaviour for the About cats: which move each cat plays, where on its card
 * it plays it, when they nap, and the one that watches the pointer.
 * AboutCats.vue owns the DOM, the frame loop and the dialog.
 */
import {
  MOVES,
  HELA_WEIGHTS,
  WEIGHTS,
  clonePose,
  duration,
  moveExtent,
  mixPose,
  pose,
  poseAt,
  withTurn,
  withApproach,
  moveToPlay,
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

/** A still pause after each move, in ms: cats alternate bursts and stillness. */
const PAUSE_MS = [1000, 3000] as const;
/** What a frame did for a cat: drew it, left it settled, or held it in a pause. */
type StepResult = 'draw' | 'still' | 'rest';

/** On-screen play time after waking before a cat naps. */
export const NAP_AFTER_MS = 20_000;

/** Distance from each card end the cat's origin keeps. */
export const TRACK_MARGIN = 40;
/** Room at the right end for the sleep control. */
export const CONTROL_ROOM = 48;
/** Chance a cat moves along its band, by one leap, instead of playing where it is. */
const LEAP_CHANCE = 0.15;
/* Ways to get about, one at a time and weighted; there is no walking. */
const LEAPS: Partial<Record<MoveName, number>> = {
  bigJump: 3,
  pounce: 3,
  stalk: 1,
};
/** Near enough to the band's left end to knock a cup off it, counted to where it stands to push. */
const EDGE_NEAR = 110;
/** Where a cat stands from the card's edge to push the cup: the cup ends past the edge. */
export const CUP_EDGE = 32;
/** A pointer that has not moved for this long no longer draws a cat's eye. */
const POINTER_IDLE_MS = 4000;
const FACE_DEADBAND = 20;
const WATCH_EASE = 0.12;
const TILT_GAIN = 20;
const MAX_TILT = 25;
const BLINK_EVERY_MS = [2500, 5000] as const;
const BLINK_MS = 160;
/** The eases are per 60fps frame; other rates scale to it. */
const FRAME_MS = 1000 / 60;
/** Longest gap one frame may cover, so a stalled tab does not jump the watcher. */
const MAX_FRAMES_PER_STEP = 6;
/** A held cat has settled once no pose value moves more than this per frame. */
const SETTLED = 0.01;
/** Tail segment speed below which the tail counts as at rest. */
const TAIL_REST = 0.02;

/** One cat as the page passes it in: names, roles and the dialog photo. */
export interface CatInfo {
  id: CatRig['id'];
  name: string;
  role: string;
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
  /** Props drawn over the cat, such as a box's front. */
  propsFront: SVGGElement;
  /** Starting place along the track, 0 to 1. */
  start: number;
  /** Starting direction: 1 faces right. */
  facing: 1 | -1;
}

/** Why a cat holds still: pointed at, keyboard-focused, or its dialog is open. */
export type Hold = 'pointer' | 'focus' | 'card';

export type CatMood = 'playing' | 'holding' | 'asleep';

interface Playing {
  move: Move;
  from: Pose;
  t0: number;
  length: number;
  origin: number;
  dir: number;
  prop?: PropRig;
  /** Lying down and getting up play out even while the cat is held. */
  settle: boolean;
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
  napAt: number;
  holds: Set<Hold>;
  mood: CatMood;
  /** When its band left the screen; it is not stepped and its play clock stops meanwhile. */
  hiddenAt?: number;
  nextBlink: number;
  blinkUntil: number;
  /** No new move before this; a nap still starts at once. */
  restUntil: number;
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

const poseGap = (a: Pose, b: Pose): number =>
  Math.max(
    ...(Object.keys(a) as (keyof Pose)[]).flatMap((key) => {
      const u = a[key];
      const v = b[key];
      return Array.isArray(u) && Array.isArray(v)
        ? [Math.abs(u[0] - v[0]), Math.abs(u[1] - v[1])]
        : [Math.abs(Number(u) - Number(v))];
    }),
  );

export interface Colony {
  layout: (
    sizes: Map<CatSpot['id'], { width: number; height: number }>,
  ) => void;
  frame: (now: number) => boolean;
  /** Starts a cat's play clock the first time its band is on screen, and stops it while off. */
  visible: (id: CatSpot['id'], on: boolean, now: number) => void;
  /** Its sleep control: lies down now, then sleeps until woken. */
  nap: (id: CatSpot['id']) => void;
  wake: (id: CatSpot['id'], now: number) => void;
  hold: (id: CatSpot['id'], reason: Hold, on: boolean) => void;
  /** Reduced motion: drops every move, keeps each cat awake or asleep, and stops its clock. */
  still: () => void;
  /** The loop starts again after idling, so the first frame covers no time. */
  resume: (now: number) => void;
  pointer: (
    x: number,
    y: number,
    now: number,
    rects: Map<CatSpot['id'], DOMRect>,
  ) => void;
  /** Whether any cat on screen is awake to see the pointer. */
  watching: () => boolean;
}

/** Whether a move of this extent, played from `x` heading `dir`, keeps the cat within [min, max]. */
export const fitsTrack = (
  x: number,
  [back, forward]: readonly [number, number],
  dir: number,
  min: number,
  max: number,
): boolean => {
  const a = x + dir * back;
  const b = x + dir * forward;
  return Math.min(a, b) >= min && Math.max(a, b) <= max;
};

export const createColony = (
  spots: CatSpot[],
  onMoodChange: (id: CatSpot['id'], mood: CatMood) => void,
): Colony => {
  const cats: CatState[] = spots.map((spot) => ({
    ...spot,
    width: 0,
    groundY: 0,
    min: 0,
    max: 0,
    pose: pose('sit', { face: spot.facing }),
    asleep: false,
    napAt: Infinity,
    holds: new Set<Hold>(),
    mood: 'playing' as CatMood,
    hiddenAt: 0,
    nextBlink: 0,
    blinkUntil: 0,
    restUntil: 0,
  }));
  const watcherId = cats[Math.floor(Math.random() * cats.length)]?.id ?? '';
  const pointerAt = new Map<CatSpot['id'], { x: number; y: number }>();
  let pointerTime = -Infinity;
  let lastFrame = -Infinity;

  const find = (id: CatSpot['id']): CatState | undefined =>
    cats.find((cat) => cat.id === id);

  const updateMood = (cat: CatState): void => {
    const mood: CatMood = cat.asleep
      ? 'asleep'
      : cat.holds.size > 0
        ? 'holding'
        : 'playing';
    if (mood === cat.mood) return;
    cat.mood = mood;
    onMoodChange(cat.id, mood);
  };

  const setAsleep = (cat: CatState, asleep: boolean): void => {
    cat.asleep = asleep;
    updateMood(cat);
  };

  const draw = (cat: CatState, now: number): void => {
    const p = clonePose(cat.pose);
    if (now < cat.blinkUntil) p.eyes = 0;
    renderCat(cat.rig, p, now, p.x, cat.groundY);
  };

  const drop = (cat: CatState): void => {
    cat.playing?.prop?.remove();
    cat.playing = undefined;
    cat.pose.face = Math.sign(cat.pose.face) || 1;
  };

  const endMove = (cat: CatState): void => {
    const playing = cat.playing;
    if (!playing) return;
    drop(cat);
    if (!playing.settle) cat.restUntil = performance.now() + rand(...PAUSE_MS);
    playing.then?.();
  };

  const play = (
    cat: CatState,
    move: Move,
    now: number,
    dir: number,
    then?: () => void,
    settle = false,
  ): void => {
    const from = clonePose(cat.pose);
    const origin = from.x;
    from.x = 0;
    from.face = from.face * dir;
    if (from.face < 0) move = withTurn(move, from);
    const prop = move.prop
      ? createProp(cat.props, cat.propsFront, move.prop)
      : undefined;
    cat.playing = {
      move,
      from,
      t0: now,
      length: duration(move),
      origin,
      dir,
      prop,
      settle,
      then,
    };
  };

  /* Asleep from the first frame, so the control offers to wake it while it lies down. */
  const lieDown = (cat: CatState, now: number): void => {
    setAsleep(cat, true);
    play(
      cat,
      MOVES.sleep(),
      now,
      Math.sign(cat.pose.face) || 1,
      undefined,
      true,
    );
  };

  const fits = (cat: CatState, name: MoveName, dir: number): boolean =>
    fitsTrack(cat.pose.x, moveExtent(name), dir, cat.min, cat.max);

  /** One leap along the band, ahead if it fits, else back; false if neither fits. */
  const leap = (cat: CatState, now: number): boolean => {
    const name = pickWeighted(LEAPS);
    const facing = Math.sign(cat.pose.face) || 1;
    const dir = fits(cat, name, facing)
      ? facing
      : fits(cat, name, -facing)
        ? -facing
        : 0;
    if (dir === 0) return false;
    play(cat, moveToPlay(name), now, dir, () => next(cat, performance.now()));
    return true;
  };

  const next = (cat: CatState, now: number): void => {
    if (cat.asleep || cat.holds.has('card')) return;
    if (now >= cat.napAt) {
      lieDown(cat, now);
      return;
    }
    if (cat.holds.size > 0 || now < cat.restUntil) return;
    if (Math.random() < LEAP_CHANCE && leap(cat, now)) return;
    const name = pickWeighted(cat.id === 'hela' ? HELA_WEIGHTS : WEIGHTS);
    const move = moveToPlay(name);
    const facing = Math.sign(cat.pose.face) || 1;
    if (move.edge) {
      /*
       * Left end only, near it: it creeps to the card's edge, past its own track,
       * so the cup goes over. The right end is the sleep control's corner.
       */
      const gap = cat.pose.x - CUP_EDGE;
      if (gap > EDGE_NEAR) return;
      play(cat, withApproach(move, Math.max(0, gap)), now, -1, () =>
        next(cat, performance.now()),
      );
      return;
    }
    const dir = fits(cat, name, facing)
      ? facing
      : fits(cat, name, -facing)
        ? -facing
        : 0;
    if (dir === 0) {
      leap(cat, now);
      return;
    }
    play(cat, move, now, dir, () => next(cat, performance.now()));
  };

  /** Where the pointer is from this cat, while it is still moving. */
  const pointerFor = (
    cat: CatState,
    now: number,
  ): { x: number; y: number } | undefined => {
    const target = pointerAt.get(cat.id);
    return target && now - pointerTime <= POINTER_IDLE_MS ? target : undefined;
  };

  const tiltTowards = (cat: CatState, target: { x: number; y: number }) =>
    clamp(
      -Math.atan2(cat.groundY - target.y, Math.abs(target.x - cat.pose.x) + 1) *
        TILT_GAIN,
      -MAX_TILT,
      0,
    );

  /** An ease per 60fps frame, applied over `frames` of them. */
  const eased = (ease: number, frames: number): number =>
    1 - (1 - ease) ** frames;

  /** A held cat sits where it is and turns its head to the pointer; true until it settles. */
  const look = (cat: CatState, now: number, frames: number): boolean => {
    const target = pointerFor(cat, now);
    const dx = target ? target.x - cat.pose.x : 0;
    const want =
      Math.abs(dx) > FACE_DEADBAND
        ? Math.sign(dx)
        : Math.sign(cat.pose.face) || 1;
    const settled = mixPose(
      cat.pose,
      pose('sit', { x: cat.pose.x, hr: target ? tiltTowards(cat, target) : 0 }),
      eased(WATCH_EASE, frames),
    );
    settled.x = cat.pose.x;
    /* A flat sticker flips; easing the width through zero shows a sliver. */
    settled.face = want;
    const moving = poseGap(cat.pose, settled) > SETTLED;
    cat.pose = settled;
    return moving;
  };

  /** Turns to a moving pointer and tilts its head to it; with none, the watcher plays like the others. */
  const watch = (
    cat: CatState,
    target: { x: number; y: number },
    frames: number,
  ): void => {
    const dx = target.x - cat.pose.x;
    const want =
      Math.abs(dx) > FACE_DEADBAND
        ? Math.sign(dx)
        : Math.sign(cat.pose.face) || 1;
    const calm = mixPose(
      cat.pose,
      pose('sit', { x: cat.pose.x, hr: tiltTowards(cat, target) }),
      eased(WATCH_EASE, frames),
    );
    calm.x = cat.pose.x;
    calm.face = want;
    cat.pose = calm;
  };

  const advance = (cat: CatState, playing: Playing, now: number): void => {
    const t = Math.min(now - playing.t0, playing.length);
    const p = poseAt(playing.move, playing.from, t);
    p.x = playing.origin + playing.dir * p.x;
    p.face *= playing.dir;
    cat.pose = p;
    if (playing.prop && playing.move.propAt) {
      const s = playing.move.propAt(t);
      playing.prop.draw({ ...s, x: playing.origin + playing.dir * s.x }, now);
    }
    if (t >= playing.length) endMove(cat);
  };

  /** Moves one cat a frame on; true while it still has something to show. */
  const step = (cat: CatState, now: number, frames: number): StepResult => {
    const held = cat.holds.size > 0;
    const playing = cat.playing;
    if (playing && (playing.settle || !held)) {
      advance(cat, playing, now);
      return 'draw';
    }
    if (cat.asleep) return 'still';
    if (playing) drop(cat);
    const napDue = now >= cat.napAt && !cat.holds.has('card');
    if (held && !napDue) return look(cat, now, frames) ? 'draw' : 'still';
    const target = cat.id === watcherId ? pointerFor(cat, now) : undefined;
    if (!napDue && target) {
      watch(cat, target, frames);
      return 'draw';
    }
    if (!napDue && now < cat.restUntil) return 'rest';
    next(cat, now);
    return 'draw';
  };

  const frame = (now: number): boolean => {
    const frames = clamp((now - lastFrame) / FRAME_MS, 0, MAX_FRAMES_PER_STEP);
    lastFrame = now;
    let busy = false;
    for (const cat of cats) {
      if (cat.hiddenAt !== undefined) continue;
      const result = step(cat, now, frames);
      const tailMoving = cat.rig.tailSpeed.some((v) => Math.abs(v) > TAIL_REST);
      /* A paused cat keeps the loop alive, to end its pause, but is not redrawn. */
      if (result === 'rest') busy = true;
      /* A settled, paused or sleeping cat keeps its last drawing. */
      if (result !== 'draw' && !tailMoving) continue;
      busy = true;
      if (!cat.asleep && now > cat.nextBlink) {
        cat.blinkUntil = now + BLINK_MS;
        cat.nextBlink = now + rand(...BLINK_EVERY_MS);
      }
      draw(cat, now);
    }
    return busy;
  };

  const wakeCat = (cat: CatState, now: number): void => {
    cat.napAt = now + NAP_AFTER_MS;
    cat.nextBlink = now + rand(...BLINK_EVERY_MS);
    if (!cat.asleep) return;
    setAsleep(cat, false);
    play(
      cat,
      MOVES.wake(),
      now,
      Math.sign(cat.pose.face) || 1,
      undefined,
      true,
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
        for (const layer of [cat.props, cat.propsFront])
          layer.setAttribute('transform', `translate(0 ${size.height})`);
        cat.min = TRACK_MARGIN;
        cat.max = Math.max(cat.min, size.width - TRACK_MARGIN - CONTROL_ROOM);
        if (first) cat.pose.x = cat.min + (cat.max - cat.min) * cat.start;
        cat.pose.x = clamp(cat.pose.x, cat.min, cat.max);
        settleTail(cat.rig);
        draw(cat, performance.now());
      }
    },
    frame,
    visible: (id, on, now) => {
      const cat = find(id);
      if (!cat) return;
      if (!on) {
        cat.hiddenAt ??= now;
        return;
      }
      const hiddenAt = cat.hiddenAt;
      if (hiddenAt === undefined) return;
      cat.hiddenAt = undefined;
      if (cat.napAt === Infinity) {
        wakeCat(cat, now);
        return;
      }
      if (cat.napAt > hiddenAt) cat.napAt += now - hiddenAt;
      if (cat.playing) cat.playing.t0 += now - hiddenAt;
    },
    nap: (id) => {
      const cat = find(id);
      if (!cat || cat.asleep) return;
      /* Drops any move, getting up included, so it is still within 5 s. */
      drop(cat);
      cat.napAt = -Infinity;
    },
    wake: (id, now) => {
      const cat = find(id);
      if (cat?.asleep) wakeCat(cat, now);
    },
    hold: (id, reason, on) => {
      const cat = find(id);
      if (!cat) return;
      if (on) cat.holds.add(reason);
      else cat.holds.delete(reason);
      updateMood(cat);
    },
    still: () => {
      const now = performance.now();
      for (const cat of cats) {
        drop(cat);
        cat.pose = pose(cat.asleep ? 'sleep' : 'sit', {
          x: cat.pose.x,
          face: Math.sign(cat.pose.face) || cat.facing,
        });
        cat.hiddenAt ??= now;
        settleTail(cat.rig);
        draw(cat, now);
      }
    },
    resume: (now) => {
      lastFrame = now;
    },
    pointer: (x, y, now, rects) => {
      pointerTime = now;
      for (const [id, rect] of rects)
        pointerAt.set(id, { x: x - rect.left, y: y - rect.top });
    },
    watching: () =>
      cats.some((cat) => cat.hiddenAt === undefined && !cat.asleep),
  };
};
