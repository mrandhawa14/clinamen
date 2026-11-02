"""Build Clinamen's Blender assets from code and export them as glTF (.glb).

Run:  npm run assets:blender
 or:  blender --background --factory-startup --python blender/build_assets.py

Everything is generated (no hand-edited .blend files needed), so assets are
reviewable in pull requests and can be rebuilt by anyone. Output goes to
public/models/, which the web app serves at /models/.
"""
import math
import os
import random

import bmesh
import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "models")
os.makedirs(OUT, exist_ok=True)


# --- helpers -------------------------------------------------------------------------
def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials):
        for item in list(block):
            block.remove(item)


def hex_rgba(h, a=1.0):
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, a)


def material(name, color, rough=0.6, metal=0.0, transmission=0.0, alpha=1.0, emission=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")

    def put(names, value):
        for n in names:  # input names changed across Blender versions
            if n in p.inputs:
                p.inputs[n].default_value = value
                return

    put(["Base Color"], hex_rgba(color))
    put(["Roughness"], rough)
    put(["Metallic"], metal)
    put(["Transmission Weight", "Transmission"], transmission)
    put(["Alpha"], alpha)
    if emission:
        put(["Emission Color", "Emission"], hex_rgba(emission))
        put(["Emission Strength"], strength)
    if alpha < 1.0:
        for attr, val in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND")):
            if hasattr(m, attr):
                try:
                    setattr(m, attr, val)
                except (TypeError, ValueError):
                    pass
    return m


def finish(obj, mat, name):
    obj.name = name
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = False  # faceted, low-poly look
    return obj


def cylinder(name, r, depth, z, verts=24, caps=True):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=(0, 0, z),
                                        end_fill_type="NGON" if caps else "NOTHING")
    o = bpy.context.active_object
    o.name = name
    return o


def export(name):
    path = os.path.join(OUT, f"{name}.glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_apply=True)
    print(f"exported {os.path.relpath(path, ROOT)} ({os.path.getsize(path) // 1024} KB)")


# --- 1. Terrarium jar ------------------------------------------------------------------
# A glass bell jar on a wooden plinth. In wallpaper mode a piece of the planet lives inside.
def build_jar():
    clear_scene()
    wood = material("Wood", "#5a3b26", rough=0.65)
    brass = material("Brass", "#b08d57", rough=0.35, metal=1.0)
    glass = material("Glass", "#eaf5ff", rough=0.04, transmission=1.0, alpha=0.22)

    finish(cylinder("Plinth", 1.18, 0.26, 0.13, verts=24), wood, "Plinth")
    finish(cylinder("PlinthLip", 1.24, 0.06, 0.03, verts=24), wood, "PlinthLip")
    finish(cylinder("Ring", 1.08, 0.05, 0.285, verts=24), brass, "Ring")

    # Glass: open cylinder wall + top half of a sphere, joined
    wall = cylinder("Wall", 1.0, 1.1, 0.31 + 0.55, verts=24, caps=False)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1.0, location=(0, 0, 1.41))
    dome = bpy.context.active_object
    bm = bmesh.new()
    bm.from_mesh(dome.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-4], context="VERTS")
    bm.to_mesh(dome.data)
    bm.free()
    bpy.ops.object.select_all(action="DESELECT")
    wall.select_set(True)
    dome.select_set(True)
    bpy.context.view_layer.objects.active = wall
    bpy.ops.object.join()
    finish(wall, glass, "Glass")

    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.09, location=(0, 0, 2.47))
    finish(bpy.context.active_object, brass, "Knob")
    export("terrarium_jar")


# --- 2. The Archive crystal ------------------------------------------------------------
# The narrator of story mode: a dark crystal with a glowing core.
def build_archive():
    clear_scene()
    rnd = random.Random(1337)
    shell = material("Obsidian", "#2a2540", rough=0.12, metal=0.1, transmission=0.85, alpha=0.62)  # translucent: the core shows
    shard = material("Shard", "#17141f", rough=0.18, metal=0.25)
    core = material("Core", "#8be3d2", rough=0.4, emission="#8be3d2", strength=6.0)

    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.5, location=(0, 0, 0))
    crystal = bpy.context.active_object
    for v in crystal.data.vertices:  # irregular facets, like a real crystal
        v.co *= 0.85 + rnd.random() * 0.3
    crystal.scale = (0.62, 0.62, 1.7)
    finish(crystal, shell, "Crystal")

    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=0, radius=0.2, location=(0, 0, 0))
    inner = bpy.context.active_object
    inner.scale = (1, 1, 2.2)
    finish(inner, core, "Core")

    # Orbiting shards
    for i in range(5):
        a = i / 5 * math.tau
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=0, radius=0.07 + rnd.random() * 0.05,
                                              location=(math.cos(a) * 0.95, math.sin(a) * 0.95, (rnd.random() - 0.5) * 1.2))
        finish(bpy.context.active_object, shard, f"Shard{i}")
    export("archive_crystal")


build_jar()
build_archive()
