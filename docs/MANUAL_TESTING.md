# Manual accessibility testing

The checks a machine cannot decide. Automated coverage (`npm run test:a11y`)
reaches roughly a third of WCAG failures; everything below is the rest, for
what currently exists.

**Scope.** `BaseLayout`, `Header`, `Footer`, `MobileMenu`, the blog templates
(`BlogLayout`, `blog/[slug].astro`, `blog/[category]/index.astro`), and
`404.astro`. Home, About, Career, Blog index and Contact still render
`PLACEHOLDER` stubs, so those routes exercise the chrome and navigation and
nothing else. The blog routes and the 404 page have real structure, and the
404 page has real copy. `BlogCard.astro` is a stub no route renders, so there
is nothing in it to test yet.

**Setup.**

```sh
npm run build && npm run preview   # http://localhost:4321
```

**Stop that server before running `npm run test:a11y`.** The suite now sets
`reuseExistingServer: false`, so it always builds and serves its own copy and
refuses to start over a server already on :4321. That is deliberate: reusing
one meant skipping `npm run build`, so a run could pass against the previous
build. `astro preview stop` clears it.

Record results in section 7 of [ACCESSIBILITY.md](../ACCESSIBILITY.md). A gap
is closed by testing it, not by fixing it.

**A measurement that changes between two attempts is environmental until proved
otherwise.** This matters more by hand than in CI, because every number below is
read off one machine in one session and there is nothing to diff it against. If
the same page measures differently twice, the cause is almost never the page:

- The browser. §3 exists because headless Chromium overlays its scrollbar and
  gives a 320px viewport a 320px layout box, where headed Chrome draws a classic
  15px bar and gives 305px. Same CSS, same build, 15px apart. Record which
  browser and which version produced a number.
- A stale server. Astro 7 backgrounds `dev` and `preview` when it detects an AI
  coding agent, so a daemon from an earlier session can still be answering on
  :4321 while you believe you are looking at a fresh build. `ps aux | grep astro`.
- Zoom and text scaling left set from the previous section. §3 and §7 both change
  it, and neither resets it for you.
- Machine load. A page that renders slowly enough to measure mid-layout is a
  memory problem, not a layout regression.

Re-measure before writing a result down, and note the conditions next to it.
[README.md](../README.md) has the same rule for the automated suite.

**Software.** Checked on this machine (Ubuntu 25.10, GNOME, Wayland):

| Tool          | Status                                        | Needed for   |
| ------------- | --------------------------------------------- | ------------ |
| Google Chrome | installed (152)                               | all but §6   |
| Firefox       | installed (155)                               | §2, §6, §8   |
| Orca          | **installed** — 49.1, AT-SPI2 2.57.1          | §6           |
| NVDA          | not available — Windows only                  | §6           |
| VoiceOver     | not available — macOS/iOS only                | §6           |
| Accerciser    | not installed (`sudo apt install accerciser`) | optional, §6 |

---

## 1. Keyboard: header and footer

Chrome, 1280px, `/`. Start with focus in the address bar, then Tab.

- [ ] **First Tab lands on "Skip to main content."** Nothing precedes it.
      → SC 2.4.1
- [ ] The skip link is **visible** when focused. It slides down to the top-left
      and is not clipped or hidden behind the header. → SC 2.4.7
- [ ] Press Enter on it. The page jumps to the main region **and a gold outline
      appears around the main content area**, showing where you landed.
      → SC 2.4.1
- [ ] From there, one more Tab goes to the **footer**, not back into the header
      nav. That is the skip working. → SC 2.4.1
- [ ] Reload. Tab through the whole page. Order is: skip link → logo → Home →
      About → Career → Blog → Get in touch → footer social links (GitHub,
      LinkedIn, Instagram, Bluesky, Drupal, Email). Nothing is reached in a
      surprising order. → SC 2.4.3
- [ ] **Every** stop shows a gold outline with a visible gap around it. No stop
      is silent. → SC 2.4.7
- [ ] Shift+Tab all the way back out. The order reverses exactly and you exit
      the top of the page. → SC 2.1.2
- [ ] No stop swallows Tab, Escape, or arrow keys. → SC 2.1.2
- [ ] The footer badge is **never** a tab stop and is never announced. It is
      decorative. → SC 1.1.1

## 2. MobileMenu, keyboard only

Chrome at 375px wide (DevTools device toolbar, or narrow the window).
**Do not touch the mouse for this section.**

- [ ] Tab to the menu button. It shows a focus ring. → SC 2.4.7
- [ ] Press **Enter**. The panel opens. → SC 2.1.1
- [ ] Press Escape, reopen with **Space**. Both keys work. → SC 2.1.1
- [ ] With the panel open, focus is **inside** the panel, on the first link.
      You do not have to Tab to get there. → SC 2.4.3
- [ ] Tab forward repeatedly. Focus goes Home → About → Career → Blog →
      Get in touch → Close, then **out to the browser UI for one stop**, then
      back to Home. It is a seven-step cycle, not a tight six-step loop, and
      the browser-UI stop is correct `<dialog>` behaviour rather than a leak:
      measured in Chrome 152, `document.activeElement` is `body` at that stop
      and the next Tab re-enters the panel at Home. What matters is that focus
      **never** reaches the inert page behind. → SC 2.1.2
- [ ] Shift+Tab from the first item wraps to Close, not out of the panel.
      → SC 2.1.2
- [ ] Press **Escape**. The panel closes. → SC 2.1.2
- [ ] Focus is back **on the menu button**, not at the top of the page.
      → SC 2.4.3
- [ ] Reopen, Tab to **Close**, press Enter. Focus returns to the menu button
      again. → SC 2.4.3
- [ ] Reopen and activate a nav link with Enter. It navigates. → SC 2.1.1
- [ ] While the panel is open the page behind **does not scroll** (try arrow
      keys and Page Down). → SC 2.1.1
- [ ] Repeat the whole section in **Firefox**. `<dialog>` focus and Escape
      handling differ between engines. → SC 2.1.2

## 3. Reflow: 400% zoom at 1280px

Chrome, window exactly 1280px wide, then Ctrl+`+` to **400%**.
This gives a ~320px CSS viewport.

- [ ] **No horizontal scrollbar.** Nothing requires scrolling sideways to read.
      → SC 1.4.10

> The heading overflow that used to fail here is fixed and covered by
> `tests/reflow.spec.ts`, which asserts `scrollWidth <= clientWidth` on every
> route at **320px and 305px**, with and without the §7 spacing override.
> **Still do this check by hand.** Resizing a viewport is not zooming: real
> 400% zoom brings a classic scrollbar, subpixel rounding, and the browser's
> own minimum font size, none of which the automated run sees.
>
> **The 15px gap is closed.** Playwright runs headless, where scrollbars are
> overlaid and a 320px viewport gives a 320px layout box; headed Chrome 152
> and Chromium 151 draw a classic 15px scrollbar and give **305px**. The suite
> used to run only the forgiving width. It now runs 305px as a fixed viewport
> width too, which is the width the heading floors are calibrated against, so
> this is no longer a check the automated tier cannot make.
>
> **What to expect on screen.** The page gutter is 16px a side below `sm`, so
> body copy does not touch the screen edge. The content box is **273px** at a
> real 305px viewport and 288px at 320px, on every route including the stubs.
> A card on a category route has 24px of padding at this width, not 40px,
> leaving a 209px content box.
>
> **An overflow assertion cannot see a heading floor that is too high.**
> `overflow-wrap: break-word` guarantees the document never scrolls sideways,
> so the symptom of a bad floor is a heading cut mid-word, not a scrollbar.
> The suite now measures every heading word against its own box as well, but
> the next check is still the one your eyes do.

- [ ] **No heading is cut mid-word.** `overflow-wrap: break-word` breaks
      anywhere and draws no hyphen, so a heading reading `ANNOUNCEM / ENTS` is
      the signal that a word needs a soft hyphen. See the content rule in the
      design system skill. → SC 1.4.10

- [ ] The **mobile menu button appears** and the desktop nav is gone.
      → SC 1.4.10
- [ ] The mobile menu **opens and is fully operable** at this zoom. This is the
      reason it is `client:load`; if it were `client:media` it could fail here.
      → SC 1.4.10
- [ ] No content overlaps another element or is cut off. → SC 1.4.10
- [ ] Tab through the page. **The sticky 96px header never covers the element
      that has focus.** Watch the top of the viewport as you Tab.
      → SC 2.4.11
- [ ] Repeat on `/blog/example-post`, the longest page. → SC 1.4.10, 2.4.11
- [ ] Repeat at **200%** and **250%** as well; a pass at 400% does not
      guarantee the steps in between. → SC 1.4.10

## 4. Reduced motion

GNOME maps `prefers-reduced-motion` to its animation setting.

```sh
gsettings set org.gnome.desktop.interface enable-animations false   # on
gsettings set org.gnome.desktop.interface enable-animations true    # off again
```

Verify the browser picked it up at `chrome://settings` or by running
`matchMedia('(prefers-reduced-motion: reduce)').matches` in the console — it
must return `true`.

- [ ] With it enabled, open and close the mobile menu. The hamburger bars
      **snap** rather than animate. → SC 2.3.3
- [ ] Nothing else on the page moves, fades, or slides. → SC 2.3.3
- [ ] Turn it back off and confirm the transition returns, so you know the
      media query is actually what changed. → SC 2.3.3

> Nothing on the site currently animates except three 0.15s transitions on the
> hamburger bars. There are **no** CSS animations yet. When the spinning badge
> lands it will need a real pause control, not just this media query
> (SC 2.2.2), and this section must be rewritten.

## 5. Focus indicator visibility

The indicator is a **3px gold `#FFC000` outline at 3px offset**. Measured
against the three surfaces: 11.32 / 10.60 / 11.76 — all far above the 3:1 of
SC 1.4.11. What the numbers cannot tell you is whether you can _see_ it.

Look, do not measure:

- [ ] On `#131313` (page background): header nav links. → SC 1.4.11, 2.4.7
- [ ] On `#1A1A1A` (surface): footer social link buttons. → SC 1.4.11, 2.4.7
- [ ] On `#0E0E0E` (deep): anything in the footer region. → SC 1.4.11, 2.4.7
- [ ] **On the gold "Skip to main content" link.** Gold on gold is 1.00:1, so
      the ring is only visible because of the 3px offset putting dark
      background on both sides. Confirm you can see it. If this looks wrong,
      the offset is the thing to check, never remove it. → SC 1.4.11
- [ ] On the cyan "Get in touch" button. → SC 1.4.11
- [ ] The ring is never clipped by a parent, and never hidden under the sticky
      header. → SC 2.4.11
- [ ] Nothing relies on the hard offset shadow to signal focus. The shadows are
      resting state and decoration. → SC 2.4.7

## 6. Screen reader: the Orca pass

This is gap 4 in [ACCESSIBILITY.md](../ACCESSIBILITY.md) §7, the oldest
outstanding item on the site and the only one that needs a person at a
keyboard. Nothing here has ever been run against any screen reader. Orca is
the realistic option: NVDA needs a Windows VM and VoiceOver needs a Mac.

Written to be worked through in one sitting, against what exists today:
`BaseLayout`, `Header`, `Footer`, `MobileMenu`, the blog templates, and the
404 page. No prior Orca experience assumed.

**Which browser. Firefox, except for one step.** This section departs from the
rest of the document, which uses Chrome. Orca is built and tested primarily
against Firefox on Linux, and its Chromium support is weaker. An unexpected
result in Chrome may therefore reflect the Orca–Chromium pairing rather than
anything about this site's markup. Everything here runs in **Firefox**: the
skip link (6.5), the header, footer, landmarks and headings (6.6), the
MobileMenu dialog (6.7), the blog post's heading order (6.8) and the 404 page
(6.9). A result from Firefox is trustworthy and can be acted on as it stands.

**Chromium is used for exactly one step, 6.4, the uppercase question**, and for
a reason specific to that question. Chromium is the only engine that puts the
string produced by `text-transform` into the accessibility tree; Firefox and
WebKit are reported to leave the name as authored. Asking Firefox how an all-caps
accessible name is announced answers nothing, because Firefox never produces
one. Step 6.4 therefore runs in both: Firefox as the control, Chrome for the
only reading that can settle it. Nothing else in this section needs Chrome.

Read anything strange in the Chrome half of 6.4 as a question, not a finding.
It may be the pairing rather than the site, and a single odd result is not
enough on its own to change a file.

**If Firefox is missing:** `sudo apt install firefox` (on Ubuntu that installs
the Firefox snap). It is present on this machine at version 155.

### 6.1 Setting up

Build and serve, in one terminal:

```sh
npm run build && npm run preview   # http://localhost:4321
```

Start Orca with a log, in a second terminal:

```sh
orca --replace --debug-file=/tmp/orca-pass.log &
```

**The log is the point.** `--debug-file` sets Orca's debug level to
`LEVEL_ALL`, and every utterance is written out as a line reading
`SPEECH OUTPUT: '...'`. That is a verbatim transcript, which is what several
of the checks below actually ask for. Do not work from memory. Watch it live
in a third terminal:

```sh
tail -f /tmp/orca-pass.log | grep --line-buffered "SPEECH OUTPUT"
```

**Stopping Orca.** `Super+Alt+S` toggles it off, and back on. There is no
`--quit` flag and the quit command is unbound by default, so `pkill -f orca`
is the fallback. The log grows fast, because `LEVEL_ALL` records far more than
speech; `rm /tmp/orca-pass.log` when you are done with it.

**If the browser is silent.** Orca 49 switches accessibility on by itself over
D-Bus (`org.a11y.Status IsEnabled`), so the old
`gsettings set org.gnome.desktop.interface toolkit-accessibility true` step is
a GTK-era fallback rather than a requirement. If nothing is announced anyway,
in this order: restart the browser while Orca is already running; set
`toolkit-accessibility true` and restart it again. Set `toolkit-accessibility`
back to `false` afterwards if the desktop feels slow.

Silence is more likely in Chrome than in Firefox, which is part of why Firefox
is the primary browser here. If Chrome stays silent through both fallbacks, say
so in the 6.4 blanks and leave them empty. An unanswered question recorded as
unanswered is worth more than one answered by the wrong engine.

Checked on this machine: **Orca 49.1, AT-SPI2 2.57.1, Wayland.**

### 6.2 The keys you need

The **Orca modifier** is `CapsLock` on the Laptop keyboard layout and `Insert`
on the Desktop layout. If you do not know which you have, press `Orca+H` with
each in turn: Learn Mode announces every key you press along with the command
it runs, and `Esc` leaves it. Learn Mode is also the safe way to try any key
below without triggering it.

| Key                 | What it does                                      |
| ------------------- | ------------------------------------------------- |
| `Super+Alt+S`       | Turn Orca on and off                              |
| `Orca+H`            | Learn Mode on. `Esc` to leave                     |
| `Orca+S`            | Silence speech, and turn it back on               |
| `Orca+V`            | Toggle verbose and brief verbosity                |
| `Orca+Return`       | Where Am I: describe what you are on now          |
| `Orca+Slash`        | Read the window title bar                         |
| `Orca+Space`        | Orca's preferences dialog                         |
| `Orca+Z`            | Turn the single-letter navigation keys off and on |
| `Tab` / `Shift+Tab` | Move focus, exactly as without a screen reader    |
| `Up` / `Down`       | Read the previous / next line                     |
| `Ctrl+Home`         | Go to the top of the document                     |
| `H` / `Shift+H`     | Next / previous heading                           |
| `1`–`6`             | Next heading at that level                        |
| `Alt+Shift+H`       | **List** every heading on the page                |
| `K` / `Shift+K`     | Next / previous link                              |
| `Alt+Shift+K`       | **List** every link                               |
| `M` / `Shift+M`     | Next / previous landmark                          |
| `Alt+Shift+M`       | **List** every landmark                           |
| `B`                 | Next button                                       |
| `G`                 | Next image                                        |
| `L` / `I`           | Next list / next list item                        |

`Orca+Return` is the Laptop-layout binding for Where Am I. On the Desktop
layout it is the numeric keypad's `Enter`.

The single-letter keys are structural navigation, and they only work while you
are reading a document rather than typing into a field. This site has no form
fields yet, so they work everywhere on it.

### 6.3 How to fill this in

Each check gives the steps, what a pass sounds like, and a blank. **Write what
you heard, word for word, not a summary.** "Says the name" is not a result;
`About link` is. Where the log is running, paste the `SPEECH OUTPUT` line.

A blank left empty is an untested check, and that is a legitimate outcome to
record. A ticked box with an empty blank is not.

### 6.4 The uppercase question. Do this one first

This is the open half of a known issue, the only step in this section that
touches Chrome, and the only reason to run the pass in a particular order:
three files are waiting on the answer.

`AI.md` [Uppercase](../AI.md#uppercase) and the design system skill's
`### Uppercase` both record that Chromium hands the **transformed** string to
the accessibility tree, measured at Chromium 151: markup reading `About`
exposes the accessible name `"ABOUT"`. Both also record that Firefox and WebKit
do not transform it. Both then flag what a reader actually _says_ for such a
name as unverified. That guess is what this step replaces.

**Why it cannot be answered in Firefox alone.** If Firefox leaves the name as
authored, then Firefox never produces the input condition being asked about: an
all-caps accessible name. Hearing "career" there measures Firefox's name, not
Orca's handling of caps. Chromium is the only engine on this machine that puts
`"CAREER"` into the tree, so it is the only one that can be asked. Firefox is
still run, as the control that establishes what the untransformed name sounds
like on the same link, in the same voice, at the same setting.

It is not only the nav. Every `h1`–`h6`, `.label`, `.label-wide`,
`.btn-primary`, `.btn-secondary` and the skip link carry
`text-transform: uppercase`, so the answer applies to the whole site.

**6.4.1 Pin the variable first: Capitalization style.** Orca signals capitals
according to a setting, at `Orca+Space` → Voice → **Capitalization style**,
with the values None (the default), Spell, and Icon. On Spell it will spell
capitals out whatever the browser hands it, which answers a different question
from the one being asked. Read the value, write it down, and leave it on
**None** for 6.4.2 and 6.4.3. Neither recording means anything without it.

- [ ] The setting was on: `______________________________________________`

**6.4.2 A nav link, Firefox.** The control.

1. Firefox at 1280px, full screen, on `http://localhost:4321/about`.
2. Click once on empty page background, so the reading cursor is in the
   document rather than in the browser chrome.
3. `Ctrl+Home`.
4. Press `K` until Orca reaches the header link **Career**. Career rather than
   About on purpose: it is not the current page, so nothing about
   `aria-current` is mixed into the announcement.
5. Press `Orca+Return` and listen to it again.

Write what came out of the speakers, word for word. Not "reads it normally".

- [ ] Firefox said, verbatim: `______________________________________`
- [ ] `SPEECH OUTPUT:` line: `_______________________________________`

**6.4.3 The same nav link, Chrome.** The measurement. Same URL, same width,
same five steps, same Capitalization style, in Chrome instead. If Chrome is
silent, work through the fallbacks in 6.1 before recording anything.

- [ ] Chrome said, verbatim: `_______________________________________`
- [ ] `SPEECH OUTPUT:` line: `_______________________________________`

**6.4.4 What the pair means.** Three outcomes, and the third is a real one:

1. **Both read the word normally** — Firefox "career" and Chrome "career". The
   worry that a CSS-uppercased accessible name gets spelled out letter by
   letter was unfounded in both engines. Replace the "unverified" sentence in
   the three files with the two quotes. The practice keeps its other
   justifications, which never rested on this.
2. **Chrome spells it out ("C A R E E R") and Firefox does not.** A genuine
   cross-engine inconsistency, heard rather than cited. This is the strongest
   possible argument _for_ the practice: sentence case in the markup is then
   demonstrably the only input that is safe under either engine's behaviour,
   because it is the only one that never forces caps into the name.
3. **Anything else.** A pitch or tone change, a partial spell-out, Firefox
   spelling it out too, Chrome silent, the two engines differing in some other
   way. Record it verbatim in the blank above and stop there. **Do not
   interpret it.** Orca–Chromium is the weaker pairing, so an odd Chrome
   reading is as likely to be the pairing as the site. Repeat it once with the
   Capitalization style confirmed; if it repeats, it goes into the files as a
   quoted observation with the browser and version named, not as a conclusion.

**No outcome changes the practice.** `text-transform` in CSS stays, and
sentence case in the markup stays, whatever Orca says. What changes is the
stated justification, and only if the evidence supports it. The rule was never
justified by the announcement: the design system skill is explicit that the
earlier "it keeps the accessible name in sentence case" defence is false. It
rests on three things this test cannot touch. Chromium transforms the
accessible name and Firefox and WebKit do not, so sentence case is the only
input that is safe under either behaviour. The content stays editable,
copy-pasteable and searchable as written. And machines reading the DOM get the
true string. Typing `ABOUT` into the markup makes all three worse and fixes
nothing.

**6.4.5 Does the answer generalize? Chrome only.** Only Chrome is worth asking,
for the reason in 6.4.2, and only to check that the nav link was not a special
case.

- [ ] A heading. `/about`, `Ctrl+Home`, then `H` to the `<h1>`, which reads
      `About` in the markup.
      Heard: `___________________________________________`
- [ ] A button label. `http://localhost:4321/404`, then `K` to "Go to the
      homepage", which `.btn-primary` uppercases.
      Heard: `___________________________________________`
- [ ] The 6.4.3 link again at the other verbosity: `Orca+V`, repeat, `Orca+V`
      back.
      Heard: `___________________________________________`

That is the last of Chrome. Everything from 6.5 on is Firefox.

### 6.5 Skip link

Two separate questions, and the second is the one usually missed. The skip
link is the first focusable element in `BaseLayout`, and `main` carries
`tabindex="-1"` precisely so that activating it moves the **reading cursor**
and not only focus. A skip link that moves the sequential focus point but
leaves the screen reader's cursor at the top of the document has skipped
nothing for the person using it.

Firefox at 1280px on `http://localhost:4321/`. Click into the address bar, then
press `Tab` once.

- [ ] It is announced, and it is the first thing announced.
      Heard: `___________________________________________` → SC 2.4.1
- [ ] The name is "Skip to main content". This is Firefox, so 6.4.2 is the
      relevant half of the uppercase answer: the name should arrive as
      authored, whatever Chrome does with it.
      Heard: `___________________________________________` → SC 2.4.4

Press `Enter`.

- [ ] Something is announced on landing rather than silence.
      Heard: `___________________________________________` → SC 2.4.1
- [ ] **The reading cursor moved, not just focus.** Press `Down` immediately.
      A pass reads the page's own first line ("Placeholder heading" on `/`). A
      line from the header is a fail: the cursor never left the top.
      Heard: `___________________________________________` → SC 2.4.1
- [ ] Press `Tab` once. A pass lands on the footer's first social link,
      GitHub. A header nav link means the skip did not take.
      Heard: `___________________________________________` → SC 2.4.1

### 6.6 Header, footer, landmarks and headings

Firefox at 1280px on `http://localhost:4321/about`. Home, About, Career, Blog
and Contact are still `PLACEHOLDER` stubs, so this exercises the chrome and
nothing else, which is exactly what it is for.

- [ ] `Alt+Shift+M` lists exactly five landmarks: banner, navigation
      "Primary", main, contentinfo, navigation "Social". Nothing unnamed,
      nothing duplicated.
      Listed: `__________________________________________` → SC 1.3.1
- [ ] `M` from the top steps through those five in that order.
      Heard: `___________________________________________` → SC 1.3.1
- [ ] `Alt+Shift+H` lists exactly two headings: the `h1` "About" and the
      footer's `h2` "Let's Talk.". One `h1`, announced first, no skipped level.
      Listed: `__________________________________________` → SC 1.3.1, 2.4.6
- [ ] `G` from `Ctrl+Home` reaches the header bunny mark and announces
      "Lepus Ridet mark".
      Heard: `___________________________________________` → SC 1.1.1
- [ ] `G` again finds **no second image**. The footer badge is `alt=""` and
      must be silent. "Sinduri", "badge", or a filename means the empty alt
      has been broken.
      Heard: `___________________________________________` → SC 1.1.1
- [ ] Reach the **About** link with `K`. A pass announces it as the current
      page, not merely as a link.
      Heard: `___________________________________________` → SC 1.4.1, 4.1.2
- [ ] The active-page **box** is not announced. Nothing about a border, a
      frame, or a stray blank in that same announcement. It is drawn with
      `border` and `box-shadow` on the link itself, so unlike the gold dot it
      replaced there is no element here to leak into the accessible name; this
      check is now confirming the absence of a defect rather than watching a
      known risk.
      Heard: `___________________________________________` → SC 1.3.1
- [ ] `Alt+Shift+K` lists the links. Every name stands on its own, out of
      context: no "click here", no bare URL, no two destinations sharing a
      name. Note any that do not.
      Noted: `___________________________________________` → SC 2.4.4
- [ ] Nothing is announced twice in a row, anywhere in this pass. Note where
      if it is.
      Noted: `___________________________________________` → SC 1.3.1

### 6.7 MobileMenu at 320px

**Getting to 320px.** The breakpoint is Tailwind's `md`, 768px, so the mobile
menu is present at any width below that; 320px is the width the rest of this
document is calibrated against, so use it. Narrowing the window itself is the
cleanest way. If it will not go that narrow, use Firefox's Responsive Design
Mode (`Ctrl+Shift+M`) with the width set to 320. **Detach the developer tools
into their own window first** (the tools' meatball menu → Dock side → Separate
Window): a docked panel sits in the same accessibility tree as the page, and
Orca will read into it.

Firefox at 320px on `http://localhost:4321/`. `Ctrl+Home`, then `Tab` three
times: skip link, logo, menu button. The desktop nav is `display: none` here,
so it is not in the way.

- [ ] The button announces its name **and** its state. A pass contains "Menu",
      "button", and collapsed or not-expanded, in some wording.
      Heard: `___________________________________________` → SC 4.1.2
- [ ] Press `Enter`. A pass announces a **dialog** and its name: something
      containing both "Menu" and "dialog". "dialog" with no name means the
      `aria-label="Menu"` is not reaching the tree.
      Heard: `___________________________________________` → SC 4.1.2
- [ ] The reading cursor is **inside** the panel, not still on the button.
      Press `Down` immediately. A pass reads the first nav link.
      Heard: `___________________________________________` → SC 4.1.2
- [ ] The page behind is **unreachable**. `Ctrl+Home`, then `Down` repeatedly.
      A pass never reads the header, the footer, or the page's `h1`.
      `showModal()` marks the rest inert, so a leak is a real finding.
      Heard: `___________________________________________` → SC 4.1.2
- [ ] `Alt+Shift+M` with the panel open lists **one** navigation, unnamed,
      inside the dialog. Two navigations both called "Primary" is the
      `landmark-unique` regression this markup was changed to avoid, and the
      automated suite does not run that rule.
      Listed: `__________________________________________` → SC 1.3.1
- [ ] Press **Escape**. A pass announces the close and puts you back on the
      menu button, with its state collapsed again.
      Heard: `___________________________________________` → SC 2.1.2, 4.1.2
- [ ] **Where the cursor landed after Escape.** Press `Orca+Return` before
      pressing anything else. A pass describes the menu button. The document,
      "html", or the page `h1` means the reading cursor did not follow the
      focus the browser restored, which is a finding even though the
      keyboard-only check in §2 passes.
      Heard: `___________________________________________` → SC 2.4.3
- [ ] Reopen, reach **Close** (`B`, or Tab to it), press Enter, and ask the
      same question with `Orca+Return`.
      Heard: `___________________________________________` → SC 2.4.3
- [ ] Reopen and activate a nav link. It navigates, and the new page is
      announced rather than arriving in silence.
      Heard: `___________________________________________` → SC 2.1.1
- [ ] `<dialog>` differs between engines, so note that this whole subsection
      is the **Firefox** result, and that Chrome's is unknown. §2 covers the
      keyboard half of the same dialog in both browsers; nobody has heard it in
      Chrome. That is a scope limit to state, not a check to tick.
      Noted: `___________________________________________` → SC 4.1.2

### 6.8 A blog post: heading order and landmarks

`http://localhost:4321/blog/example-post`, Firefox at 1280px. It is the only
route with more than one level of real document structure, and the largest
page in the build. The copy is placeholder; the structure is not.

What the templates produce, in source order:

| Level | Text                            | From                             |
| ----- | ------------------------------- | -------------------------------- |
| `h1`  | PLACEHOLDER: Example Post Title | `[slug].astro`, post frontmatter |
| `h2`  | PLACEHOLDER heading             | the Markdown body                |
| `h2`  | Tags                            | `[slug].astro`                   |
| `h2`  | Let's Talk.                     | `Footer.astro`                   |

- [ ] `Alt+Shift+H` lists exactly those four, in that order, at those levels.
      A fifth entry, a different order, or an `h3` in the middle is a finding.
      Listed: `__________________________________________` → SC 1.3.1
- [ ] One `h1`, announced first. Levels run 1, 2, 2, 2 with nothing skipped.
      Heard: `___________________________________________` → SC 1.3.1, 2.4.6
- [ ] `H` from `Ctrl+Home` walks the same four in the same order, and each
      announcement carries its level.
      Heard, first two: `________________________________` → SC 1.3.1
- [ ] `Alt+Shift+M` lists the same five landmarks as any other route. The
      `<article>` in `BlogLayout` is not a landmark and must not appear.
      Listed: `__________________________________________` → SC 1.3.1
- [ ] `M` to `main`, then `Down` repeatedly. Reading order matches visual
      order: category link, `h1`, teaser, date, then the body.
      Heard: `___________________________________________` → SC 1.3.2
- [ ] The category link reads "personal thoughts" and appears in
      `Alt+Shift+K` with no surrounding context. Judge it there: does it say
      it is a category filter? If not, that is a link-text finding, not a
      pass.
      Noted: `___________________________________________` → SC 2.4.4
- [ ] The `<time>` element reads the formatted date, "1 January 2026", and not
      the ISO string in its `datetime` attribute.
      Heard: `___________________________________________` → SC 1.3.1
- [ ] The Tags block is announced as a list of two items, each tag once. The
      tags are plain `<li>` text, not links, so nothing should be announced as
      clickable.
      Heard: `___________________________________________` → SC 1.3.1

### 6.9 The 404 page

`http://localhost:4321/404`, Firefox at 1280px. This page answers every wrong
address on the deployed site, so it is the one page someone can arrive at with
no idea why. Whether the announcement says so is the entire check.

`astro preview` serves it at `/404` with a 200. That is fine here; the status
code is asserted by `tests/not-found.spec.ts`, not by this section.

- [ ] `Ctrl+Home`, then `Down` through the page. Within the first few lines it
      is clear the address was wrong and that nothing is broken on the
      listener's end.
      Heard: `___________________________________________` → SC 1.3.1
- [ ] `Orca+Slash` reads the window title. A pass contains "404".
      Heard: `___________________________________________` → SC 2.4.2
- [ ] `Alt+Shift+H` lists exactly two headings: the `h1` "Page not found" and
      the footer's "Let's Talk.".
      Listed: `__________________________________________` → SC 1.3.1, 2.4.6
- [ ] `G` from the top finds **only** the header mark. The large gold bunny
      tile on this page is `alt=""`; hearing anything for it means the empty
      alt has been broken.
      Heard: `___________________________________________` → SC 1.1.1
- [ ] The "404" above the heading is a `<p class="section-number">`, not a
      heading, and should read as ordinary text. Record whether it comes out
      as "four hundred and four", "four zero four", or "404". None of those is
      a fail; the answer is the point.
      Heard: `___________________________________________`
- [ ] `Alt+Shift+K` lists this page's own two links, "Go to the homepage" and
      "Read the blog". Both stand on their own.
      Listed: `__________________________________________` → SC 2.4.4
- [ ] They sit in a `<ul>` and are announced as a list of two items.
      Heard: `___________________________________________` → SC 1.3.1

### 6.10 NVDA (Windows) and VoiceOver (macOS/iOS)

No hardware for either. Mark them N/A; they stay open in ACCESSIBILITY.md §7
whatever Orca says.

- [ ] NVDA: the same list, Chrome and Firefox, plus browse mode versus focus
      mode on the dialog specifically. → needs a Windows VM
- [ ] VoiceOver: Safari only, `Cmd+F5` to start, `Ctrl+Opt+U` for the rotor;
      and iOS VoiceOver on the mobile menu, since touch differs from keyboard.
      → needs a Mac

### 6.11 What to do with the results

**What a clean pass settles, and what it does not.** Orca is one screen reader,
read through one engine, on one machine, by one person. It is a data point, not
a verdict. NVDA and VoiceOver pair announcements with browsers differently, and
neither is available here; JAWS is not either. So a page that Orca reads
correctly has been shown to work for Orca users in Firefox, which is worth
having and is more than this site could claim before. It has not been shown to
work for everyone using a screen reader.

Gap 4 in [ACCESSIBILITY.md](../ACCESSIBILITY.md) §7 therefore **narrows** on a
clean pass; it does not close. Rewrite it to say what was tested, in which
browser, with which versions, and what remains untested. Deleting it would
claim a coverage that a single reader cannot give. The same goes for §6's
"Screen reader announcement quality" bullet.

| What you have              | Where it goes                                                                                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every filled blank         | This file. It is the record; the boxes and quotes stay here.                                                                                                                           |
| The 6.4 answers            | `AI.md` → Uppercase; `.claude/skills/sinduri-design-system/SKILL.md` → `#### Why, accurately`; `ACCESSIBILITY.md` §6 → "How uppercase is announced"; `ACCESSIBILITY.md` §7 gap 4.      |
| Everything else, passed    | `ACCESSIBILITY.md` §7 gap 4. **Narrow it, do not delete it.** NVDA, JAWS and VoiceOver stay untested whatever Orca says, and §6's "Screen reader announcement quality" bullet with it. |
| A check that failed        | Fix the component, and add a test if the failure is machine-detectable. If it is not, it becomes a new numbered gap in `ACCESSIBILITY.md` §7, with what you heard quoted.              |
| A check you did not get to | Leave the blank empty and say so in `ACCESSIBILITY.md` §7. An empty blank is data.                                                                                                     |

**On 6.4 specifically, no outcome changes the practice.** 6.4.4 sets out why
in full: `text-transform` in CSS stays and sentence case in the markup stays,
because the rule never rested on the announcement. Only the stated
justification moves, and only as far as the two quotes support.

Outcome 1 and outcome 2 both replace a flagged assumption with a measurement in
three files, and nothing else changes. Outcome 2 also strengthens the rule,
since it is the engine inconsistency measured rather than cited. If instead a
reading turns out to be genuinely bad for a listener, that **additionally**
opens a gap against the visual decision to uppercase at all. That second one is
a design question for Sinduri: it would mean dropping `text-transform` from
`.label` and the headings, which changes how the site looks. Do not make that
change as a side effect of running this test. Either way, the "unverified"
sentence in AI.md and in the skill gets replaced with what was actually heard,
named by browser and version, with the Capitalization style value alongside
it.

## 7. Text zoom and text spacing

### 200% text-only zoom → SC 1.4.4

Firefox does text-only zoom properly; Chrome does not. Use **Firefox**:
Settings → General → Zoom → tick **"Zoom text only"**, then Ctrl+`+` to 200%.

- [ ] No text is clipped, truncated, or hidden behind another element.
- [ ] Uppercase labels in the header and footer still fit their buttons.
- [ ] The 96px sticky header grows or the text inside it stays readable;
      nothing spills out of it. The active link's box is the thing most likely
      to break here: it has to grow with the label rather than clip it.
- [ ] The mobile menu, if it appears, is still operable.
- [ ] Repeat on `/blog/example-post`.

### Text spacing override → SC 1.4.12

Paste into the console on each page:

```js
document.head.insertAdjacentHTML(
  'beforeend',
  `<style>
* { line-height: 1.5 !important; letter-spacing: 0.12em !important;
    word-spacing: 0.16em !important; }
p, li, h1, h2, h3, h4, h5, h6 { margin-bottom: 2em !important; }
</style>`,
);
```

- [ ] No text is clipped and no content is lost.
- [ ] No text overlaps other text.
- [ ] Buttons and links grow to fit rather than cutting their labels off.
- [ ] **No horizontal scroll appears** once the override is applied. This used
      to push overflow from 12px to 94px at 320px, the same `<h1>` cause as §3.
      It is fixed and asserted for every route by `tests/reflow.spec.ts`, which
      applies this exact override. Confirm it by eye anyway.

## 8. Cross-browser

`<dialog>` is the one thing here with real engine differences.

**Firefox and WebKit are now automated.** `playwright.config.ts` defines a
`firefox` project alongside `chromium`, and a `webkit` project in CI, so the
whole suite runs in three engines. Firefox 153.0 passed every one on the first attempt, with no
source change and no browser-conditional assertion anywhere in `tests/`.
`<dialog>` and `showModal()` behave, which is the thing this section was
written to worry about.

That does not retire the by-hand pass below. A suite that passes in Firefox
says the assertions hold there; it does not say the page reads right, and the
focus-ring check in particular is a measured ratio rather than a judgement
about whether the ring reads as one in context.

- [ ] Firefox: full §2 pass, by hand.
- [ ] Firefox: focus ring is visible on every stop, judged rather than measured.
- [ ] WebKit: **automated in CI, and it passes** — 487 tests, 44.1s, first run.
      A real Safari pass on real hardware is still worth doing if anyone has a
      Mac. Headless WebKit is not Safari, and the gap is widest in exactly the
      places this checklist cares about: VoiceOver, and how the platform draws
      focus.

**WebKit cannot run on this machine, and that is an OS fact rather than a
missing package.** Playwright builds WebKit against ICU 74; this machine is
Ubuntu 25.10, which ships ICU 76, and ICU has no ABI compatibility across
majors. `sudo npx playwright install-deps` does **not** fix it — apt has no
`libicu74` on 25.10 at all, and it will also fail to find `libavcodec60`. Do
not chase it by hand-installing 24.04 packages: that risks the system ICU,
which a great deal links against, for the sake of a test browser.

To run WebKit here, use Playwright's own container, which is Ubuntu 24.04:

```sh
docker run --rm --ipc=host -v "$PWD":/work -w /work \
  mcr.microsoft.com/playwright:v1.63.0-noble \
  bash -c "npm ci && WEBKIT=1 npx playwright test --project=webkit"
```

## 9. Target size → SC 2.5.8

Every target is checked on **its own size**. The spacing exception is no longer
used anywhere on this site, so a change to nav spacing cannot break 2.5.8.

- [ ] **The page gutter is present at every width.** Narrow to 320px and
      confirm body copy, headings and cards all sit 16px in from both screen
      edges, on a stub page and on a blog route. A route whose text touches
      the edge has picked up its own container padding rules again, or lost
      `.page-gutter`. → SC 1.4.10
- [ ] Header nav links are **at least 24px tall**. `py-2` on the `.label` link
      takes the 15.6px line box to 31.6px, and the `border-4` every link now
      carries takes it to 39.6px. Measure one in DevTools; do not infer it from
      the gap between links. This is the check to redo after any header layout
      change. → pass at 1440px: Home 87.2x39.6, About 94.5x39.6,
      Career 101.8x39.6, Blog 83.2x39.6, Get in touch 177.6x47.6
- [ ] All four nav links are the **same height**, active or not. They were not
      before: the gold dot sat inside the anchor with `mt-2`, so the current
      page's link was 47.6px and the other three 31.6px. The box that replaced
      it is on every link, transparent until current.
- [ ] The mobile menu button is 48x48. → pass
- [ ] Footer social links are ≥56px tall. → pass
- [ ] Mobile menu links at 320px are ≥24px tall. → pass, they are 34px+ type
- [ ] **The breadcrumb link above the `<h1>` on blog routes.** Was the last
      target on the site passing only by the spacing exception, at 87x16 and
      179x16. `inline-block py-2 -my-2` takes each to **31.6px** tall: the
      padding grows the hit area and the matching negative margin keeps the
      layout box at the 15.6px it occupied, so no glyph moved. Measured at a
      305px viewport after the fix: "All posts" on
      `/blog/professional-journey` is 86.7x31.6, the category link on
      `/blog/example-post` is 178.1x31.6, and the `<h1>` below sits at the
      same y as before (199.6px) on both. Confirm by hovering that the
      clickable area is taller than the words, and that the gap to the `<h1>`
      still looks right. → SC 2.5.8

## 10a. Exploratory tools, and what a trial of one produced

Nothing here is a dependency and nothing here gates CI. These are one-off runs
for finding questions the suite is not asking, which is a different job from
answering them.

### keyboard-a11y-tester

<https://github.com/ezufelt/keyboard-a11y-tester>. MIT, Node >= 20, drives
Playwright keyboard-only as two W3C personas and maps findings to success
criteria. **Not a dependency of this repository and should not become one**: it
needs an LLM to drive its judgment layer, so it cannot gate a build, and
`tests/focus.spec.ts` already walks the tab order deterministically in both
directions on every route at two widths.

Trialled 2026-09-05 against the built site on `localhost:4322`, homepage only,
both viewports. It produced three finding types. **Two were false positives,
and they are recorded here so nobody spends the afternoon on them again.**

1. `sr-duplicate-landmark`, "banner (2x), main (3x)", graded moderate. **False.**
   The DOM has exactly one `<header>`, one `<main>` and one `<footer>`, and zero
   elements carrying `role="banner"` or `role="main"`. axe agrees:
   `landmark-one-main`, `landmark-no-duplicate-banner` and
   `landmark-no-duplicate-main` all pass. The multiplier tracks the number of
   page-audit snapshots the run took — 3 on desktop, 4 on mobile — so it is
   counting one landmark once per snapshot.

2. `sr-focusable-not-exposed`, two `BlogCard` heading links "keyboard-focusable
   but never appear in the accessibility-tree walk (likely `aria-hidden="true"`
   combined with a focusable tabindex)", graded **serious**, confidence 0.75.
   **False.** Both links have no `tabindex`, no `aria-hidden`, and no
   `aria-hidden` ancestor; `ariaSnapshot()` returns them as links with correct
   accessible names. The tool crawls rather than exhausting the page, which its
   own README says, and its census simply did not reach them.

3. `focus-appearance-weak`, WCAG 2.4.13, informative. Graded AAA and so not a
   claim this site makes — but one measurement in it, a focus indicator at
   2.24:1, pointed at something real: **the suite asserted that a focus ring
   exists and never that it could be seen.** The 2.24 figure did not reproduce
   (across 572 controls at both widths the lowest is 10.60:1), but the dimension
   was genuinely untested, and `global.css` had claimed 11.32 / 10.60 / 11.76 in
   a comment with nothing behind it. `tests/focus.spec.ts` now measures it, for
   SC 1.4.11.

**Verdict: worth the one run, not worth a dependency.** One of three findings
was useful, and its usefulness was in naming an untested dimension rather than
in the number it reported. Re-run it after a navigation or card redesign; read
every finding against the DOM before acting on it.

## 10b. Items mined from external checklists

Checked against this site on 2026-09-05, from the Accessible Astro testing
checklist and <https://specification.website/checklist/>. Recorded so the same
ground is not re-walked.

**Now automated, so no longer by hand:** heading hierarchy and one `h1` per page
(axe best-practice `heading-order`, `page-has-heading-one`); content inside
landmarks (`region`); skip link (`skip-link`); descriptive and distinct page
titles (`tests/titles.spec.ts`); forced colours
(`tests/forced-colors.spec.ts`); reduced motion site-wide (`tests/motion.spec.ts`);
focus indicator contrast (`tests/focus.spec.ts`).

**Already covered before this build, and worth knowing so it is not re-checked:**
duplicate IDs. `duplicate-id-aria` carries `wcag2a`, not `best-practice`, so it
has been running under the WCAG tags all along. Its two siblings `duplicate-id`
and `duplicate-id-active` are deprecated in axe 4.13 and do not run at all.

**Not applicable to this site as it stands:** links opening in new tabs — there
is no `target=` attribute anywhere; captions, transcripts and audio description
— there is no video or audio; accessible data tables — there are no tables;
dragging movements, accessible authentication, redundant entry and consistent
help — there is no form, no login and no multi-step flow. Revisit each when the
contact form lands.

**Already satisfied by construction:** the `inert` behaviour behind an open
dialog, because `MobileMenu.vue` uses a native `<dialog>` with `showModal()`
rather than a hand-rolled focus trap.

**One item from the Accessible Astro list is deliberately rejected.** It asks
for touch targets of at least **44x44** pixels. That is SC 2.5.5 Target Size
(Enhanced), which is level **AAA**, or Apple's HIG. The AA criterion this site
targets is **SC 2.5.8 at 24x24**, which `tests/target-size.spec.ts` implements.
Adopting 44 would quietly change the conformance target. The same list's "the
logo should not be linked on the homepage" has no basis in WCAG and is contested
practice; it is not adopted either.

## 10. What this checklist does not cover

Not gaps in the testing, gaps in the site.

- The **contact form** does not exist. SC 1.3.5, 3.3.1, 3.3.2, 3.3.3, 3.3.7,
  3.3.8 and 4.1.3 are untestable until it does.
- **Real content.** Reading order, plain language, link text in prose, and
  in-page heading structure need real copy, not `PLACEHOLDER`.
- The **spinning badge** is not built, so SC 2.2.2 has nothing to test.
- **SC 2.4.11 is only partly testable.** No page is long enough for the sticky
  header to obscure focus during normal scrolling. Redo §3 once one is.
