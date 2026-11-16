import json
import math
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "sprites")
PREVIEW = os.path.join(ROOT, "tools", "preview")

FW, FH = 24, 32          # frame size in pixels
GROUND = 31              # y of the feet

# ---------------------------------------------------------------- helpers


def hexc(h):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


class Frame:
    def __init__(self, w=None, h=None):
        self.w = w or FW
        self.h = h or FH
        self.img = Image.new("RGBA", (self.w, self.h), (0, 0, 0, 0))
        self.px = self.img.load()

    def put(self, x, y, c):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = c

    def line(self, a, b, c, thick=1):
        x0, y0 = a
        x1, y1 = b
        steps = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for i in range(steps + 1):
            t = i / max(steps, 1)
            x = x0 + (x1 - x0) * t
            y = y0 + (y1 - y0) * t
            self.put(x, y, c)
            if thick == 2:
                self.put(x + 1, y, c)

    def rect(self, x, y, w, h, c):
        for yy in range(h):
            for xx in range(w):
                self.put(x + xx, y + yy, c)

    def disc(self, cx, cy, r, c):
        for yy in range(-r, r + 1):
            for xx in range(-r, r + 1):
                if xx * xx + yy * yy <= r * r + r * 0.6:
                    self.put(cx + xx, cy + yy, c)

    def bitmap(self, x, y, rows, palette):
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch in palette:
                    self.put(x + i, y + j, palette[ch])

    def outline(self, c):
        """Any empty pixel touching a filled pixel (4-way) becomes outline."""
        src = self.img.copy().load()
        for y in range(self.h):
            for x in range(self.w):
                if src[x, y][3] == 0:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < self.w and 0 <= ny < self.h and src[nx, ny][3] > 0 \
                                and src[nx, ny] != c:
                            self.px[x, y] = c
                            break


def polar(origin, length, deg):
    """deg = 0 points straight down, positive swings forward (right)."""
    r = math.radians(deg)
    return (origin[0] + math.sin(r) * length, origin[1] + math.cos(r) * length)


def limb(f, root, l1, a1, l2, a2, col, thick=1, joint=None):
    mid = polar(root, l1, a1)
    end = polar(mid, l2, a2)
    f.line(root, mid, col, thick)
    f.line(mid, end, col, thick)
    if joint:
        f.put(*mid, joint)
    return mid, end


def build_sheet(name, anims, outline_col):
    """anims: list of (anim_name, [Frame,...], fps, loop)"""
    cols = max(len(fr) for _, fr, _, _ in anims)
    fw, fh = anims[0][1][0].w, anims[0][1][0].h
    sheet = Image.new("RGBA", (cols * fw, len(anims) * fh), (0, 0, 0, 0))
    meta = {"image": f"{name}.png", "frameWidth": fw, "frameHeight": fh,
            "facing": "right", "animations": {}}
    for row, (aname, frames, fps, loop) in enumerate(anims):
        for col, fr in enumerate(frames):
            if outline_col:
                fr.outline(outline_col)
            sheet.paste(fr.img, (col * fw, row * fh))
        meta["animations"][aname] = {"row": row, "frames": len(frames),
                                     "fps": fps, "loop": loop}
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(PREVIEW, exist_ok=True)
    sheet.save(os.path.join(OUT, f"{name}.png"))
    with open(os.path.join(OUT, f"{name}.json"), "w") as fh:
        json.dump(meta, fh, indent=2)
    big = sheet.resize((sheet.width * 8, sheet.height * 8), Image.NEAREST)
    bg = Image.new("RGBA", big.size, hexc("#2a2f45"))
    bg.alpha_composite(big)
    bg.save(os.path.join(PREVIEW, f"{name}_x8.png"))
    print(f"wrote {name}: {len(anims)} animations, {cols} columns")


# ================================================================ SKELETON
BONE = hexc("#ece4cc")
BONE_SH = hexc("#b5a98a")
BONE_OUT = hexc("#2b2418")
SOCKET = hexc("#120c08")
EYE = hexc("#ff4a2a")
BRONZE = hexc("#c98b36")
BRONZE_HI = hexc("#f0c060")
BRONZE_DK = hexc("#7e5418")
IRON = hexc("#c8d0d8")
IRON_DK = hexc("#7d8790")

SKULL = [
    "..BBBB.",
    ".BBBBBB",
    "BBBBBBB",
    "BBBBKKB",
    "BBBBKEB",
    ".BBBBBB",
    "..BTBTB",
    "..BBBB.",
]
# Hoplite-style crest on the skull (bronze helmet remnant)
CREST = [
    ".RRRR..",
    "RRRRRRR",
]
SKULL_PAL = {"B": BONE, "K": SOCKET, "E": EYE, "T": BONE_SH}


def skeleton(pose):
    """pose keys: hip(y offset), lean, nf/nk (near leg thigh/shin angles),
    ff/fk (far leg), sa/se (sword arm upper/lower), sh (shield arm angle),
    sword (sword angle), skull_dx/dy, parts_drop (collapse)"""
    f = Frame()
    bob = pose.get("bob", 0)
    hipx = 11 + pose.get("hipdx", 0)
    hipy = 20 + bob + pose.get("hipdy", 0)
    lean = pose.get("lean", 0)
    neck = (hipx + lean, hipy - 10)
    shoulder = (neck[0], neck[1] + 1)

    # far leg
    limb(f, (hipx - 1, hipy), 5, pose["ff"], 6, pose["fk"], BONE_SH)
    # far arm + sword
    _, hand = limb(f, shoulder, 4, pose["sa"], 4, pose["se"], BONE_SH)
    tip = polar(hand, 8, pose["sword"])
    f.line(hand, tip, IRON)
    guard_a = polar(hand, 1.5, pose["sword"] + 90)
    guard_b = polar(hand, 1.5, pose["sword"] - 90)
    f.line(guard_a, guard_b, BRONZE_DK)

    # spine + ribs + pelvis
    f.line(neck, (hipx, hipy), BONE)
    for i, ry in enumerate((2, 4, 6)):
        cx = neck[0] + (hipx - neck[0]) * ry / 10
        w = 3 if i < 2 else 2
        f.line((cx - w, neck[1] + ry), (cx + w, neck[1] + ry), BONE)
    f.line((hipx - 2, hipy), (hipx + 2, hipy), BONE)
    f.put(hipx - 2, hipy - 1, BONE)
    f.put(hipx + 2, hipy - 1, BONE)

    # skull + crest
    sx = int(round(neck[0])) - 3 + pose.get("skull_dx", 0)
    sy = int(round(neck[1])) - 7 + pose.get("skull_dy", 0)
    f.bitmap(sx, sy - 2, CREST, {"R": BRONZE})
    f.bitmap(sx, sy, SKULL, SKULL_PAL)

    # near leg
    _, foot = limb(f, (hipx + 1, hipy), 5, pose["nf"], 6, pose["nk"], BONE)
    f.line(foot, (foot[0] + 2, foot[1]), BONE)

    # near arm + round shield (aspis)
    _, shand = limb(f, shoulder, 4, pose["sh"], 3, pose["sh"] - 40, BONE)
    cx, cy = shand[0] + 1, shand[1] - 1
    f.disc(cx, cy, 4, BRONZE)
    f.disc(cx - 1, cy - 1, 1, BRONZE_HI)
    f.put(cx + 2, cy + 2, BRONZE_DK)
    f.put(cx + 3, cy + 1, BRONZE_DK)
    f.put(cx + 1, cy + 3, BRONZE_DK)
    return f


def skeleton_pile(stage):
    """Collapse stages 0..4 — bones dropping into a heap. Reversed = rise."""
    if stage == 0:
        return skeleton(dict(ff=-10, fk=10, nf=10, nk=-5, sa=50, se=90,
                             sword=100, sh=40, lean=-1))
    if stage == 1:
        return skeleton(dict(ff=-40, fk=20, nf=50, nk=-20, sa=20, se=40,
                             sword=150, sh=10, hipdy=3, lean=-2, skull_dy=1))
    if stage == 2:
        return skeleton(dict(ff=-80, fk=-10, nf=80, nk=10, sa=-10, se=10,
                             sword=170, sh=-20, hipdy=7, lean=2, skull_dx=2,
                             skull_dy=3))
    f = Frame()
    if stage == 3:
        # loose heap: bones criss-crossed, skull on top, shield leaning
        for a, b, c in (((4, 30), (12, 27), BONE), ((8, 31), (17, 28), BONE_SH),
                        ((10, 29), (19, 31), BONE), ((6, 27), (14, 30), BONE_SH),
                        ((13, 26), (20, 29), BONE)):
            f.line(a, b, c)
        f.line((2, 31), (10, 31), IRON)
        f.disc(18, 26, 4, BRONZE)
        f.disc(17, 25, 1, BRONZE_HI)
        f.bitmap(7, 19, CREST, {"R": BRONZE})
        f.bitmap(7, 21, SKULL, SKULL_PAL)
    else:
        # flat heap
        for a, b, c in (((3, 31), (13, 30), BONE), ((7, 31), (18, 31), BONE_SH),
                        ((11, 30), (20, 31), BONE), ((5, 29), (14, 31), BONE)):
            f.line(a, b, c)
        f.line((1, 31), (9, 31), IRON)
        f.disc(19, 29, 3, BRONZE)
        f.bitmap(9, 24, SKULL, {"B": BONE, "K": SOCKET, "E": SOCKET,
                                "T": BONE_SH})
    return f


def make_skeleton():
    walk_legs = [  # (near thigh, near shin, far thigh, far shin, bob)
        (25, 5, -22, -5, 0),
        (5, -15, 5, 25, -1),
        (-22, -5, 25, 5, 0),
        (5, 25, 5, -15, -1),
    ]
    walk = []
    for i, (nf, nk, ff, fk, bob) in enumerate(walk_legs):
        swing = 15 if i in (0, 3) else -10
        walk.append(skeleton(dict(nf=nf, nk=nk, ff=ff, fk=fk, bob=bob,
                                  sa=40 - swing, se=80, sword=95 - swing / 2,
                                  sh=50 + swing)))
    attack = [
        skeleton(dict(nf=15, nk=0, ff=-15, fk=0, sa=160, se=200,
                      sword=200, sh=60, lean=-1)),            # wind-up
        skeleton(dict(nf=25, nk=5, ff=-20, fk=-5, sa=120, se=150,
                      sword=160, sh=70)),                       # raise
        skeleton(dict(nf=35, nk=10, ff=-25, fk=-10, sa=80, se=90,
                      sword=90, sh=30, lean=2)),               # thrust
    ]
    collapse = [skeleton_pile(i) for i in range(5)]
    build_sheet("skeleton", [
        ("walk", walk, 8, True),
        ("attack", attack, 10, False),
        ("collapse", collapse, 10, False),   # play reversed for "rise"
    ], BONE_OUT)


# ================================================================ SALLY
# Sally Miller, 1992: brunette, red flannel over a black tee, ripped jeans,
# black Doc Martens.
SKIN = hexc("#e6b48e")
SKIN_SH = hexc("#b8805c")
HAIR = hexc("#4a2a1a")
HAIR_HI = hexc("#6e4228")
FLANNEL = hexc("#a32a2a")
FLANNEL_DK = hexc("#4a1214")
FLANNEL_SH = hexc("#6e1c1e")
TEE = hexc("#1c1a20")
DENIM = hexc("#4f6f9a")
DENIM_SH = hexc("#34496a")
RIP = hexc("#d8dde4")
BOOT = hexc("#141216")
BOOT_HI = hexc("#3a3640")
SALLY_OUT = hexc("#0c0a10")
EYE_S = hexc("#1a1018")

SALLY_HEAD = [
    "HG.....",
    "HHHHHH.",
    "HHGHHHH",
    "HHHHSSS",
    "HHHSSES",
    "HHHSSSS",
    "HH.SSS.",
    "HH.....",
    "H......",
]
SALLY_HEAD_BACK = [
    ".HHHH..",
    "HHGHHH.",
    "HHHHHHH",
    "HHHHHHH",
    "HHHHHHH",
    "HHHHHHH",
    "HHHHHH.",
    ".HHHH..",
    "..HH...",
]
SALLY_PAL = {"H": HAIR, "G": HAIR_HI, "S": SKIN, "E": EYE_S}


def sally_leg(f, hip, a1, a2, denim, near):
    knee, foot = limb(f, hip, 5, a1, 6, a2, denim, thick=2 if near else 1)
    # boot: lower part of the shin plus a chunky toe
    ankle = polar(knee, 4, a2)
    f.line(ankle, foot, BOOT, 2 if near else 1)
    f.line(foot, (foot[0] + 2, foot[1]), BOOT)
    f.put(foot[0] + 1, foot[1] - 1, BOOT_HI if near else BOOT)
    if near:
        f.put(knee[0], knee[1], RIP)       # ripped knee
    return foot


def sally_arm(f, shoulder, a1, a2, sleeve, hand):
    _, end = limb(f, shoulder, 4, a1, 3, a2, sleeve)
    tip = polar(end, 1.5, a2)
    f.put(tip[0], tip[1], hand)


def sally(pose):
    f = Frame()
    bob = pose.get("bob", 0)
    hipx, hipy = 12, 20 + bob + pose.get("hipdy", 0)
    lean = pose.get("lean", 0)
    sh = (hipx + lean, hipy - 8)
    back = pose.get("back", False)

    # far leg / arm (shaded)
    sally_leg(f, (hipx - 1, hipy), pose["ff"], pose["fk"], DENIM_SH, False)
    sally_arm(f, sh, pose["fa"], pose["fe"], FLANNEL_SH, SKIN_SH)

    # torso: open flannel over a black tee, shirt tails past the hip
    tx = int(round(sh[0])) - 2
    ty = int(round(sh[1]))
    f.rect(tx, ty, 5, 9, FLANNEL)
    for yy in (2, 5, 8):                      # check pattern
        f.rect(tx, ty + yy, 5, 1, FLANNEL_DK)
    f.put(tx + 1, ty + 1, FLANNEL_DK); f.put(tx + 1, ty + 4, FLANNEL_DK); f.put(tx + 1, ty + 7, FLANNEL_DK)
    if not back:
        f.rect(tx + 3, ty + 1, 2, 7, TEE)     # tee showing at the front
        f.put(tx + 3, ty, SKIN)               # neck
    f.rect(tx - 1, ty + 9, 6, 1, FLANNEL)     # tails
    f.put(tx - 1, ty + 9, FLANNEL_DK)

    # head (hair down the back, a loose bun)
    hx, hy = tx - 2 + pose.get("head_dx", 0), ty - 8
    f.bitmap(hx, hy, SALLY_HEAD_BACK if back else SALLY_HEAD, SALLY_PAL)

    # near leg / arm
    sally_leg(f, (hipx + 1, hipy), pose["nf"], pose["nk"], DENIM, True)
    sally_arm(f, sh, pose["na"], pose["ne"], FLANNEL, SKIN)
    return f


def make_sally():
    idle = [
        sally(dict(nf=4, nk=0, ff=-4, fk=0, na=8, ne=10, fa=-8, fe=-5)),
        sally(dict(nf=4, nk=0, ff=-4, fk=0, na=10, ne=16, fa=-6, fe=-2)),
    ]
    legs = [(28, 8, -25, -8, 0), (5, -25, 5, 30, -1),
            (-25, -8, 28, 8, 0), (5, 30, 5, -25, -1)]
    walk = []
    for i, (nf, nk, ff, fk, bob) in enumerate(legs):
        sw = 25 if i in (0, 1) else -25
        walk.append(sally(dict(nf=nf, nk=nk, ff=ff, fk=fk, bob=bob,
                               na=-sw, ne=-sw + 20, fa=sw, fe=sw + 20)))
    jump = [sally(dict(nf=50, nk=-30, ff=-20, fk=-50, na=125, ne=100,
                       fa=-60, fe=-95, hipdy=-1))]
    fall = [sally(dict(nf=15, nk=10, ff=-10, fk=5, na=95, ne=115,
                       fa=-95, fe=-115))]
    climb = [
        sally(dict(nf=30, nk=0, ff=0, fk=0, na=160, ne=178, fa=-100,
                   fe=-175, back=True)),
        sally(dict(nf=0, nk=0, ff=-30, fk=0, na=100, ne=175, fa=-160,
                   fe=-178, back=True)),
    ]
    build_sheet("sally", [
        ("idle", idle, 2, True),
        ("walk", walk, 10, True),
        ("jump", jump, 1, False),
        ("fall", fall, 1, False),
        ("climb", climb, 6, True),
    ], SALLY_OUT)



# ================================================================ CHARON
ROBE = hexc("#2a2622")
ROBE_SH = hexc("#1a1714")
ROBE_HI = hexc("#3c3630")
VOID = hexc("#050405")
EMBER = hexc("#e8d8a0")
BONE_HAND = hexc("#cfc4a8")
POLE = hexc("#5a4630")
POLE_HI = hexc("#7a6244")


def charon(pole_top, pole_bottom, hand_y, sway=0):
    """Hooded ferryman, facing right, holding his pole in both hands."""
    f = Frame()
    # pole behind the body
    f.line(pole_top, pole_bottom, POLE)
    f.line((pole_top[0] + 1, pole_top[1]), (pole_bottom[0] + 1, pole_bottom[1]), POLE_HI)
    # robe: a tall cone widening to the hem
    for y in range(9, 31):
        t = (y - 9) / 22
        half = 3 + t * 5
        cx = 11 + sway * t
        for x in range(int(cx - half), int(cx + half) + 1):
            col = ROBE_SH if x < cx - half + 2 else ROBE_HI if x > cx + half - 1.5 else ROBE
            f.put(x, y, col)
    for x in range(4, 20, 3):                      # ragged hem
        f.put(x + sway, 31, ROBE_SH)
    # hood
    f.bitmap(7, 2, [
        "..RRRR..",
        ".RRRRRR.",
        "RRRRRRRR",
        "RRRVVVVR",
        "RRRVEVER",
        "RRRVVVVR",
        "RRRRVVR.",
        ".RRRRR..",
    ], {"R": ROBE, "V": VOID, "E": EMBER})
    # arms reaching to the pole, bony hands
    for hy in (hand_y, hand_y + 5):
        px_ = pole_top[0] + (pole_bottom[0] - pole_top[0]) * (hy - pole_top[1]) / (pole_bottom[1] - pole_top[1])
        f.line((12, 12 if hy == hand_y else 15), (px_, hy), ROBE_HI)
        f.put(px_, hy, BONE_HAND)
        f.put(px_ + 1, hy, BONE_HAND)
    return f


def make_charon():
    idle = [charon((19, 0), (5, 31), 13, 0), charon((19, 0), (5, 31), 14, 1)]
    pole = [
        charon((20, 0), (8, 31), 10, 0),
        charon((18, 0), (3, 31), 13, 1),
        charon((15, 1), (0, 31), 16, 1),
        charon((18, 0), (4, 31), 14, 0),
    ]
    build_sheet("charon", [("idle", idle, 2, True), ("pole", pole, 5, True)], hexc("#000000"))


# ================================================================ SHADE
def shade(phase):
    """A translucent shade of the dead: hood, reaching arms, wisps for legs."""
    f = Frame()
    body = (150, 170, 190, 150)
    body_dk = (95, 110, 130, 140)
    body_hi = (200, 215, 230, 170)
    bob = round(math.sin(phase * math.pi / 2))
    oy = 4 + bob
    # hood + head
    f.bitmap(8, oy, [
        "..BBBB..",
        ".BBBBBB.",
        "BBHVVVBB",
        "BBVEVEVB",
        "BBVVVVVB",
        ".BBVVBB.",
    ], {"B": body, "H": body_hi, "V": (8, 10, 16, 220), "E": (200, 230, 255, 255)})
    # body tapering down into wisps
    for y in range(oy + 6, 30):
        t = (y - oy - 6) / (30 - oy - 6)
        half = 5 - t * 3
        cx = 12 + math.sin(t * 3 + phase) * 2
        for x in range(int(cx - half), int(cx + half) + 1):
            col = body_dk if x < cx - half + 1.5 else body
            if (x + y + phase) % 7 == 0:
                col = body_hi
            f.put(x, y, col)
    for k in range(3):                               # trailing wisps
        x0 = 9 + k * 3
        for y in range(26, 32):
            f.put(x0 + math.sin(y / 2 + phase + k) * 1.5, y, body_dk)
    # arms reaching forward
    reach = 3 + (phase % 2)
    f.line((14, oy + 8), (19 + reach, oy + 11), body)
    f.line((14, oy + 10), (18 + reach, oy + 14), body_dk)
    f.put(20 + reach, oy + 11, body_hi)
    return f


def make_shade():
    build_sheet("shade", [("drift", [shade(i) for i in range(4)], 6, True)], None)


# ================================================================ CERBERUS
FUR = hexc("#1c1a1c")
FUR_HI = hexc("#34303a")
FUR_SH = hexc("#0e0c0e")
EYE_R = hexc("#ff3a1a")
FANG = hexc("#e8e0cc")
SNAKE = hexc("#2c4a2a")
SNAKE_HI = hexc("#4a6e3a")

DOG_HEAD = [
    ".FFF...",
    "FFFFFF.",
    "FFERFFF",
    "FFFFFFF",
    ".FFWFWF",
]


def cerberus(legs, body_dy=0, heads=((0, 0), (0, 0), (0, 0)), lying=False, tail=0):
    """Three-headed hound of Hades with a serpent for a tail (Apollodorus)."""
    f = Frame(44, 28)
    by = 12 + body_dy + (5 if lying else 0)
    # serpent tail behind
    tx, ty = 7, by + 1
    for i in range(8):
        nx = tx - 1
        ny = ty - 1 + round(math.sin(i * 0.9 + tail) * 1.2)
        f.line((tx, ty), (nx, ny), SNAKE)
        tx, ty = nx, ny
    f.put(tx - 1, ty, SNAKE_HI)
    f.put(tx - 2, ty, SNAKE_HI)
    f.put(tx - 2, ty - 1, EYE_R)
    # far legs
    if not lying:
        for (hx, a1, a2) in (legs[1], legs[3]):
            limb(f, (hx, by + 7), 4, a1, 4, a2, FUR_SH, thick=2)
    # body: a broad, muscular barrel
    for y in range(by, by + 9):
        t = abs(y - (by + 4)) / 4.5
        half = 12 * math.sqrt(max(0, 1 - t * t))
        for x in range(int(20 - half), int(20 + half) + 1):
            col = FUR_HI if y == by or (y == by + 1 and x % 3 == 0) else FUR
            if y >= by + 7:
                col = FUR_SH
            f.put(x, y, col)
    # serpents in the mane
    for k, sx in enumerate((22, 25, 28)):
        f.line((sx, by), (sx - 1 + (k % 2) * 2, by - 3), SNAKE)
        f.put(sx - 1 + (k % 2) * 2, by - 4, SNAKE_HI)
    # near legs
    if lying:
        f.line((10, by + 8), (17, by + 8), FUR_SH, 2)
        f.line((24, by + 8), (33, by + 8), FUR, 2)
    else:
        for (hx, a1, a2) in (legs[0], legs[2]):
            _, foot = limb(f, (hx, by + 7), 4, a1, 4, a2, FUR, thick=2)
            f.put(foot[0] + 2, foot[1], FUR_SH)
    # three necks and heads at the front
    bases = [(29, by + 1), (31, by + 3), (29, by + 5)]
    anchors = [(31, by - 6), (35, by - 2), (32, by + 2)]
    if lying:
        anchors = [(32, by - 2), (35, by + 1), (32, by + 4)]
    for i in (0, 2, 1):                              # middle head drawn last, in front
        (bx, byy), (ax, ay), (dx, dy) = bases[i], anchors[i], heads[i]
        hx, hy = ax + dx, ay + dy
        f.line((bx, byy), (hx + 1, hy + 2), FUR_HI if i == 1 else FUR, 2)
        f.bitmap(int(hx), int(hy), DOG_HEAD, {"F": FUR_HI if i == 1 else FUR, "E": EYE_R, "R": EYE_R, "W": FANG})
    return f


def make_cerberus():
    stand = [(12, 5, -5), (14, -5, 5), (27, 5, -5), (29, -5, 5)]
    idle = [
        cerberus(stand, 0, ((0, 0), (0, 0), (0, 0)), tail=0),
        cerberus(stand, 0, ((0, -1), (1, 0), (0, 1)), tail=1.5),
    ]
    gallop = [
        [(12, 35, 10), (14, -30, -10), (27, -30, 5), (29, 35, 10)],
        [(12, 10, -10), (14, 5, 0), (27, 10, -20), (29, -5, 10)],
        [(12, -30, -10), (14, 35, 10), (27, 35, 10), (29, -30, 5)],
        [(12, 5, 0), (14, 10, -10), (27, -5, 10), (29, 10, -20)],
    ]
    run = [cerberus(l, (-1 if i % 2 else 0), ((1, -1), (2, 0), (1, 1)), tail=i) for i, l in enumerate(gallop)]
    rest = [cerberus(stand, 0, ((0, 0), (0, 0), (0, 0)), lying=True, tail=0.5)]
    build_sheet("cerberus", [("idle", idle, 3, True), ("run", run, 12, True), ("rest", rest, 1, False)], hexc("#000000"))


if __name__ == "__main__":
    make_skeleton()
    make_sally()
    make_charon()
    make_shade()
    make_cerberus()
