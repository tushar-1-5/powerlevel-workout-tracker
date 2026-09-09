"""
Export PowerLevel's Android icon set from the cleaned ki-orb plate.

Input is orb-clean-1024.png -- Tushar's uploaded ki-orb photo with the
screenshot's transparency checker properly un-matted (see 1-unmat.py) and
cropped square about the ball (2-crop.py). In that plate the ball's coverage
holds above 0.8 out to r=445, i.e. the ball is ~87% of the square; the flares
and haze fade out past that and bleed to the edges.

Three exports, because Android treats each icon slot differently:

  icon.png                     Legacy launcher icon (pre-API-26 and assorted
                               fallbacks). Opaque square on the app's own dark
                               background. Launchers apply their own mask, so
                               it keeps a margin.
  android-icon-foreground.png  Adaptive-icon foreground. The launcher shows
                               only the middle 66.7% of this image -- the
                               "safe zone" -- and crops the rest to whatever
                               mask shape the device uses, so the ball is
                               scaled to sit inside that circle. The outer
                               glow deliberately bleeds into the crop zone.
  android-icon-monochrome.png  Themed ("Material You") icon. Android discards
                               the RGB entirely and repaints the alpha channel
                               in the user's theme colour, so the artwork has
                               to live in the alpha channel alone.

Plus splash-icon.png, which app.json sizes explicitly via imageWidth.

Run:  python assets/icon-src/3-export.py   (from the repo root)
"""
from PIL import Image
import numpy as np
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "orb-clean-1024.png")
OUT = os.path.join(HERE, "..", "images")
BG = (10, 10, 11, 255)           # #0A0A0B -- app.json's backgroundColor
N = 1024                         # every export is 1024x1024
BALL_FRAC_IN_SRC = 890.0 / 1024  # measured: ball diameter / plate width

src = np.array(Image.open(SRC).convert("RGBA")).astype(np.float32)
# Premultiplied copy: resizing straight RGBA bleeds the colour of transparent
# pixels into the edges of opaque ones, which shows up as a dark halo.
src_pm = np.concatenate([src[..., :3] * (src[..., 3:4]/255.0), src[..., 3:4]], axis=2)


def place(ball_frac_of_canvas, canvas_rgba=(0, 0, 0, 0)):
    """Scale the plate so the ball is `ball_frac_of_canvas` of a 1024 canvas."""
    size = max(1, int(round(N * ball_frac_of_canvas / BALL_FRAC_IN_SRC)))
    pm = Image.fromarray(np.clip(src_pm, 0, 255).astype(np.uint8), "RGBA")
    pm = np.array(pm.resize((size, size), Image.LANCZOS)).astype(np.float32)

    a = pm[..., 3:4] / 255.0
    solid = a > (6.0/255.0)          # below this, dividing by alpha explodes
    straight = np.where(solid, pm[..., :3] / np.maximum(a, 1e-3), 0.0)
    art = Image.fromarray(
        np.clip(np.concatenate([straight, pm[..., 3:4]*solid], axis=2), 0, 255)
        .astype(np.uint8), "RGBA")

    canvas = Image.new("RGBA", (N, N), canvas_rgba)
    off = (N - size) // 2
    canvas.alpha_composite(art, (off, off))
    return canvas


def export(img, name, size):
    """Downscale the 1024 composition to its delivery size and write it.

    Composition happens at 1024 so the geometry maths above stays in one
    space, but nothing is *shipped* at 1024. Android never renders these
    anywhere near that big, and every byte of a committed binary lives in git
    history forever, so each file goes out at the largest size its slot can
    actually display:

      512  legacy icon        also the size the Play Store asks for
      512  adaptive layers    Android draws these at 432px at xxxhdpi
      800  splash             app.json sizes it at 200dp; x4 for xxxhdpi

    Note this is the only real lever available: Pillow's optimize=True is
    already on, and no dedicated PNG optimiser (oxipng, pngquant) is
    installed, so bytes come off by shrinking dimensions, not by re-encoding.
    """
    if size != N:
        img = img.resize((size, size), Image.LANCZOS)
    img.save(os.path.join(OUT, name), optimize=True)


export(place(0.84, BG).convert("RGB"), "icon.png", 512)
export(place(0.64), "android-icon-foreground.png", 512)
export(place(0.86), "splash-icon.png", 800)

# Themed icon. Simply reusing the foreground's coverage fills the whole safe
# zone with ink and reads as a mud blob -- the ball is opaque nearly
# everywhere, so a single flat colour flattens all of it into one mass. What
# survives the loss of colour is the *bright* structure: the arcs, the core
# flash and the rim. So coverage here is thresholded on brightness to keep
# only those, plus a faint disc under it so the ball still has a body and a
# silhouette instead of floating scribbles.
fg = np.array(place(0.64)).astype(np.float32)
luma = ((0.2126*fg[..., 0] + 0.7152*fg[..., 1] + 0.0722*fg[..., 2]) / 255.0
        * (fg[..., 3] / 255.0))
yy, xx = np.mgrid[0:N, 0:N]
# radius normalised so 1.0 sits on the ball's rim
rad = np.sqrt((yy - (N-1)/2)**2 + (xx - (N-1)/2)**2) / (0.32 * N)
body = np.clip((1.05 - rad) / 0.10, 0, 1)
arcs = np.clip((luma - 0.40) / 0.32, 0, 1)
mono = np.zeros((N, N, 4), np.uint8)
mono[..., :3] = 255
mono[..., 3] = np.clip((arcs + 0.22*body) * 255, 0, 255).astype(np.uint8)
export(Image.fromarray(mono, "RGBA"), "android-icon-monochrome.png", 512)

for f in ("icon.png", "android-icon-foreground.png",
          "android-icon-monochrome.png", "splash-icon.png"):
    p = os.path.join(OUT, f)
    print("%-32s %s %s %6.0f KB" % (f, Image.open(p).size, Image.open(p).mode,
                                    os.path.getsize(p)/1024))
