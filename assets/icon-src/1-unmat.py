"""
Recover a clean RGBA ki-orb from the checkerboard screenshot.

The upload (user-upload-latest.png) is a screen grab of a transparent PNG
displayed over a grey transparency checker. Keying it by luminance -- which is
what produced orb-crop-1024.png -- cannot separate art from checker: the two
checker tones straddle the brightness of the faint outer haze, so the grid
survives at low alpha. Invisible in isolation, obvious once composited onto a
flat dark icon background.

This does it properly, in two steps.

1. Fit the checker exactly. It is a perfectly neutral two-tone grid, so a
   least-squares fit over background-only patches recovers its period, phase,
   mean and amplitude to within ~2.4 grey levels across the whole frame.

2. Read coverage off the checker's own visibility. For art of colour F at
   coverage a over checker C:

       result = F*a + C*(1-a)

   so the amplitude of the checker's swing that survives at a given pixel is
   exactly (1-a) times its amplitude in open background. Correlating the image
   against the fitted grid over a one-period window measures that swing
   directly -- and unlike a luminance or chroma key it is correct for dark
   purple haze and blown-out white core alike. The estimate is smooth at the
   56px checker scale, so it is combined with a plain brightness key that
   pins the (certainly opaque) lightning arcs back to a=1.

With a known, the foreground is just result - C*(1-a).
"""
from PIL import Image
import numpy as np
import sys

# The original 6.5 MB upload is deliberately NOT in the repo (see README.md
# here) — orb-clean-1024.png is the committed source of truth. Pass the
# screenshot explicitly if you ever need to redo this step from scratch.
if len(sys.argv) < 2:
    sys.exit("usage: python 1-unmat.py <checkerboard-screenshot.png>\n"
             "  The original upload is not committed; see this folder's "
             "README.md. Normally you only need 3-export.py.")
SRC = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else "orb-clean-full.png"

rgb = np.array(Image.open(SRC).convert("RGB")).astype(np.float32)
H, W, _ = rgb.shape
lum = rgb.mean(axis=2)

# --- 1. fit the checker ---------------------------------------------------
P, X0, Y0, K = 56.55, 41.867, 41.713, 12.0     # from fitgrid2.py
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
S = (np.clip(np.cos(2*np.pi*(xx-X0)/P)*K, -1, 1) *
     np.clip(np.cos(2*np.pi*(yy-Y0)/P)*K, -1, 1))

bg = np.zeros((H, W), bool)                    # background-only patches
bg[0:340, 0:340] = True; bg[0:340, W-340:] = True; bg[H-340:, 0:340] = True
b = bg
C_MEAN = float(lum[b].mean())
AMP = float((S[b]*(lum[b]-C_MEAN)).sum() / (S[b]*S[b]).sum())
C = C_MEAN + AMP*S
print("checker: mean=%.2f amp=%.2f  residual rms=%.2f"
      % (C_MEAN, AMP, float(((lum[b]-C[b])**2).mean())**0.5))

# --- 2. coverage from the checker's surviving swing -----------------------
def box(img, r):
    """Mean over a (2r+1)^2 window, via an integral image."""
    pad = np.pad(img.astype(np.float64), r, mode="edge")
    ii = np.zeros((pad.shape[0]+1, pad.shape[1]+1))
    ii[1:, 1:] = pad.cumsum(0).cumsum(1)
    n = 2*r + 1
    tot = ii[n:, n:] - ii[:-n, n:] - ii[n:, :-n] + ii[:-n, :-n]
    return (tot / (n*n)).astype(np.float32)

R = 28                                          # one full checker period
s2 = box(S*S, R)
swing = box(lum*S, R) - box(lum, R)*box(S, R)   # covariance with the grid
a_grid = np.clip(1.0 - (swing / np.maximum(s2, 1e-6)) / AMP, 0, 1)

# anything far brighter than the brightest checker tone is certainly opaque
a_bright = np.clip((lum - (C_MEAN + abs(AMP)) - 8.0) / 40.0, 0, 1)
a = np.maximum(a_grid, a_bright)

# --- 3. lift the checker back out -----------------------------------------
a3 = a[..., None]
premult = np.clip(rgb - C[..., None]*(1.0 - a3), 0, 255)
straight = np.where(a3 > 0.02, premult/np.maximum(a3, 0.02), 0.0)
out = np.clip(np.concatenate([straight, a3*255], axis=2), 0, 255).astype(np.uint8)
Image.fromarray(out, "RGBA").save(OUT)
print("coverage: %.1f%% clear, %.1f%% solid" % (100*(a < 0.01).mean(), 100*(a > 0.99).mean()))

im = Image.open(OUT).convert("RGBA")
comp = Image.alpha_composite(Image.new("RGBA", im.size, (10, 10, 11, 255)), im)
comp.convert("RGB").resize((785, 597), Image.LANCZOS).save("clean-preview.png")
