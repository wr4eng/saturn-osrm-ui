// src/map/MapRoutePathSnap.js

import { useId, useEffect } from 'react';
import { useAttributePreference } from '../common/util/preferences';
import { map } from './core/MapView';

// blue snap route — override by device attribute web.reportColor
const SNAP_LINE_COLOR = '#1565C0';
const SNAP_LINE_WIDTH_DEFAULT = 4;
const SNAP_LINE_OPACITY_DEFAULT = 0.85;

const MapRoutePathSnap = ({ positions, color, width, opacity }) => {
  const id = useId();

  // can be override by device preferences
  const mapLineWidth = useAttributePreference('mapLineWidth', SNAP_LINE_WIDTH_DEFAULT);
  const mapLineOpacity = useAttributePreference('mapLineOpacity', SNAP_LINE_OPACITY_DEFAULT);

  const resolvedColor = color ?? SNAP_LINE_COLOR;
  const resolvedWidth = width ?? mapLineWidth;
  const resolvedOpacity = opacity ?? mapLineOpacity;

  useEffect(() => {
    map.addSource(id, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });

    // Layer outline
    map.addLayer({
      source: id,
      id: `${id}-outline`,
      type: 'line',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#ffffff',
        'line-width': resolvedWidth + 2,
        'line-opacity': resolvedOpacity * 0.4,
      },
    });

    map.addLayer({
      source: id,
      id: `${id}-line`,
      type: 'line',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': resolvedColor,
        'line-width': resolvedWidth,
        'line-opacity': resolvedOpacity,
      },
    });

    return () => {
      [`${id}-outline`, `${id}-line`].forEach((layerId) => {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      });
      if (map.getSource(id)) map.removeSource(id);
    };
  }, []);

  useEffect(() => {
    if (!positions || positions.length < 2) return;

    const features = [];
    for (let i = 0; i < positions.length - 1; i += 1) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [positions[i].longitude, positions[i].latitude],
            [positions[i + 1].longitude, positions[i + 1].latitude],
          ],
        },
      });
    }

    map.getSource(id)?.setData({
      type: 'FeatureCollection',
      features,
    });
  }, [positions, resolvedColor, resolvedWidth, resolvedOpacity]);

  return null;
};

export default MapRoutePathSnap;
