"""
Kinesin-1 walking along a microtubule — procedural Blender build + animation.

Units: 1 Blender unit = 1 nm.  Microtubule axis = +X (plus end at +X), Z = up.
Run inside Blender (e.g. via the MCP bridge):  exec(open(PATH).read())
Produces: kinesin.blend, web/public/models/kinesin.glb, web/public/models/timeline.json
"""
import bpy, bmesh, math, random, json, os
import numpy as np
from mathutils import Vector, Matrix, Quaternion, Euler, noise

ROOT = "/Users/sim/Documents/fortbildungAI/kinesinwalking"
GLB_PATH = os.path.join(ROOT, "web/public/models/kinesin.glb")
TIMELINE_PATH = os.path.join(ROOT, "web/public/models/timeline.json")
BLEND_PATH = os.path.join(ROOT, "blender/kinesin.blend")

FPS = 30
T = 72            # frames per 8-nm step
N_STEPS = 10
F_END = N_STEPS * T

# microtubule lattice
N_PF = 13
R_PF = 10.0                 # radius of protofilament centre line
MON_AX, MON_TAN, MON_RAD = 1.95, 2.3, 2.55   # monomer half-extents
TRACK_PF = 6                # kinesin walks on this protofilament (top)
K_MIN, K_MAX = -32, 31      # monomer indices along each protofilament (4 nm each)

Z_TOP = R_PF + MON_RAD      # outer surface of the lattice at the track
Z_B = Z_TOP + 2.05          # bound motor-head centre height
XF0 = 8 * -6 + 3.0          # first front-head binding site (dimer -6, on beta)

rng = random.Random(7)

# --------------------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------------------
def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def make_mat(name, hexcol, rough=0.45, metal=0.0, coat=0.0, sss=0.0, emit=0.0, alpha=1.0, sheen=0.0):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    b = m.node_tree.nodes.get("Principled BSDF")
    col = srgb(hexcol)
    b.inputs["Base Color"].default_value = (*col, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if coat:
        b.inputs["Coat Weight"].default_value = coat
    if sss:
        b.inputs["Subsurface Weight"].default_value = sss
        b.inputs["Subsurface Radius"].default_value = (0.8, 0.4, 0.3)
        b.inputs["Subsurface Scale"].default_value = 0.6
    if sheen:
        b.inputs["Sheen Weight"].default_value = sheen
    if emit:
        b.inputs["Emission Color"].default_value = (*col, 1)
        b.inputs["Emission Strength"].default_value = emit
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
        try:
            m.surface_render_method = "BLENDED"
        except Exception:
            pass
    m.diffuse_color = (*col, alpha)
    return m


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def smoother(t):
    t = max(0.0, min(1.0, t))
    return t * t * t * (t * (t * 6 - 15) + 10)


def jit(t, seed, freq=0.09):
    """Smooth noise that is periodic over the whole clip (seamless loop)."""
    R = F_END * freq / (2 * math.pi)
    a = 2 * math.pi * t / F_END
    cx, cy = R * math.cos(a), R * math.sin(a)
    return Vector((noise.noise(Vector((cx, cy, seed))),
                   noise.noise(Vector((cx + 17.3, cy, seed + 4.7))),
                   noise.noise(Vector((cx, cy + 41.9, seed + 9.1)))))


def new_obj(name, mesh, parent=None, coll=None):
    o = bpy.data.objects.new(name, mesh)
    (coll or bpy.context.scene.collection).objects.link(o)
    if parent:
        o.parent = parent
    return o


def mesh_from_arrays(name, verts, faces, smooth_shade=True):
    me = bpy.data.meshes.new(name)
    verts = np.asarray(verts, dtype=np.float32).reshape(-1, 3)
    faces = np.asarray(faces, dtype=np.int32).reshape(-1, 3)
    me.vertices.add(len(verts))
    me.vertices.foreach_set("co", verts.ravel())
    me.loops.add(faces.size)
    me.loops.foreach_set("vertex_index", faces.ravel())
    me.polygons.add(len(faces))
    me.polygons.foreach_set("loop_start", np.arange(0, faces.size, 3, dtype=np.int32))
    me.update(calc_edges=True)
    me.validate()
    if smooth_shade:
        me.shade_smooth()
    return me


def bm_arrays(bm):
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.verts.index_update()
    v = np.array([vv.co[:] for vv in bm.verts], dtype=np.float32)
    f = np.array([[vv.index for vv in ff.verts] for ff in bm.faces], dtype=np.int32)
    return v, f


def blob_arrays(radii, lobes=(), amp=0.25, freq=1.6, subdiv=4, seed=0.0, octaves=3):
    """Organic protein-like blob: ellipsoid + directional lobes + fractal noise."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    off = Vector((seed * 3.1, seed * 1.7, seed * 2.3))
    for v in bm.verts:
        d = v.co.normalized()
        p = Vector((d.x * radii[0], d.y * radii[1], d.z * radii[2]))
        s = 0.0
        for ldir, lamp, k in lobes:
            s += lamp * max(0.0, d.dot(Vector(ldir).normalized())) ** k
        n = noise.fractal(d * freq + off, 0.6, 2.1, octaves)
        v.co = p + d * (s + amp * n)
    arr = bm_arrays(bm)
    bm.free()
    return arr


def blob_mesh(name, *a, **k):
    v, f = blob_arrays(*a, **k)
    return mesh_from_arrays(name, v, f)


def transform_arrays(v, M):
    M = np.array(M, dtype=np.float32)
    return v @ M[:3, :3].T + M[:3, 3]


def merge_arrays(parts):
    vs, fs, off = [], [], 0
    for v, f in parts:
        vs.append(v)
        fs.append(f + off)
        off += len(v)
    return np.concatenate(vs), np.concatenate(fs)


def tube_arrays(points, radius, seg=10, cap=True, radii=None):
    """Sweep a circle along a polyline (parallel-transport frames)."""
    pts = [Vector(p) for p in points]
    n = len(pts)
    tang = []
    for i in range(n):
        a = pts[max(i - 1, 0)]
        b = pts[min(i + 1, n - 1)]
        tang.append((b - a).normalized())
    ref = Vector((0, 0, 1)) if abs(tang[0].z) < 0.9 else Vector((1, 0, 0))
    nrm = tang[0].cross(ref).normalized()
    verts, faces = [], []
    for i in range(n):
        if i > 0:
            q = tang[i - 1].rotation_difference(tang[i])
            nrm = (q @ nrm).normalized()
        bin_ = tang[i].cross(nrm)
        r = radii[i] if radii else radius
        for j in range(seg):
            a = 2 * math.pi * j / seg
            verts.append(pts[i] + (nrm * math.cos(a) + bin_ * math.sin(a)) * r)
    for i in range(n - 1):
        for j in range(seg):
            a = i * seg + j
            b = i * seg + (j + 1) % seg
            c = (i + 1) * seg + (j + 1) % seg
            d = (i + 1) * seg + j
            faces += [(a, b, c), (a, c, d)]
    if cap:
        for end, sgn in ((0, -1), (n - 1, 1)):
            ci = len(verts)
            verts.append(pts[end] + tang[end] * sgn * (radii[end] if radii else radius) * 0.6)
            for j in range(seg):
                a = end * seg + j
                b = end * seg + (j + 1) % seg
                faces.append((ci, b, a) if sgn < 0 else (ci, a, b))
    return np.array([v[:] for v in verts], dtype=np.float32), np.array(faces, dtype=np.int32)


def catmull(points, samples_per_seg=12):
    P = [Vector(p) for p in points]
    P = [P[0] + (P[0] - P[1])] + P + [P[-1] + (P[-1] - P[-2])]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(samples_per_seg):
            t = k / samples_per_seg
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-2])
    return out


# --------------------------------------------------------------------------------------
# reset
# --------------------------------------------------------------------------------------
def reset():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.curves, bpy.data.metaballs,
                 bpy.data.actions, bpy.data.cameras, bpy.data.lights):
        for d in list(coll):
            coll.remove(d)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)


reset()
scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start = 0
scene.frame_end = F_END
scene.unit_settings.system = "NONE"

C_MT = bpy.data.collections.new("Microtubule"); scene.collection.children.link(C_MT)
C_KIN = bpy.data.collections.new("Kinesin"); scene.collection.children.link(C_KIN)
C_NUC = bpy.data.collections.new("Nucleotides"); scene.collection.children.link(C_NUC)
C_ANC = bpy.data.collections.new("Anchors"); scene.collection.children.link(C_ANC)

# materials -----------------------------------------------------------------------------
M_ALPHA = make_mat("Tubulin_Alpha", "#a9dcec", rough=0.55, sss=0.15)
M_BETA = make_mat("Tubulin_Beta", "#2f7fc1", rough=0.5, sss=0.15)
M_HEAD = make_mat("Kinesin_Head", "#f39a2e", rough=0.4, coat=0.3, sss=0.2)
M_NECKL = make_mat("Neck_Linker", "#ffd23f", rough=0.35, emit=0.6)
M_STALK = make_mat("Kinesin_Stalk", "#e56b1f", rough=0.4, coat=0.2)
M_HINGE = make_mat("Kinesin_Hinge", "#ffe0a8", rough=0.45)
M_TAIL = make_mat("Kinesin_Tail", "#d95a1a", rough=0.45, sss=0.2)
M_KLC = make_mat("Light_Chain", "#b98be0", rough=0.45, sss=0.2)
M_ADAPT = make_mat("Adaptor", "#7a64c8", rough=0.45)
M_VES = make_mat("Vesicle_Membrane", "#84d2b0", rough=0.3, alpha=0.55, sheen=0.5)
M_MEMP = make_mat("Membrane_Protein", "#4fae8a", rough=0.5)
M_C = make_mat("Atom_C", "#8f9aa6", rough=0.35, coat=0.5)
M_N = make_mat("Atom_N", "#3f6cf2", rough=0.35, coat=0.5)
M_O = make_mat("Atom_O", "#e8453c", rough=0.35, coat=0.5)
M_P = make_mat("Atom_P", "#ff9a1a", rough=0.35, coat=0.5, emit=0.4)
M_BOND = make_mat("Atom_Bond", "#d8dde3", rough=0.4)


# --------------------------------------------------------------------------------------
# microtubule
# --------------------------------------------------------------------------------------
def build_microtubule():
    variants = {
        "a": [blob_arrays((MON_AX, MON_TAN, MON_RAD), lobes=[((0, 0, 1), 0.35, 4), ((0.3, 1, 0.2), 0.2, 6)],
                          amp=0.28, freq=1.5, subdiv=3, seed=s) for s in (1.0, 2.0, 3.0)],
        "b": [blob_arrays((MON_AX, MON_TAN, MON_RAD), lobes=[((0, 0, 1), 0.45, 3), ((-0.3, -1, 0.3), 0.25, 6)],
                          amp=0.3, freq=1.7, subdiv=3, seed=s) for s in (5.0, 6.0, 7.0)],
    }
    parts = {"a": [], "b": []}
    for p in range(N_PF):
        th = math.pi / 2 + (p - TRACK_PF) * 2 * math.pi / N_PF
        rad = Vector((0, math.cos(th), math.sin(th)))
        tan = Vector((0, math.sin(th), -math.cos(th)))   # right-handed (ax, tan, rad)
        ax = Vector((1, 0, 0))
        off = (p - TRACK_PF) * 12.0 / N_PF
        n_curl = rng.randint(0, 5)
        last = None
        for k in range(K_MIN, K_MAX + 1 + n_curl):
            kind = "a" if k % 2 == 0 else "b"
            if k <= K_MAX:
                c = ax * (4 * k + off) + rad * R_PF
                xa, ra = ax, rad
                last = (c, 0.0)
            else:
                # plus-end: protofilaments peel outward ("ram's horns")
                i = k - K_MAX
                ang = 0.2 * i + 0.03 * i * i
                xa = ax * math.cos(ang) + rad * math.sin(ang)
                ra = rad * math.cos(ang) - ax * math.sin(ang)
                prev_c, prev_ang = last
                mid = 0.5 * (ang + prev_ang)
                step_dir = ax * math.cos(mid) + rad * math.sin(mid)
                c = prev_c + step_dir * 4.0
                last = (c, ang)
            M = np.eye(4)
            M[:3, 0], M[:3, 1], M[:3, 2], M[:3, 3] = xa[:], tan[:], ra[:], c[:]
            v, f = variants[kind][rng.randrange(3)]
            # small random twist so the lattice doesn't look cloned
            R = Matrix.Rotation(rng.uniform(-0.12, 0.12), 4, "Z") @ Matrix.Rotation(rng.uniform(-0.08, 0.08), 4, "X")
            M = M @ np.array(R)
            parts[kind].append((transform_arrays(v, M), f))
    objs = {}
    for kind, name, m in (("a", "Microtubule_Alpha", M_ALPHA), ("b", "Microtubule_Beta", M_BETA)):
        v, f = merge_arrays(parts[kind])
        me = mesh_from_arrays(name, v, f)
        me.materials.append(m)
        objs[kind] = new_obj(name, me, coll=C_MT)
    return objs


# --------------------------------------------------------------------------------------
# kinesin parts
# --------------------------------------------------------------------------------------
HEAD_NL_ATTACH = Vector((-0.7, 0.0, 2.1))     # neck-linker exit point, head-local
POCKET = Vector((-0.3, 2.0, 1.35))              # nucleotide pocket, head-local
POCKET_ROT = Euler((0.35, 0.0, 0.25)).to_quaternion()


def build_head_mesh():
    lobes = [
        ((1, 0, -0.2), 1.1, 3),      # plus-end "arrowhead" tip
        ((-1, 0.2, 0.1), 0.5, 4),    # minus-end lobe
        ((0.2, 1, 0.6), 0.35, 6),    # nucleotide-binding lip (P-loop side)
        ((0.3, -1, 0.5), 0.3, 6),
        ((0, 0, -1), -0.35, 2),      # flatter MT-binding face (L11/α4)
        ((-0.4, 0, 1), 0.3, 5),      # neck-linker docking ridge
    ]
    v, f = blob_arrays((3.35, 2.55, 2.3), lobes=lobes, amp=0.32, freq=1.1, subdiv=5, seed=11.0, octaves=4)
    # carve a shallow pocket where the nucleotide sits
    pc = np.array(POCKET[:], dtype=np.float32)
    d = np.linalg.norm(v - pc, axis=1)
    w = np.clip(1 - d / 1.4, 0, 1) ** 2
    nrm = v / np.linalg.norm(v, axis=1, keepdims=True)
    v = v - nrm * (w * 0.7)[:, None]
    me = mesh_from_arrays("Head_Mesh", v, f)
    me.materials.append(M_HEAD)
    return me


def build_neck_linker_mesh():
    # unit-length tube along +Y (scaled per frame), slightly beaded like a β-strand
    pts = [(0, i / 24, 0) for i in range(25)]
    radii = [0.44 + 0.03 * math.cos(i * math.pi / 2) for i in range(25)]
    v, f = tube_arrays(pts, 0.42, seg=12, cap=False, radii=radii)
    me = mesh_from_arrays("NeckLinker_Mesh", v, f)
    me.materials.append(M_NECKL)
    return me


# stalk path, local to Kinesin_Root (which sits at the neck junction)
STALK_CTRL = [(0, 0, 0), (0.1, 0, 3.0), (-0.4, 0, 6.2), (-5.5, 0, 15.5), (-10.2, 0, 24.0),
              (-11.8, 0.9, 27.0), (-13.2, 0, 30.0), (-19.5, 0, 38.8), (-25.0, 0, 46.0)]
VES_C = Vector((-40.5, 0.0, 64.5))
VES_R = 20.0


def build_stalk(root):
    path = catmull(STALK_CTRL, 16)
    # arc length
    s = [0.0]
    for i in range(1, len(path)):
        s.append(s[-1] + (path[i] - path[i - 1]).length)
    L = s[-1]
    tang = [(path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized() for i in range(len(path))]
    nrm = tang[0].cross(Vector((0, 1, 0))).normalized()
    frames = []
    for i in range(len(path)):
        if i > 0:
            nrm = (tang[i - 1].rotation_difference(tang[i]) @ nrm).normalized()
        frames.append((path[i], tang[i], nrm, tang[i].cross(nrm)))
    s_neck = s[2 * 16]
    s_h0, s_h1 = s[4 * 16] - 0.5, s[6 * 16] + 0.5

    def strand_points(k, s_from, s_to):
        pts = []
        for i in range(len(path)):
            if s[i] < s_from - 1e-6 or s[i] > s_to + 1e-6:
                continue
            p, t, n, b = frames[i]
            hinge_w = math.sin(math.pi * min(1, max(0, (s[i] - s_h0) / (s_h1 - s_h0))))
            sep = 0.52 + 0.75 * hinge_w
            phase = -2 * math.pi * s[i] / 14.0 + k * math.pi      # left-handed supercoil
            wob = Vector((0, 0, 0))
            if hinge_w > 0:
                wob = (n * math.sin(s[i] * 0.9 + k) + b * math.cos(s[i] * 0.7 + k * 2)) * 0.35 * hinge_w
            pts.append(p + (n * math.cos(phase) + b * math.sin(phase)) * sep + wob)
        return pts

    def coiled(name, s_from, s_to, mat):
        parts = [tube_arrays(strand_points(k, s_from, s_to), 0.5, seg=10) for k in (0, 1)]
        v, f = merge_arrays(parts)
        me = mesh_from_arrays(name + "_Mesh", v, f)
        me.materials.append(mat)
        return new_obj(name, me, parent=root, coll=C_KIN)

    objs = {
        "NeckCoil": coiled("NeckCoil", 0.0, s_neck, M_STALK),
        "Stalk": None,
    }
    # stalk = two coiled-coil segments on either side of the hinge
    pa = [tube_arrays(strand_points(k, s_neck, s_h0), 0.5, seg=10) for k in (0, 1)]
    pb = [tube_arrays(strand_points(k, s_h1, L), 0.5, seg=10) for k in (0, 1)]
    v, f = merge_arrays(pa + pb)
    me = mesh_from_arrays("Stalk_Mesh", v, f)
    me.materials.append(M_STALK)
    objs["Stalk"] = new_obj("Stalk", me, parent=root, coll=C_KIN)
    objs["Hinge"] = coiled("Hinge", s_h0, s_h1, M_HINGE)

    # globular tail domain
    tail_p = path[-1] + tang[-1] * 1.2
    tme = blob_mesh("Tail_Mesh", (2.4, 2.1, 1.9), lobes=[((0, 1, 0), 0.4, 4), ((0, -1, 0), 0.4, 4)],
                    amp=0.3, freq=1.4, subdiv=4, seed=21.0)
    tme.materials.append(M_TAIL)
    tail = new_obj("Tail", tme, parent=root, coll=C_KIN)
    tail.location = tail_p

    # two kinesin light chains (TPR domains) bridging tail -> cargo adaptor
    for i, sgn in enumerate((1, -1)):
        start = tail_p + Vector((0, 2.2 * sgn, 0.6))
        target = VES_C + (tail_p + Vector((-2.5, 5.5 * sgn, 2.5)) - VES_C).normalized() * (VES_R + 1.2)
        d = target - start
        L2 = d.length
        # curved TPR superhelix: a chain of lobes
        chain = []
        for j in range(6):
            t = (j + 0.5) / 6
            p = start + d * t + Vector((0, sgn * 1.2 * math.sin(math.pi * t), 0.6 * math.sin(math.pi * t)))
            bv, bf = blob_arrays((1.25, 1.05, 1.05), amp=0.18, freq=1.6, subdiv=3, seed=30 + j + 7 * i)
            chain.append((bv + np.array(p[:], dtype=np.float32), bf))
        v, f = merge_arrays(chain)
        me = mesh_from_arrays(f"LightChain_{i + 1}_Mesh", v, f)
        me.materials.append(M_KLC)
        new_obj(f"LightChain_{i + 1}", me, parent=root, coll=C_KIN)

    # cargo vesicle (own pivot for gentle wobble)
    cargo = bpy.data.objects.new("Cargo", None)
    C_KIN.objects.link(cargo)
    cargo.parent = root
    cargo.location = VES_C
    vme = blob_mesh("Vesicle_Mesh", (VES_R, VES_R, VES_R), amp=0.35, freq=0.12, subdiv=6, seed=40.0)
    vme.materials.append(M_VES)
    new_obj("Vesicle", vme, parent=cargo, coll=C_KIN)

    # membrane proteins + adaptor on the vesicle surface
    parts = []
    golden = math.pi * (3 - math.sqrt(5))
    n = 46
    toward_tail = (tail_p - VES_C).normalized()
    for i in range(n):
        y = 1 - 2 * (i + 0.5) / n
        r = math.sqrt(1 - y * y)
        a = golden * i
        d = Vector((r * math.cos(a), y, r * math.sin(a)))
        d = (d + Vector((rng.uniform(-.15, .15), rng.uniform(-.15, .15), rng.uniform(-.15, .15)))).normalized()
        if d.dot(toward_tail) > 0.9:
            continue
        size = rng.uniform(1.1, 2.4)
        bv, bf = blob_arrays((size, size * rng.uniform(0.8, 1.1), size * rng.uniform(1.1, 1.6)), amp=0.2,
                             freq=1.5, subdiv=3, seed=50 + i)
        q = Vector((0, 0, 1)).rotation_difference(d).to_matrix().to_4x4()
        M = Matrix.Translation(d * (VES_R + size * 0.2)) @ q
        parts.append((transform_arrays(bv, M), bf))
    v, f = merge_arrays(parts)
    me = mesh_from_arrays("MembraneProteins_Mesh", v, f)
    me.materials.append(M_MEMP)
    new_obj("MembraneProteins", me, parent=cargo, coll=C_KIN)

    av, af = blob_arrays((3.2, 4.2, 2.0), lobes=[((0, 0, -1), 0.6, 3)], amp=0.3, freq=1.2, subdiv=4, seed=60.0)
    q = Vector((0, 0, 1)).rotation_difference(toward_tail).to_matrix().to_4x4()
    M = Matrix.Translation(toward_tail * (VES_R + 0.8)) @ q
    me = mesh_from_arrays("Adaptor_Mesh", transform_arrays(av, M), af)
    me.materials.append(M_ADAPT)
    new_obj("Adaptor", me, parent=cargo, coll=C_KIN)
    return objs, tail_p


# --------------------------------------------------------------------------------------
# nucleotides (ball-and-stick, space-filling-ish)
# --------------------------------------------------------------------------------------
def atp_atoms():
    """Approximate ATP heavy-atom layout in nm (chain along +X). Returns [(el, Vector)], gamma-P start index."""
    at = []
    c6 = Vector((-0.95, 0.0, 0.0))
    hexa = {}
    for name, ang in (("C5", 30), ("C6", 90), ("N1", 150), ("C2", 210), ("N3", 270), ("C4", 330)):
        a = math.radians(ang)
        hexa[name] = c6 + Vector((0.14 * math.cos(a), 0.14 * math.sin(a), 0))
        at.append((name[0], hexa[name]))
    cx5 = c6 + Vector((0.121 + 0.0963, 0, 0))
    at.append(("N", cx5 + Vector((-0.0368, 0.113, 0))))   # N7
    at.append(("C", cx5 + Vector((0.119, 0, 0))))          # C8
    n9 = cx5 + Vector((-0.0368, -0.113, 0))
    at.append(("N", n9))                                   # N9
    at.append(("N", hexa["C6"] + Vector((0, 0.135, 0))))  # N6 amino
    rc = n9 + Vector((0.13, -0.2, 0.05))
    for k, el in enumerate(("C", "C", "C", "C", "O")):   # ribose ring C1'..C4', O4'
        a = math.radians(120 + 72 * k)
        at.append((el, rc + Vector((0.12 * math.cos(a), 0.12 * math.sin(a), 0.03 * math.sin(3 * a)))))
    at.append(("O", rc + Vector((-0.02, -0.24, 0.05))))  # O2'
    at.append(("O", rc + Vector((0.14, -0.2, -0.04))))   # O3'
    c5p = rc + Vector((0.2, 0.06, 0.06))
    at.append(("C", c5p))
    o5p = c5p + Vector((0.13, 0.04, -0.03))
    at.append(("O", o5p))
    p = o5p + Vector((0.14, 0.0, 0.0))
    gamma_start = None
    for i in range(3):
        if i == 2:
            gamma_start = len(at)
        at.append(("P", p))
        at.append(("O", p + Vector((0.0, 0.11, 0.1))))
        at.append(("O", p + Vector((0.0, -0.11, 0.1))))
        if i < 2:
            at.append(("O", p + Vector((0.145, 0.0, -0.06))))   # bridging O
            p = p + Vector((0.29, 0.0, 0.0))
        else:
            at.append(("O", p + Vector((0.14, 0.0, -0.05))))
    return at, gamma_start


NUC_SCALE = 2.6
VDW = {"C": 0.17, "N": 0.155, "O": 0.152, "P": 0.18}
MATS = {"C": M_C, "N": M_N, "O": M_O, "P": M_P}


def molecule_mesh(name, atoms, origin):
    sph_v, sph_f = blob_arrays((1, 1, 1), amp=0.0, subdiv=3)
    per_mat = {}
    pts = [(el, (p - origin) * NUC_SCALE) for el, p in atoms]
    for el, p in pts:
        r = VDW[el] * 0.8 * NUC_SCALE
        per_mat.setdefault(el, []).append((sph_v * r + np.array(p[:], dtype=np.float32), sph_f))
    bonds = []
    for i in range(len(pts)):
        for j in range(i + 1, len(pts)):
            d = (pts[i][1] - pts[j][1]).length
            if d < 0.19 * NUC_SCALE:
                bonds.append(tube_arrays([pts[i][1], pts[j][1]], 0.045 * NUC_SCALE, seg=8, cap=False))
    if bonds:
        per_mat["B"] = bonds
    allv, allf, mat_idx = [], [], []
    off = 0
    order = [k for k in ("C", "N", "O", "P", "B") if k in per_mat]
    for mi, el in enumerate(order):
        for v, f in per_mat[el]:
            allv.append(v)
            allf.append(f + off)
            mat_idx += [mi] * len(f)
            off += len(v)
    v = np.concatenate(allv)
    f = np.concatenate(allf)
    me = mesh_from_arrays(name, v, f)
    me.polygons.foreach_set("material_index", np.array(mat_idx, dtype=np.int32))
    for el in order:
        me.materials.append(M_BOND if el == "B" else MATS[el])
    me.update()
    return me


def build_nucleotide_meshes():
    atoms, g = atp_atoms()
    origin = Vector((0.0, 0.0, 0.0))
    for el, p in atoms:
        origin += p
    origin /= len(atoms)
    adp = molecule_mesh("ADP_Mesh", atoms[:g], origin)
    gamma = atoms[g:]
    pc = gamma[0][1]
    pi_ = molecule_mesh("Pi_Mesh", gamma + [("O", pc + Vector((0.0, 0.0, -0.15)))], pc)
    pi_offset = (pc - origin) * NUC_SCALE
    return adp, pi_, pi_offset


# --------------------------------------------------------------------------------------
# animation helpers (Blender 4.4+/5.x slotted actions)
# --------------------------------------------------------------------------------------
from bpy_extras import anim_utils


def write_anim(obj, frames, loc=None, quat=None, scale=None):
    ad = obj.animation_data_create()
    act = bpy.data.actions.new(obj.name + "_Action")
    ad.action = act
    slot = act.slots.new(id_type="OBJECT", name=obj.name)
    ad.action_slot = slot
    cb = anim_utils.action_ensure_channelbag_for_slot(act, slot)

    def put(path, arr):
        arr = np.asarray(arr, dtype=np.float32)
        for idx in range(arr.shape[1]):
            fc = cb.fcurves.new(path, index=idx)
            fc.keyframe_points.add(len(frames))
            co = np.empty(len(frames) * 2, dtype=np.float32)
            co[0::2] = frames
            co[1::2] = arr[:, idx]
            fc.keyframe_points.foreach_set("co", co)
            fc.keyframe_points.foreach_set("interpolation", np.ones(len(frames), dtype=np.int32))
            fc.update()

    if loc is not None:
        put("location", loc)
    if quat is not None:
        obj.rotation_mode = "QUATERNION"
        q = np.asarray(quat, dtype=np.float32)
        for i in range(1, len(q)):          # keep hemisphere continuity
            if np.dot(q[i], q[i - 1]) < 0:
                q[i] = -q[i]
        put("rotation_quaternion", q)
    if scale is not None:
        put("scale", scale)


# --------------------------------------------------------------------------------------
# motion model: hand-over-hand stepping (asymmetric, heads pass on alternating sides)
# --------------------------------------------------------------------------------------
def step_of(f):
    s = min(int(f // T), N_STEPS - 1)
    return s, (f - s * T) / T


def xF(s):
    return XF0 + 8.0 * s


def side(s):
    return 1.0 if s % 2 == 0 else -1.0


def bound_pos(x):
    return Vector((x, 0.0, Z_B))


def hover_pos(s):
    return Vector((xF(s) - 7.0, side(s) * 1.6, Z_B + 3.3))


def hover_eul(s):
    return Vector((side(s) * 0.18, -0.32, side(s) * 0.28))


def eul_q(e):
    return Euler((e.x, e.y, e.z), "XYZ").to_quaternion()


def head_pose(h, f):
    """h = 0 (Head_A) or 1 (Head_B). Head_A is the bound front head in even steps."""
    s, u = step_of(f)
    seed = 3.0 + h * 50.0
    if h == s % 2:                                  # bound (front) head of this step
        e = smoother((u - 0.86) / 0.14)             # ...detaches at the end -> becomes tethered rear head
        pos = bound_pos(xF(s)).lerp(hover_pos(s + 1), e)
        eul = hover_eul(s + 1) * e
        amp = e
    elif u < 0.25:                                  # tethered rear head, ADP-bound, waiting
        pos, eul, amp = hover_pos(s), hover_eul(s), 1.0
    elif u < 0.62:                                  # 16-nm forward swing past the bound head
        tt = (u - 0.25) / 0.37
        e = smoother(tt)
        sd = side(s)
        P0, P3 = hover_pos(s), bound_pos(xF(s) + 8.0)
        C1 = Vector((xF(s) - 3.0, sd * 7.2, Z_B + 7.8))
        C2 = Vector((xF(s) + 5.0, sd * 6.6, Z_B + 6.4))
        pos = (1 - e) ** 3 * P0 + 3 * (1 - e) ** 2 * e * C1 + 3 * (1 - e) * e ** 2 * C2 + e ** 3 * P3
        bump = math.sin(math.pi * e)
        eul = hover_eul(s) * (1 - e) + Vector((sd * 0.4 * bump, -0.25 * bump, sd * 0.65 * bump))
        amp = 1.0 - smooth(tt)
    else:                                           # docked on the new binding site (+16 nm)
        pos, eul, amp = bound_pos(xF(s) + 8.0), Vector((0, 0, 0)), 0.0
        k = (u - 0.62) / 0.1
        if k < 1:
            pos = pos + Vector((0, 0, -0.18 * math.sin(math.pi * k)))
    pos = pos + jit(f, seed) * 0.7 * amp
    eul = eul + jit(f, seed + 7.0) * 0.14 * amp
    return pos, eul_q(eul)


def junction(f):
    s, u = step_of(f)
    x = xF(s)
    A = Vector((x - 2.5, 0, Z_B + 5.3))
    B = Vector((x + 4.0, 0, Z_B + 5.9))
    Cc = Vector((x + 5.5, 0, Z_B + 5.3))
    if u < 0.2:
        p = A
    elif u < 0.65:
        p = A.lerp(B, smoother((u - 0.2) / 0.45))
    elif u < 0.86:
        p = B
    else:
        p = B.lerp(Cc, smoother((u - 0.86) / 0.14))
    sw = (u - 0.25) / 0.37
    if 0 < sw < 1:
        p = p + Vector((0, side(s) * 0.9 * math.sin(math.pi * sw), 0))
    return p + jit(f, 91.0) * 0.25


NUC_SITE = POCKET + Vector((0.0, 0.55, 0.45))    # nucleotide sits in the pocket mouth


def pocket_pose(h, f):
    hp, hq = head_pose(h, f)
    return hp + hq @ NUC_SITE, hq @ POCKET_ROT


def tumble(f, r):
    w = [r.uniform(-0.09, 0.09) for _ in range(3)]
    ph = [r.uniform(0, 6.28) for _ in range(3)]
    return Euler((f * w[0] + ph[0], f * w[1] + ph[1], f * w[2] + ph[2])).to_quaternion()


def out_dir(r):
    return Vector((r.uniform(-0.5, 0.5), r.choice((-1, 1)) * r.uniform(0.5, 1.0), r.uniform(0.3, 1.0))).normalized()


def in_dir(r):
    return Vector((r.uniform(-0.5, 0.7), r.uniform(0.5, 1.0), r.uniform(0.2, 0.9))).normalized()


def adp_schedule(k):
    if k < 0:
        return dict(h=1, f_in0=None, f_in1=None, f_rel=0.66 * T)
    return dict(h=k % 2, f_in0=k * T, f_in1=k * T + 0.2 * T,
                f_rel=(k + 1) * T + 0.66 * T if k + 1 < N_STEPS else 1e9)


REL_DUR = 0.34 * T


def release_pose(p0, q0, f, f_rel, r_seed):
    r = random.Random(r_seed)
    d = out_dir(r)
    tt = min(1.0, (f - f_rel) / REL_DUR)
    e = 1 - (1 - tt) ** 2
    p = p0 + d * 17.0 * e + jit(f, r_seed * 0.37, 0.15) * 1.8 * tt
    q = q0.slerp(tumble(f, random.Random(r_seed + 1)), smooth(tt * 2))
    sc = 1.0 - smooth((tt - 0.55) / 0.45)
    return p, q, sc


def adp_pose(k, f):
    sc_ = adp_schedule(k)
    h, f_in0, f_in1, f_rel = sc_["h"], sc_["f_in0"], sc_["f_in1"], sc_["f_rel"]
    r = random.Random(100 + k)
    din = in_dir(r)
    if f_in0 is not None and f < f_in1:
        tp, tq = pocket_pose(h, f_in1)
        start = tp + din * 24.0
        if f < f_in0:
            return start, tumble(f, random.Random(300 + k)), 0.0
        tt = (f - f_in0) / (f_in1 - f_in0)
        e = 1 - (1 - tt) ** 3
        p = start.lerp(tp, e) + jit(f, 200.0 + k, 0.15) * 2.8 * (1 - e)
        q = tumble(f, random.Random(300 + k)).slerp(tq, smooth(tt * 1.25))
        return p, q, smooth(tt / 0.25)
    if f < f_rel:
        p, q = pocket_pose(h, f)
        return p, q, 1.0
    p0, q0 = pocket_pose(h, f_rel)
    return release_pose(p0, q0, f, f_rel, 500 + k)


def pi_pose(k, f, pi_offset):
    f_pi = k * T + 0.80 * T
    if f < f_pi:
        p, q, sc = adp_pose(k, f)
        return p + q @ pi_offset, q, sc
    p0, q0, _ = adp_pose(k, f_pi)
    return release_pose(p0 + q0 @ pi_offset, q0, f, f_pi, 700 + k)


# --------------------------------------------------------------------------------------
# build everything
# --------------------------------------------------------------------------------------
mt = build_microtubule()

head_me = build_head_mesh()
heads = [new_obj("Head_A", head_me, coll=C_KIN), new_obj("Head_B", head_me, coll=C_KIN)]
nl_me = build_neck_linker_mesh()
nls = [new_obj("NeckLinker_A", nl_me, coll=C_KIN), new_obj("NeckLinker_B", nl_me, coll=C_KIN)]

root = bpy.data.objects.new("Kinesin_Root", None)
C_KIN.objects.link(root)
stalk_objs, tail_p = build_stalk(root)

adp_me, pi_me, PI_OFFSET = build_nucleotide_meshes()
adps = {k: new_obj("ADP_init" if k < 0 else f"ADP_{k:02d}", adp_me, coll=C_NUC) for k in range(-1, N_STEPS)}
pis = {k: new_obj(f"Pi_{k:02d}", pi_me, coll=C_NUC) for k in range(N_STEPS)}

# ---- bake per-frame transforms
frames = np.arange(0, F_END + 1, dtype=np.float32)
H = {0: ([], []), 1: ([], [])}
NL = {0: ([], [], []), 1: ([], [], [])}
root_loc, root_q = [], []
# warm-start the lag filter on the last step so frame 0 matches frame F_END (seamless loop)
vel, prev_j = 0.0, junction(F_END - T)
for f in range(F_END - T, F_END + 1):
    j = junction(f)
    vel = vel * 0.88 + (j.x - prev_j.x) * 0.12
    prev_j = j
prev_j = junction(0) - Vector((junction(F_END).x - junction(F_END - 1).x, 0, 0))
for f in range(F_END + 1):
    j = junction(f)
    vel = vel * 0.88 + (j.x - prev_j.x) * 0.12
    prev_j = j
    root_loc.append(j[:])
    root_q.append(Euler((0.035 * math.sin(2 * math.pi * f / 180.0),
                         -1.4 * vel + 0.03 * math.sin(2 * math.pi * f / 144.0),
                         0.04 * math.sin(2 * math.pi * f / 240.0 + 1.0))).to_quaternion()[:])
    for h in (0, 1):
        p, q = head_pose(h, f)
        H[h][0].append(p[:])
        H[h][1].append(q[:])
        att = p + q @ HEAD_NL_ATTACH
        d = att - j
        NL[h][0].append(j[:])
        NL[h][1].append(Vector((0, 1, 0)).rotation_difference(d)[:])
        NL[h][2].append((1.0, d.length, 1.0))

for h in (0, 1):
    write_anim(heads[h], frames, loc=H[h][0], quat=H[h][1])
    write_anim(nls[h], frames, loc=NL[h][0], quat=NL[h][1], scale=NL[h][2])
write_anim(root, frames, loc=root_loc, quat=root_q)

cargo = bpy.data.objects["Cargo"]
write_anim(cargo, frames, loc=[VES_C[:]] * len(frames),
           quat=[Euler((0.06 * math.sin(2 * math.pi * f / 180), 0.05 * math.sin(2 * math.pi * f / 240 + 1),
                        0.1 * math.sin(2 * math.pi * f / 360))).to_quaternion()[:] for f in range(F_END + 1)])

for k, o in adps.items():
    L, Q, S = [], [], []
    for f in range(F_END + 1):
        p, q, sc = adp_pose(k, f)
        L.append(p[:]); Q.append(q[:]); S.append((sc, sc, sc))
    write_anim(o, frames, loc=L, quat=Q, scale=S)
for k, o in pis.items():
    L, Q, S = [], [], []
    for f in range(F_END + 1):
        p, q, sc = pi_pose(k, f, PI_OFFSET)
        L.append(p[:]); Q.append(q[:]); S.append((sc, sc, sc))
    write_anim(o, frames, loc=L, quat=Q, scale=S)


# ---- annotation anchors (static empties)
def pf_frame(p):
    th = math.pi / 2 + (p - TRACK_PF) * 2 * math.pi / N_PF
    return Vector((0, math.cos(th), math.sin(th))), (p - TRACK_PF) * 12.0 / N_PF


def anchor(name, loc):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 2
    e.location = loc
    C_ANC.objects.link(e)


rad4, off4 = pf_frame(4)
anchor("ANCHOR_Alpha", Vector((4 * -8 + off4, 0, 0)) + rad4 * (R_PF + MON_RAD))
anchor("ANCHOR_Beta", Vector((4 * -7 + off4, 0, 0)) + rad4 * (R_PF + MON_RAD))
rad8, off8 = pf_frame(8)
anchor("ANCHOR_Protofilament", Vector((70 + off8, 0, 0)) + rad8 * (R_PF + MON_RAD))
anchor("ANCHOR_PlusEnd", Vector((4 * K_MAX + 12, 0, R_PF + 6)))
anchor("ANCHOR_MinusEnd", Vector((4 * K_MIN - 2, 0, 0)))
seam = pf_frame(12.5)[0]
anchor("ANCHOR_Seam", Vector((40, 0, 0)) + seam * (R_PF + MON_RAD))

# ---- preview camera / light / world
cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
scene.collection.objects.link(cam)
cam.data.lens = 50
cam.data.clip_start = 0.5
cam.data.clip_end = 2000
cam.location = (35, -95, 62)
tgt = Vector((-28, 0, 32))
cam.rotation_euler = (tgt - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam
sun = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
sun.data.energy = 3.5
sun.rotation_euler = (math.radians(40), math.radians(15), math.radians(-35))
scene.collection.objects.link(sun)
rim = bpy.data.objects.new("Rim", bpy.data.lights.new("Rim", "SUN"))
rim.data.energy = 2.0
rim.data.color = (0.6, 0.8, 1.0)
rim.rotation_euler = (math.radians(-60), math.radians(-20), math.radians(150))
scene.collection.objects.link(rim)
world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
scene.world = world
try:
    world.use_nodes = True
except Exception:
    pass
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs[0].default_value = (0.012, 0.02, 0.045, 1)
    bg.inputs[1].default_value = 1.0

scene.frame_set(int(0.45 * T))

# ---- timeline metadata for the web captions
timeline = {
    "fps": FPS, "framesPerStep": T, "steps": N_STEPS, "frameEnd": F_END,
    "stepNm": 8, "headStepNm": 16,
    "phases": [
        {"from": 0.00, "to": 0.20, "key": "atp_binding"},
        {"from": 0.20, "to": 0.30, "key": "neck_docking"},
        {"from": 0.30, "to": 0.62, "key": "swing"},
        {"from": 0.62, "to": 0.72, "key": "landing_adp_release"},
        {"from": 0.72, "to": 0.80, "key": "hydrolysis"},
        {"from": 0.80, "to": 0.86, "key": "pi_release"},
        {"from": 0.86, "to": 1.00, "key": "rear_detach"},
    ],
    "frontHeadEvenSteps": "Head_A",
}
with open(TIMELINE_PATH, "w") as fh:
    json.dump(timeline, fh, indent=1)

result = {"objects": len(bpy.data.objects),
          "mt_tris": sum(len(o.data.polygons) for o in mt.values()),
          "head_tris": len(head_me.polygons)}

# ---- export
if os.environ.get("KINESIN_NO_EXPORT") is None:
    scene.frame_set(0)
    bpy.ops.export_scene.gltf(filepath=GLB_PATH, export_format="GLB", use_selection=False,
                              export_animations=True, export_animation_mode="SCENE", export_force_sampling=True,
                              export_frame_range=True, export_cameras=False, export_lights=False,
                              export_apply=True, export_yup=True, export_texcoords=False,
                              export_normals=True, export_materials="EXPORT")
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    result["glb_mb"] = round(os.path.getsize(GLB_PATH) / 1e6, 2)
