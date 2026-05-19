#### // LiveRouteSnapResource.java — GET /api/route/live-snap?deviceId=X

```
- Retrieve positions from CacheManager.getPositions(deviceId) — Real-time deque, no database
- Retrieve the last 2 positions from the deque for the snap segment
- Call OsrmClient.calculateRoute() — cache is bypassed because of live data
- Return GeoJSON Feature LineString
- Fall back to a straight line if OSRM fails
```


#### // src/map/main/MapLiveRoutesSnap.js

```
- Trigger: useEffect to watch Redux history — only fetch if history[deviceId].length increases (new position)
- AbortController per device — cancel in-flight fetch if a new position arrives before the fetch completes
- Merge strategy: FeatureCollection per device, replace old features by properties.deviceId
- Color: #00838F (cyan-teal) — distinct from raw live routes
- Silent fallback — if fetch fails, raw MapLiveRoutes continue to render normally
```


#### // src/resources/l10n/en.json

```
"mapLiveRoutesSnap": "Live Route Snap (OSRM)"
```

#### Enable in user preferences:

```
mapLiveRoutes = selected (or all)
mapLiveRoutesSnap = true
mapFollow = true
```


#### Flow : 

```
Device sends location → Saturn backend → WebSocket → Redux history[]
                                     ↓
                              (if mapLiveRoutesSnap=true)
                              GET  /api/route/live-snap?deviceId=X
                                     ↓
                              Saturn → OSRM route/v1 (internal)
                                     ↓
                              Returns a snapped [lon,lat][] segment
```                              

#### Adjustment Key

```
// src/api/resource/LiveRouteSnapResource.java (BACKEND)
  GET /api/route/live-snap?deviceId=X

Tuning if needed:

- Increase SNAP_WINDOW → longer/smoother route, slightly larger request
- Increase MIN_DIST_M → more aggressive stop filtering, suitable for devices with short intervals
- Decrease MIN_DIST_M → more sensitive to small movements, suitable for low speeds/urban areas



  → retrieve the last 2 positions from CacheManager
  → call OsrmClient.calculateRoute()
  → return List<double[]> coordinates [lon,lat]
  
  src/map/main/MapLiveRoutesSnap.js         
  - Same as MapLiveRoutes.js
  - But fetches /api/route/snap per device
  - Updates geometry for each new segment

  src/common/attributes/useCommonUserAttributes.js (PATCH)
  + mapLiveRoutesSnap: boolean

  src/MainMap.jsx (PATCH)
  + <MapLiveRoutesSnap> conditional

```

  
  



