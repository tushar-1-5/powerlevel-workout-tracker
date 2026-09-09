# Icon source

The app icon is a photograph of a purple plasma sphere — the "ki orb" — not
vector art. Everything Android needs is generated from one master plate by the
scripts here, so the icon set is reproducible instead of being a one-off export
nobody can regenerate.

## The files

| File | What it is |
|---|---|
| `orb-clean-1024.png` | **The master plate.** 1024×1024 RGBA, real transparency, ball ≈87% of the frame. This is the source of truth. |
| `1-unmat.py` | Recovers transparency from a checkerboard screenshot. Only needed if starting over from a new photo. |
| `2-crop.py` | Finds the ball and cuts a square around it. |
| `3-export.py` | **The one you'll actually run.** Writes all four PNGs into `assets/images/`. |

## Regenerating the icons

```bash
python assets/icon-src/3-export.py
```

Requires Pillow and NumPy (`pip install pillow numpy`). It overwrites
`icon.png`, `android-icon-foreground.png`, `android-icon-monochrome.png` and
`splash-icon.png` in `assets/images/`.

Steps 1 and 2 are only for starting from a fresh photo. **The original 6.5 MB
upload is deliberately not committed** — it is a screenshot of a transparent PNG
displayed over a grey checkerboard, and once `1-unmat.py` has solved that
checkerboard out, the master plate above supersedes it entirely. Keeping both
would mean carrying 6.5 MB of redundant binary in git history forever.

## Why three different framings

Android has accumulated three separate ideas of what an app icon is, and still
uses all of them:

- **`icon.png`** — the legacy icon. One square bitmap; the launcher masks it into
  whatever shape it likes. Ball at 84% so a circular mask still clears it.
- **`android-icon-foreground.png`** — the adaptive icon. Both layers are 108dp but
  the launcher only ever displays the **middle 66.7%**, cropping the rest to the
  device's own mask (circle, squircle, teardrop…). Ball at 64% to sit inside that
  safe zone; the outer glow deliberately bleeds past and gets cropped.
- **`android-icon-monochrome.png`** — the Material You themed icon. Android throws
  the colours away entirely and repaints the **alpha channel** in the user's theme
  colour, so the artwork has to live in alpha alone. Reusing the foreground's
  coverage here just fills the safe zone solid and reads as a blob — instead the
  alpha is thresholded on brightness to keep the arcs, core flash and rim, over a
  faint disc that gives it a silhouette.

If you change the monochrome treatment, check it against **both** a light and a
dark theme plate. One that only works on one of the two looks broken half the
time.

## Delivery sizes

Nothing ships at 1024. Each file goes out at the largest size its slot can
actually display — 512 for the legacy icon (also the Play Store's requirement),
512 for the adaptive layers (Android draws them at 432px at xxxhdpi), and 800 for
the splash (`app.json` sizes it at 200dp, ×4 for xxxhdpi). Committed binaries live
in git history forever, so this matters more than it looks.
