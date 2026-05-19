// src/map/MapEtaMarkers.js
// Renders vehicle markers and geofence centroid markers for ETA matrix.
// Vehicles: blue circles with device name label
// Geofences: orange diamonds with geofence name label
// Nearest vehicle per geofence: highlighted with green stroke

import { useId, useCallback, useEffect } from 'react';
import { map } from './core/MapView';

const VEHICLE_COLOR = '#1565C0'; // blue
const GEOFENCE_COLOR = '#E65100'; // orange
const NEAREST_STROKE = '#2E7D32'; // green stroke for nearest vehicle
const RADIUS_VEHICLE = 10;
const RADIUS_GEOFENCE = 10;

const MapEtaMarkers = ({ stops, geofenceMarkers, nearestMap, showNearest, onVehicleClick }) => {
  const vehicleId = useId();
  const geofenceId = useId();

  const onMouseEnter = () => (map.getCanvas().style.cursor = 'pointer');
  const onMouseLeave = () => (map.getCanvas().style.cursor = '');

  const onVehicleMarkerClick = useCallback(
    (event) => {
      event.preventDefault();
      const feature = event.features[0];
      if (onVehicleClick) {
        onVehicleClick(feature.properties.deviceName);
      }
    },
    [onVehicleClick],
  );

  // --- Vehicle source + layers ---
  useEffect(() => {
    map.addSource(vehicleId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    map.addLayer({
      id: `${vehicleId}-halo`,
      type: 'circle',
      source: vehicleId,
      paint: {
        'circle-radius': RADIUS_VEHICLE + 3,
        'circle-color': '#ffffff',
        'circle-opacity': 0.6,
      },
    });

    map.addLayer({
      id: `${vehicleId}-circle`,
      type: 'circle',
      source: vehicleId,
      paint: {
        'circle-radius': RADIUS_VEHICLE,
        'circle-color': VEHICLE_COLOR,
        'circle-opacity': 0.9,
        'circle-stroke-width': ['case', ['get', 'isNearest'], 3, 1.5],
        'circle-stroke-color': ['case', ['get', 'isNearest'], NEAREST_STROKE, '#ffffff'],
      },
    });

    map.addLayer({
      id: `${vehicleId}-label`,
      type: 'symbol',
      source: vehicleId,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 11,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-offset': [0, 1.8],
        'text-anchor': 'top',
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': VEHICLE_COLOR,
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
      },
    });

    map.on('mouseenter', `${vehicleId}-circle`, onMouseEnter);
    map.on('mouseleave', `${vehicleId}-circle`, onMouseLeave);
    map.on('click', `${vehicleId}-circle`, onVehicleMarkerClick);

    return () => {
      map.off('mouseenter', `${vehicleId}-circle`, onMouseEnter);
      map.off('mouseleave', `${vehicleId}-circle`, onMouseLeave);
      map.off('click', `${vehicleId}-circle`, onVehicleMarkerClick);
      [`${vehicleId}-halo`, `${vehicleId}-circle`, `${vehicleId}-label`].forEach((l) => {
        if (map.getLayer(l)) map.removeLayer(l);
      });
      if (map.getSource(vehicleId)) map.removeSource(vehicleId);
    };
  }, [onVehicleMarkerClick]);

  // --- Geofence source + layers ---
  useEffect(() => {
    map.addSource(geofenceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    map.addLayer({
      id: `${geofenceId}-circle`,
      type: 'circle',
      source: geofenceId,
      paint: {
        'circle-radius': RADIUS_GEOFENCE,
        'circle-color': GEOFENCE_COLOR,
        'circle-opacity': 0.85,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    });

    map.addLayer({
      id: `${geofenceId}-label`,
      type: 'symbol',
      source: geofenceId,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 11,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-offset': [0, 1.8],
        'text-anchor': 'top',
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': GEOFENCE_COLOR,
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
      },
    });

    return () => {
      [`${geofenceId}-circle`, `${geofenceId}-label`].forEach((l) => {
        if (map.getLayer(l)) map.removeLayer(l);
      });
      if (map.getSource(geofenceId)) map.removeSource(geofenceId);
    };
  }, []);

  // --- Update vehicle features ---
  useEffect(() => {
    if (!stops?.length) return;

    // nearestMap: { deviceName: [geofenceName, ...] }
    const nearestDevices = new Set(
      showNearest ? Object.values(nearestMap ?? {}).map((c) => c.deviceName) : [],
    );

    map.getSource(vehicleId)?.setData({
      type: 'FeatureCollection',
      features: stops.map((stop) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [stop.position.longitude, stop.position.latitude],
        },
        properties: {
          deviceName: stop.deviceName,
          label: stop.deviceName,
          isNearest: nearestDevices.has(stop.deviceName),
        },
      })),
    });
  }, [stops, nearestMap, showNearest]);

  // --- Update geofence features ---
  useEffect(() => {
    if (!geofenceMarkers?.length) return;

    map.getSource(geofenceId)?.setData({
      type: 'FeatureCollection',
      features: geofenceMarkers.map((gf) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [gf.longitude, gf.latitude],
        },
        properties: {
          name: gf.name,
          label: gf.name,
        },
      })),
    });
  }, [geofenceMarkers]);

  return null;
};

export default MapEtaMarkers;
