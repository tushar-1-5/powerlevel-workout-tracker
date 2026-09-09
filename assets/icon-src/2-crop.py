"""Find the ball in the cleaned plate and cut a square where it is 87% wide."""
from PIL import Image
import numpy as np

im = Image.open("orb-clean-full.png").convert("RGBA")
A = np.array(im)[..., 3].astype(np.float32) / 255.0
H, W = A.shape

def box(img, r):
    pad = np.pad(img.astype(np.float64), r, mode="constant")
    ii = np.zeros((pad.shape[0]+1, pad.shape[1]+1)); ii[1:, 1:] = pad.cumsum(0).cumsum(1)
    n = 2*r+1
    return ((ii[n:, n:] - ii[:-n, n:] - ii[n:, :-n] + ii[:-n, :-n]) / (n*n)).astype(np.float32)

# erode hard: only the body of the ball stays solid inside an 81px window,
# the flares and arcs are too thin to survive
core = box((A > 0.85).astype(np.float32), 40) > 0.95
ys, xs = np.where(core)
cx, cy = (xs.min()+xs.max())/2, (ys.min()+ys.max())/2
print("core bbox x %d..%d  y %d..%d" % (xs.min(), xs.max(), ys.min(), ys.max()))

# radial profile of coverage about that centre -> the rim
yy, xx = np.mgrid[0:H, 0:W]
r = np.sqrt((yy-cy)**2 + (xx-cx)**2)
rb = (r/4).astype(int)
prof = np.bincount(rb.ravel(), weights=A.ravel()) / np.bincount(rb.ravel())
rim = next(i for i, v in enumerate(prof) if v < 0.80) * 4
print("centre (%.1f, %.1f)  rim radius ~%d  (profile %s)"
      % (cx, cy, rim, np.round(prof[max(0,rim//4-3):rim//4+4], 2)))

half = int(round(rim / 0.87))          # ball spans 87% of the crop
box_ = (int(cx-half), int(cy-half), int(cx+half), int(cy+half))
print("crop", box_, "size", 2*half, "-> watermark at (2100,1546) inside?",
      box_[0] <= 2100 <= box_[2] and box_[1] <= 1546 <= box_[3])
canvas = Image.new("RGBA", (2*half, 2*half), (0, 0, 0, 0))
canvas.alpha_composite(im, (-box_[0], -box_[1]))
canvas.resize((1024, 1024), Image.LANCZOS).save("orb-clean-1024.png")
print("saved orb-clean-1024.png; ball is %.3f of the frame" % (2*rim/(2*half)))
