#!/usr/bin/env python3
"""
Snap water-body polygons to the rendered coastline.

Natural Earth marine polygons are label-grade shapes: they overshoot land and leave gaps along
coasts. This script:
  1. cuts every ocean/sea polygon to the water region (world minus land),
  2. resolves overlaps between oceans and seas (the smaller body wins),
  3. hands every unclaimed coastal water patch to the nearest body (Voronoi on border vertices),
  4. clips straits to water, keeping the original shape when clipping would erase it.

Usage: snap-water-to-coast.py <water.geojson> <land.geojson> <out.geojson>
Requires: shapely>=2, numpy
"""
import json
import sys

import numpy as np
import shapely
from shapely.geometry import MultiPoint, MultiPolygon, Polygon, box, shape, mapping
from shapely.ops import unary_union, voronoi_diagram

MIN_HOLE_AREA = 0.03  # deg^2, smaller islands are not cut out of the water
MIN_PART_AREA = 0.01  # deg^2, drop microscopic water slivers
GAP_SEED_STEP = 0.25  # deg, spacing of Voronoi seeds along open borders
GAP_REACH = 0.05  # deg, a gap must touch a body to be claimed by it

water_path, land_path, out_path = sys.argv[1:4]

water = json.load(open(water_path))["features"]
land_fc = json.load(open(land_path))
def unwrap(poly):
    """Polygons that straddle the antimeridian are stored as rings spanning -180..180, which is only
    meaningful on the sphere. Shift them to 0..360 and cut them back into two planar polygons."""
    xs = [c[0] for c in poly.exterior.coords]
    ys = [c[1] for c in poly.exterior.coords]
    if max(xs) - min(xs) <= 180 or max(ys) < -80:  # Antarctica legitimately spans every longitude
        return [poly]

    def shift(ring):
        return [(x + 360 if x < 0 else x, y) for x, y in ring.coords]

    shifted = shapely.make_valid(Polygon(shift(poly.exterior), [shift(r) for r in poly.interiors]))
    west = shifted.intersection(box(0, -90, 180, 90))
    east = shapely.transform(shifted.intersection(box(180, -90, 360, 90)), lambda a: a - [360, 0])
    return [west, east]


# Validate each polygon on its own: make_valid on the whole (self-overlapping) MultiPolygon
# resolves overlaps with even-odd rules and punches holes into the land.
land_parts = []
for f in land_fc["features"]:
    g = shape(f["geometry"])
    for p in getattr(g, "geoms", [g]):
        for q in unwrap(p):
            land_parts.append(shapely.make_valid(q))
land = unary_union(land_parts)

WORLD = box(-180, -89.999, 180, 89.999)
WATER = shapely.make_valid(WORLD.difference(land))


def is_strait(f):
    return f["properties"]["wb_id"].startswith(("WATER_STRAIT_", "WATER_CANAL_"))


def clean(geom):
    geom = shapely.make_valid(geom)
    polys = []
    for g in getattr(geom, "geoms", [geom]):
        if isinstance(g, MultiPolygon):
            polys.extend(g.geoms)
        elif isinstance(g, Polygon):
            polys.append(g)
    out = []
    for p in polys:
        if p.area < MIN_PART_AREA:
            continue
        holes = [r for r in p.interiors if Polygon(r).area >= MIN_HOLE_AREA]
        out.append(Polygon(p.exterior, holes))
    return unary_union(out) if out else Polygon()


bodies = {}
for f in water:
    if is_strait(f):
        continue
    bodies[f["properties"]["wb_id"]] = shapely.make_valid(shape(f["geometry"])).intersection(WATER)

# Smaller bodies claim their water first so seas are never swallowed by the oceans around them
claimed = Polygon()
snapped = {}
for wb_id in sorted(bodies, key=lambda k: bodies[k].area):
    geom = bodies[wb_id].difference(claimed)
    geom = geom.buffer(0.05).buffer(-0.05).intersection(WATER).difference(claimed)
    snapped[wb_id] = geom
    claimed = unary_union([claimed, geom])

# Unclaimed water that touches a body: split among bodies by nearest border vertex
unclaimed = WATER.difference(claimed)
parts = [p for p in getattr(unclaimed, "geoms", [unclaimed]) if p.area >= 1e-6]
union_all = unary_union(list(snapped.values()))
reach = union_all.buffer(GAP_REACH)
parts = [p for p in parts if p.intersects(reach)]
gap = unary_union(parts) if parts else Polygon()
gap_zone = gap.buffer(0.02)

seed_pts, seed_owner = [], []
for wb_id, geom in snapped.items():
    border = shapely.segmentize(geom.boundary, GAP_SEED_STEP).intersection(gap_zone)
    if border.is_empty:
        continue
    for g in getattr(border, "geoms", [border]):
        coords = np.array(g.coords) if hasattr(g, "coords") and len(g.coords) else np.empty((0, 2))
        for c in coords:
            seed_pts.append(c)
            seed_owner.append(wb_id)

if seed_pts and not gap.is_empty:
    seeds = np.round(np.array(seed_pts), 3)
    seeds, keep = np.unique(seeds, axis=0, return_index=True)
    seed_owner = [seed_owner[i] for i in keep]
    mp = MultiPoint(seeds)
    cells = voronoi_diagram(mp, envelope=box(-190, -100, 190, 100))
    cell_geoms = list(cells.geoms)
    # Map every cell back to the seed it contains
    tree = shapely.STRtree(cell_geoms)
    pts = shapely.points(seeds)
    per_body = {}
    q = tree.query(pts, predicate="within")  # rows: point_idx, cell_idx
    for pi, ci in zip(q[0], q[1]):
        per_body.setdefault(seed_owner[pi], []).append(cell_geoms[ci])
    for wb_id, cell_list in per_body.items():
        share = unary_union([shapely.make_valid(c) for c in cell_list]).intersection(gap)
        if not share.is_empty:
            snapped[wb_id] = unary_union([snapped[wb_id], share.buffer(1e-4).buffer(-1e-4)])

features = []
for f in water:
    wb_id = f["properties"]["wb_id"]
    if is_strait(f):
        orig = shape(f["geometry"])
        cut = shapely.make_valid(orig).intersection(WATER)
        geom = cut if (not cut.is_empty and cut.area >= 0.4 * orig.area) else orig
    else:
        geom = snapped[wb_id]
    geom = clean(geom)
    if geom.is_empty:
        raise SystemExit(f"{wb_id} became empty after snapping")
    props = dict(f["properties"])
    features.append({"type": "Feature", "properties": props, "geometry": mapping(geom)})

json.dump({"type": "FeatureCollection", "features": features}, open(out_path, "w"))
print(f"Snapped {len(features)} water bodies to coastline -> {out_path}")
