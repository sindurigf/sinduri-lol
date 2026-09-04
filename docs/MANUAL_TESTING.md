# Manual accessibility testing

The checks a machine cannot decide. Automated coverage (`npm run test:a11y`)
reaches roughly a third of WCAG failures; everything below is the rest, for
what currently exists.

**Scope.** `BaseLayout`, `Header`, `Footer`, `MobileMenu`, `BlogLayout`,
`BlogCard`. Pages are still `PLACEHOLDER` stubs, so this covers chrome and
navigation, not real reading content.

**Setup.**

```sh
npm run build && npm run preview   # http://localhost:4321
```

Record results in section 7 of [ACCESSIBILITY.md](../ACCESSIBILITY.md). A gap
is closed by testing it, not by fixing it.

**Software.** Checked on this machine (Ubuntu 25.10, GNOME, Wayland):

| Tool          | Status                                        | Needed for   |
| ------------- | --------------------------------------------- | ------------ |
| Google Chrome | installed (152)                               | all          |
| Firefox       | installed (155)                               | §2, §8       |
| Orca          | **installed** (`/usr/bin/orca`)               | §6           |
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
- [ ] Tab forward repeatedly. Focus cycles Home → About → Career → Blog →
      Get in touch → Close → back to Home. It **never** reaches the page
      behind. → SC 2.1.2
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
      → SC 1.4.10 > ⚠️ **Known to fail on `/` right now.** The `<h1>` word "PLACEHOLDER" > renders 317px wide against a 305px content box and cannot break, so the > page scrolls 12px sideways. Any h1 word of ~11+ characters does this > ("Accessibility" = 351px, "Professional" = 341px). Re-test once real > headings land. See the report note on `overflow-wrap`.
- [ ] The **mobile menu button appears** and the desktop nav is gone.
      → SC 1.4.10
- [ ] The mobile menu **opens and is fully operable** at this zoom. This is the
      reason it is `client:load`; if it were `client:media` it could fail here.
      → SC 1.4.10
- [ ] No content overlaps another element or is cut off. → SC 1.4.10
- [ ] Tab through the page. **The sticky 80px header never covers the element
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

## 6. Screen reader

**Orca is installed and is your realistic option.** NVDA needs a Windows VM;
VoiceOver needs a Mac. Do the Orca pass; treat the others as optional.

### Orca (Linux, available now)

Orca on Wayland with Chrome needs accessibility support switched on:

```sh
gsettings set org.gnome.desktop.interface toolkit-accessibility true
orca &                     # Super+Alt+S also toggles it
```

Chrome enables its accessibility tree automatically once Orca is running.
If nothing is announced, restart Chrome after starting Orca. Firefox is often
more reliable than Chrome with Orca — try it if Chrome is silent.

Orca keys: `Orca+Tab` next item, `Orca+H` next heading, `Orca+M` landmarks
list, `Orca+K` links list. The Orca modifier is Insert or CapsLock.

- [ ] Landmarks are announced: banner, navigation "Primary", main,
      contentinfo, navigation "Social". → SC 1.3.1
- [ ] There is exactly **one** `<h1>` and it is announced first among headings.
      → SC 1.3.1, 2.4.6
- [ ] Heading levels do not skip. → SC 1.3.1
- [ ] The current page's nav link is announced as **current**, not merely shown
      with a gold dot. → SC 1.4.1
- [ ] The gold active-page dot is **not** announced. → SC 1.3.1
- [ ] The menu button is announced as "Menu, button, collapsed", and as
      **expanded** once opened. → SC 4.1.2
- [ ] Opening the menu moves the reading cursor **into** the dialog, and the
      page behind is not reachable while it is open. → SC 4.1.2
- [ ] The footer badge is **silent**. If you hear "Sinduri" or a filename,
      the `alt=""` has been broken. → SC 1.1.1
- [ ] The header bunny mark announces "Lepus Ridet mark". → SC 1.1.1
- [ ] Link names make sense read out of context in the links list. → SC 2.4.4
- [ ] Nothing is announced twice in a row. → SC 1.3.1
- [ ] **Note how nav items are read.** They are written sentence case and
      uppercased in CSS, but Chromium exposes the transformed string, so Orca
      may receive "ABOUT". Write down whether it says "About", "ABOUT", or
      spells "A-B-O-U-T". → SC 1.3.1
- [ ] Turn `toolkit-accessibility` back to `false` when finished if the desktop
      feels slow.

### NVDA (Windows) — needs a VM, mark N/A if you have none

- [ ] Same list as above, in Chrome and Firefox.
- [ ] Check browse mode vs focus mode on the dialog specifically.

### VoiceOver (macOS/iOS) — no hardware, mark N/A

- [ ] Safari only. `Cmd+F5` to start, `Ctrl+Opt+U` for the rotor.
- [ ] iOS VoiceOver on the mobile menu, since touch differs from keyboard.

## 7. Text zoom and text spacing

### 200% text-only zoom → SC 1.4.4

Firefox does text-only zoom properly; Chrome does not. Use **Firefox**:
Settings → General → Zoom → tick **"Zoom text only"**, then Ctrl+`+` to 200%.

- [ ] No text is clipped, truncated, or hidden behind another element.
- [ ] Uppercase labels in the header and footer still fit their buttons.
- [ ] The 80px sticky header grows or the text inside it stays readable;
      nothing spills out of it.
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
- [ ] Buttons and links grow to fit rather than cutting their labels off. > ⚠️ At a 320px viewport this currently pushes horizontal overflow from > 12px to 94px, same `<h1>` cause as §3. Nothing clips, but the sideways > scroll gets worse. Re-check with real headings.

## 8. Cross-browser

`<dialog>` is the one thing here with real engine differences.

- [ ] Firefox: full §2 pass.
- [ ] Firefox: focus ring is visible on every stop.
- [ ] WebKit/Safari: mark N/A unless you get access to a Mac.

## 9. Target size → SC 2.5.8

- [ ] Header nav links (About, Career, Blog) are only **16px tall**. They pass
      2.5.8 through the _spacing_ exception: 40px gaps mean 24px circles
      centred on each do not overlap. Confirm this still holds if the nav gap
      is ever reduced, or if items are stacked. This is the check to redo after
      any header layout change.
- [ ] The mobile menu button is 48x48. → pass
- [ ] Footer social links are ≥56px tall. → pass

## 10. What this checklist does not cover

Not gaps in the testing, gaps in the site.

- The **contact form** does not exist. SC 1.3.5, 3.3.1, 3.3.2, 3.3.3, 3.3.7,
  3.3.8 and 4.1.3 are untestable until it does.
- **Real content.** Reading order, plain language, link text in prose, and
  in-page heading structure need real copy, not `PLACEHOLDER`.
- The **spinning badge** is not built, so SC 2.2.2 has nothing to test.
- **SC 2.4.11 is only partly testable.** No page is long enough for the sticky
  header to obscure focus during normal scrolling. Redo §3 once one is.
