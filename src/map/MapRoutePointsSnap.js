// src/map/MapRoutePointsSnap.js

import { useId, useCallback, useEffect } from 'react';
import { map } from './core/MapView';
//import { findFonts } from './core/mapUtil';

const SNAP_POINT_COLOR = '#1565C0';
const SNAP_POINT_SIZE = 2;
const SNAP_POINT_OPACITY = 0.85;
//const WAY_POINT_COLOR = '#1565C0';
//const WAY_POINT_SIZE = 4;

const MapRoutePointsSnap = ({ positions, onClick }) => {
  const id = useId();

  const onMouseEnter = () => (map.getCanvas().style.cursor = 'pointer');
  const onMouseLeave = () => (map.getCanvas().style.cursor = '');

  const onMarkerClick = useCallback(
    (event) => {
      event.preventDefault();
      const feature = event.features[0];
      if (onClick) {
        onClick(feature.properties.id, feature.properties.index);
      }
    },
    [onClick],
  );

  useEffect(() => {
    map.addSource(id, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    // circle waypoint
    map.addLayer({
      id: `${id}-halo`,
      type: 'circle',
      source: id,
      paint: {
        //'circle-radius': SNAP_POINT_SIZE + 2,
        //'circle-color': '#ffffff',
        //'circle-opacity': 0.6,
        'circle-radius': SNAP_POINT_SIZE,
        'circle-color': SNAP_POINT_COLOR,
        'circle-opacity': SNAP_POINT_OPACITY,
      },
    });

    map.addLayer({
      id,
      type: 'circle',
      source: id,
      paint: {
        //'circle-radius': SNAP_POINT_SIZE,
        //'circle-color': SNAP_POINT_COLOR,
        //'circle-opacity': 0.85,
        //'circle-stroke-width': 1.5,
        //'circle-stroke-color': '#ffffff',
        'circle-radius': SNAP_POINT_SIZE,
        'circle-color': SNAP_POINT_COLOR,
        'circle-opacity': SNAP_POINT_OPACITY,
      },
    });

    map.on('mouseenter', id, onMouseEnter);
    map.on('mouseleave', id, onMouseLeave);
    map.on('click', id, onMarkerClick);

    return () => {
      map.off('mouseenter', id, onMouseEnter);
      map.off('mouseleave', id, onMouseLeave);
      map.off('click', id, onMarkerClick);

      [`${id}-halo`, id].forEach((layerId) => {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      });
      if (map.getSource(id)) map.removeSource(id);
    };
  }, [onMarkerClick]);

  useEffect(() => {
    if (!positions?.length) return;

    map.getSource(id)?.setData({
      type: 'FeatureCollection',
      features: positions.map((position, index) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [position.longitude, position.latitude],
        },
        properties: {
          index,
          id: position.id,
        },
      })),
    });
  }, [positions]);

  return null;
};

export default MapRoutePointsSnap;
