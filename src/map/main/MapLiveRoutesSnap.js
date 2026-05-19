// src/map/main/MapLiveRoutesSnap.js
// 2026 WrA (wra.eng@gmail.com)
//
// Live route snap overlay — renders OSRM-snapped route segments on the main map.
// Triggered when: mapLiveRoutesSnap=true AND mapFollow=true (or type=all/selected).
//
// Flow per device:
//   Redux history[deviceId] changes (new position via WebSocket)
//   → fetch GET /api/route/live-snap?deviceId=X
//   → update MapLibre source with returned GeoJSON LineString
//
// Color: SNAP_LINE_COLOR (distinct from web.reportColor used by MapLiveRoutes)
// Fallback: if fetch fails, MapLiveRoutes (raw) still renders normally.

import { useId, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import { map } from '../core/MapView';
import { useAttributePreference } from '../../common/util/preferences';

// Teal — visually distinct from both raw live route and snap report colors
const SNAP_LINE_COLOR = '#00838F'; // cyan-darken-3
const SNAP_LINE_WIDTH = 3;
const SNAP_LINE_OPACITY = 0.9;

const MapLiveRoutesSnap = ({ deviceIds }) => {
  const id = useId();
  // eslint-disable-next-line no-unused-vars
  const theme = useTheme();

  const type = useAttributePreference('mapLiveRoutes', 'none');
  const snapEnabled = useAttributePreference('mapLiveRoutesSnap', false);
  // eslint-disable-next-line no-unused-vars
  const mapFollow = useAttributePreference('mapFollow', false);

  const devices = useSelector((state) => state.devices.items);
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);
  const history = useSelector((state) => state.session.history);

  // Track last history length per device to detect new position
  const prevHistoryLen = useRef({});

  // Track abort controllers per device for in-flight fetch cancellation
  const controllers = useRef({});

  // ── Map source + layer setup

  useEffect(() => {
    if (!snapEnabled || type === 'none') return () => {};

    map.addSource(id, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });

    // Outline for contrast
    map.addLayer({
      source: id,
      id: `${id}-outline`,
      type: 'line',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#ffffff',
        'line-width': SNAP_LINE_WIDTH + 2,
        'line-opacity': SNAP_LINE_OPACITY * 0.35,
      },
    });

    map.addLayer({
      source: id,
      id: `${id}-line`,
      type: 'line',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': SNAP_LINE_COLOR,
        'line-width': SNAP_LINE_WIDTH,
        'line-opacity': SNAP_LINE_OPACITY,
      },
    });

    return () => {
      // Cancel any in-flight fetches
      Object.values(controllers.current).forEach((ctrl) => ctrl.abort());
      controllers.current = {};

      [`${id}-outline`, `${id}-line`].forEach((layerId) => {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      });
      if (map.getSource(id)) map.removeSource(id);
    };
  }, [snapEnabled, type]);

  // ── Fetch snap segment when history changes

  useEffect(() => {
    if (!snapEnabled || type === 'none') return;

    // Determine which devices to snap
    const visibleIds = deviceIds
      .filter((deviceId) => {
        if (type === 'selected') return deviceId === selectedDeviceId;
        return true;
      })
      .filter((deviceId) => history.hasOwnProperty(deviceId))
      .filter((deviceId) => devices[deviceId]);

    // Filter to only devices that received a NEW position
    const updatedIds = visibleIds.filter((deviceId) => {
      const currentLen = history[deviceId]?.length ?? 0;
      const prevLen = prevHistoryLen.current[deviceId] ?? 0;
      return currentLen > prevLen;
    });

    if (updatedIds.length === 0) return;

    // Update prevHistoryLen tracking
    updatedIds.forEach((deviceId) => {
      prevHistoryLen.current[deviceId] = history[deviceId]?.length ?? 0;
    });

    // Fetch snap for each updated device
    updatedIds.forEach(async (deviceId) => {
      // Cancel previous in-flight fetch for this device
      if (controllers.current[deviceId]) {
        controllers.current[deviceId].abort();
      }
      const controller = new AbortController();
      controllers.current[deviceId] = controller;

      try {
        const response = await fetch(`/api/route/live-snap?deviceId=${deviceId}`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });

        if (!response.ok) return;

        const geoJson = await response.json();

        // Merge into FeatureCollection — replace existing feature for this device
        const source = map.getSource(id);
        if (!source) return;

        const current = source._data ?? { type: 'FeatureCollection', features: [] };
        const otherFeatures = (current.features ?? []).filter(
          (f) => f.properties?.deviceId !== deviceId,
        );

        if (geoJson?.geometry?.coordinates?.length >= 2) {
          source.setData({
            type: 'FeatureCollection',
            features: [
              ...otherFeatures,
              {
                ...geoJson,
                properties: { deviceId },
              },
            ],
          });
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          // Silently ignore — MapLiveRoutes raw fallback still renders
          console.warn(`LiveRouteSnap: fetch failed for device ${deviceId}`, err.message);
        }
      } finally {
        delete controllers.current[deviceId];
      }
    });
  }, [history, deviceIds, selectedDeviceId, type, snapEnabled]);

  return null;
};

export default MapLiveRoutesSnap;
