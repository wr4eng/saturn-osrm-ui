// src/map/MapTripPathSnap.js
// Renders OSRM /trip/v1 route geometry on the map.
// Input: legs[] from TripPlanResult.osrmResult.legs
// Geometry is stored as [lon, lat] pairs in legs[0].geometry (overview=full).

import { useId, useEffect } from 'react';
import { useAttributePreference } from '../common/util/preferences';
import { map } from './core/MapView';

// teal/green to visually distinguish from route-snap (blue)
const TRIP_LINE_COLOR = '#008777';
const TRIP_LINE_WIDTH_DEFAULT = 4;
const TRIP_LINE_OPACITY_DEFAULT = 0.85;

const MapTripPathSnap = ({ legs, color, width, opacity }) => {
  const id = useId();

  const mapLineWidth = useAttributePreference('mapLineWidth', TRIP_LINE_WIDTH_DEFAULT);
  const mapLineOpacity = useAttributePreference('mapLineOpacity', TRIP_LINE_OPACITY_DEFAULT);

  const resolvedColor = color ?? TRIP_LINE_COLOR;
  const resolvedWidth = width ?? mapLineWidth;
  const resolvedOpacity = opacity ?? mapLineOpacity;

  useEffect(() => {
    map.addSource(id, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    // white outline for contrast
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
    if (!legs?.length) return;

    const features = [];

    legs.forEach((leg) => {
      if (!leg.geometry?.length || leg.geometry.length < 2) return;
      // geometry is already [lon, lat] from OSRM GeoJSON output
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: leg.geometry,
        },
      });
    });

    map.getSource(id)?.setData({
      type: 'FeatureCollection',
      features,
    });
  }, [legs]);

  return null;
};

export default MapTripPathSnap;
