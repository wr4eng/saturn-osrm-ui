// src/map/MapTripStopsSnap.js
// Renders trip stop markers with visit order number labels.
// Input: stops[] from TripPlanResult (sorted by visitOrder)
// Each stop has: position.latitude, position.longitude, visitOrder, deviceName

import { useId, useCallback, useEffect } from 'react';
import { map } from './core/MapView';

const STOP_COLOR = '#008777';
const STOP_RADIUS = 12;

const MapTripStopsSnap = ({ stops, onClick }) => {
  const id = useId();

  const onMouseEnter = () => (map.getCanvas().style.cursor = 'pointer');
  const onMouseLeave = () => (map.getCanvas().style.cursor = '');

  const onMarkerClick = useCallback(
    (event) => {
      event.preventDefault();
      const feature = event.features[0];
      if (onClick) {
        onClick(feature.properties.positionId, feature.properties.visitOrder);
      }
    },
    [onClick],
  );

  useEffect(() => {
    map.addSource(id, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    // outer white halo
    map.addLayer({
      id: `${id}-halo`,
      type: 'circle',
      source: id,
      paint: {
        'circle-radius': STOP_RADIUS + 3,
        'circle-color': '#ffffff',
        'circle-opacity': 0.7,
      },
    });

    // filled circle
    map.addLayer({
      id: `${id}-circle`,
      type: 'circle',
      source: id,
      paint: {
        'circle-radius': STOP_RADIUS,
        'circle-color': STOP_COLOR,
        'circle-opacity': 0.9,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    });

    // visit order number label
    map.addLayer({
      id: `${id}-label`,
      type: 'symbol',
      source: id,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 12,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': '#ffffff',
      },
    });

    map.on('mouseenter', `${id}-circle`, onMouseEnter);
    map.on('mouseleave', `${id}-circle`, onMouseLeave);
    map.on('click', `${id}-circle`, onMarkerClick);

    return () => {
      map.off('mouseenter', `${id}-circle`, onMouseEnter);
      map.off('mouseleave', `${id}-circle`, onMouseLeave);
      map.off('click', `${id}-circle`, onMarkerClick);

      [`${id}-halo`, `${id}-circle`, `${id}-label`].forEach((layerId) => {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      });
      if (map.getSource(id)) map.removeSource(id);
    };
  }, [onMarkerClick]);

  useEffect(() => {
    if (!stops?.length) return;

    map.getSource(id)?.setData({
      type: 'FeatureCollection',
      features: stops.map((stop) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [stop.position.longitude, stop.position.latitude],
        },
        properties: {
          positionId: stop.position.id,
          visitOrder: stop.visitOrder,
          deviceName: stop.deviceName,
          // label: "0" for start, "1", "2"... for subsequent stops
          label: String(stop.visitOrder),
        },
      })),
    });
  }, [stops]);

  return null;
};

export default MapTripStopsSnap;
