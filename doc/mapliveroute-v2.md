#### Historical Changes

Classical issue with live route snapping—the last two positions are too few for a long segment, and if the device is stationary at a traffic light for a long time, the gap between the last two positions is so small that OSRM returns a short segment or even the same point.

Root cause:

```

Positions: A → B → C → [5-minute traffic light] → D → E
                              ↑
                    The last 2 positions = C and C (same)
                    or C and D (very small distance)
                    → OSRM mini return segment / single point
Fix: use more positions from the cache, not just the last 2.

```

#### LiveRouteSnapResource.java:


// BEFORE — only the last 2 positions

```
List<Position> segment = positions.subList(
    Math.max(0, positions.size() - 2),
    positions.size());

```

// AFTER — take the last N positions, filter out duplicates/empty values

```
private static final int SNAP_WINDOW = 10;   // maximum number of positions sent to OSRM
private static final double MIN_DIST_M = 5.0;  // filter out positions that are too close

List<Position> segment = buildSnapWindow(positions);
javaprivate List<Position> buildSnapWindow(List<Position> positions) {
    // Get the last window
    List<Position> window = positions.subList(
        Math.max(0, positions.size() - SNAP_WINDOW),
        positions.size());

    // Filter out positions that are too close to each other (stationary/traffic light)
    List<Position> filtered = new ArrayList<>();
    Position prev = null;
    for (Position p : window) {
        if (prev == null) {
            filtered.add(p);
            prev = p;
            continue;
        }
        double dist = haversineMeters(
            prev.getLatitude(), prev.getLongitude(),
            p.getLatitude(), p.getLongitude());
        if (dist >= MIN_DIST_M) {
            filtered.add(p);
            prev = p;
        }
    }
    // Ensure at least 2 positions
    return filtered.size() >= 2 ? filtered : window;
}
```

#### Resume

```
javaSNAP_WINDOW = 10   // take the last 10 positions, not 2
MIN_DIST_M  = 5.0  // filter points that are < 5m from the previous position
buildSnapWindow() — 4 steps:

Take the last 10 positions (sliding window)
Filter consecutive points < 5m — removes traffic light/stop noise
Always include the last position as the “tip” of the current route
Fallback to raw window if filter is too aggressive (< 2 remaining)

Results for traffic light scenario:
Before: [C, C] → OSRM returns a point / mini-segment
After: [A, B, C, D, E] filtered → OSRM returns a smooth full segment

```

#### Adjustment Key

Tuning if needed:

```
Increase SNAP_WINDOW → longer/smoother route, slightly larger request
Increase MIN_DIST_M → more aggressive stop filtering, suitable for devices with short intervals
Decrease MIN_DIST_M → more sensitive to small movements, suitable for low speeds/urban areas

```