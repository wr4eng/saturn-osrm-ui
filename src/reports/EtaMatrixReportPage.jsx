// src/reports/EtaMatrixReportPage.jsx

// eslint-disable-next-line no-unused-vars
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Box,
  Chip,
  FormControlLabel,
  // eslint-disable-next-line no-unused-vars
  IconButton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import SpeedIcon from '@mui/icons-material/Speed';
import RouteIcon from '@mui/icons-material/Route';
import TableChartIcon from '@mui/icons-material/TableChart';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import ReportsMenu from './components/ReportsMenu';
import ReportFilter, { updateReportParams } from './components/ReportFilter';
import SelectField from '../common/components/SelectField';
import { useCatch } from '../reactHelper';
import MapView from '../map/core/MapView';
import MapEtaMarkers from '../map/MapEtaMarkers';
import MapCamera from '../map/MapCamera';
import MapGeofence from '../map/MapGeofence';
import MapScale from '../map/MapScale';
import useReportStyles from './common/useReportStyles';
import useResizableLayout from './common/useResizableLayout';
import TableShimmer from '../common/components/TableShimmer';
import fetchOrThrow from '../common/util/fetchOrThrow';

// ─── Formatters ──────────────────────────────────────────────────────────────

const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const formatDistance = (meters) => {
  if (!meters || meters < 0) return '—';
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
};

// ─── Component ───────────────────────────────────────────────────────────────

const EtaMatrixReportPage = () => {
  const { classes } = useReportStyles();
  const t = useTranslation();

  const { ratio, setRatio, containerRef, dividerProps } = useResizableLayout(0.55);

  const [searchParams, setSearchParams] = useSearchParams();
  const geofenceIds = useMemo(() => searchParams.getAll('geofenceId').map(Number), [searchParams]);

  // eslint-disable-next-line no-unused-vars
  const geofences = useSelector((state) => state.geofences.items);

  // ── State ──────────────────────────────────────────────────────────────────
  const [result, setResult] = useState(null); // full TableMatrixResult
  const [loading, setLoading] = useState(false);
  const [showNearest, setShowNearest] = useState(false); // toggle view
  const [selectedDevice, setSelectedDevice] = useState(null);

  // ── Derived: geofence centroid markers for map ─────────────────────────────
  // Extract centroid from TableMatrixResult.destinations (Coordinate list)
  const geofenceMarkers = useMemo(() => {
    if (!result) return [];
    return result.geofenceNames.map((name, i) => ({
      name,
      latitude: result.osrmResult.destinations[i]?.lat ?? 0,
      longitude: result.osrmResult.destinations[i]?.lon ?? 0,
    }));
  }, [result]);

  // ── Derived: stops list (vehicle last positions) for map ───────────────────
  // eslint-disable-next-line no-unused-vars
  const stops = useMemo(() => {
    if (!result) return [];
    // cells is row-major: cells[s * dstCount + d]
    // We just need one entry per device for map markers
    const seen = new Set();
    return result.cells
      .filter((c) => {
        if (seen.has(c.deviceName)) return false;
        seen.add(c.deviceName);
        return true;
      })
      .map((c) => ({ deviceName: c.deviceName, position: null }));
    // Note: position.lat/lon not in EtaCell — we use osrmResult.sources instead
  }, [result]);

  // ── Derived: vehicle map features from osrmResult.sources ─────────────────
  const vehicleStops = useMemo(() => {
    if (!result) return [];
    return result.deviceNames.map((name, i) => ({
      deviceName: name,
      position: {
        id: i,
        latitude: result.osrmResult.sources[i]?.lat ?? 0,
        longitude: result.osrmResult.sources[i]?.lon ?? 0,
      },
    }));
  }, [result]);

  // ── Derived: nearestMap { geofenceName → EtaCell } ────────────────────────
  const nearestMap = useMemo(() => result?.nearestPerGeofence ?? {}, [result]);

  // ── Camera positions: vehicles + geofence centroids ────────────────────────
  const cameraPositions = useMemo(() => {
    if (!result) return [];
    const vehiclePos = vehicleStops.map((s) => s.position);
    const geofencePos = geofenceMarkers.map((g) => ({
      latitude: g.latitude,
      longitude: g.longitude,
    }));
    return [...vehiclePos, ...geofencePos];
  }, [vehicleStops, geofenceMarkers]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const onShow = useCatch(async ({ deviceIds, groupIds }) => {
    if (!geofenceIds.length) return;

    const query = new URLSearchParams();
    deviceIds.forEach((id) => query.append('deviceId', id));
    groupIds.forEach((id) => query.append('groupId', id));
    geofenceIds.forEach((id) => query.append('geofenceId', id));

    setLoading(true);
    try {
      const response = await fetchOrThrow(`/api/reports/table?${query.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      const data = await response.json();
      setResult(data);
      setSelectedDevice(null);
    } finally {
      setLoading(false);
    }
  });

  // ── Matrix: rows = devices, cols = geofences ───────────────────────────────
  // Build lookup: { deviceName_geofenceName → EtaCell }
  const cellMap = useMemo(() => {
    if (!result) return {};
    const map = {};
    result.cells.forEach((c) => {
      map[`${c.deviceName}__${c.geofenceName}`] = c;
    });
    return map;
  }, [result]);

  // Rows to display — all devices or only nearest devices
  const displayedDeviceNames = useMemo(() => {
    if (!result) return [];
    if (!showNearest) return result.deviceNames;
    // Keep only devices that are nearest to at least one geofence
    const nearestSet = new Set(Object.values(nearestMap).map((c) => c.deviceName));
    return result.deviceNames.filter((n) => nearestSet.has(n));
  }, [result, showNearest, nearestMap]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'reportEtaMatrix']}>
      <div className={classes.container} ref={containerRef}>
        {/* MAP PANE */}
        <div
          className={classes.containerMapResizable}
          style={{ flexBasis: `${Math.round(ratio * 100)}%` }}
        >
          <MapView>
            <MapGeofence />
            {result && (
              <MapEtaMarkers
                stops={vehicleStops}
                geofenceMarkers={geofenceMarkers}
                nearestMap={nearestMap}
                showNearest={showNearest}
                onVehicleClick={setSelectedDevice}
              />
            )}
          </MapView>
          <MapScale />
          {cameraPositions.length > 0 && <MapCamera positions={cameraPositions} />}

          {/* Summary chips */}
          {result && (
            <div
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                pointerEvents: 'none',
              }}
            >
              <Chip
                icon={<TableChartIcon />}
                label={`${result.deviceNames.length} × ${result.geofenceNames.length}`}
                size="small"
                color="primary"
                variant="filled"
              />
              <Chip
                icon={<GpsFixedIcon />}
                label={`${result.deviceNames.length} vehicles`}
                size="small"
                color="primary"
                variant="outlined"
              />
              <Chip
                icon={<RouteIcon />}
                label={`${result.geofenceNames.length} geofences`}
                size="small"
                sx={{ color: '#E65100', borderColor: '#E65100' }}
                variant="outlined"
              />
            </div>
          )}

          {/* Resize buttons */}
          <div className={classes.resizePresetButtons}>
            <button
              className={classes.resizePresetButton}
              onClick={() => setRatio(0.8)}
              title="Zoom map"
            >
              ▲
            </button>
            <button
              className={classes.resizePresetButton}
              onClick={() => setRatio(0.5)}
              title="50/50"
            >
              —
            </button>
            <button
              className={classes.resizePresetButton}
              onClick={() => setRatio(0.25)}
              title="Enlarge table"
            >
              ▼
            </button>
          </div>
        </div>

        {/* DRAG DIVIDER */}
        <div className={classes.resizeDivider} {...dividerProps}>
          <div className={classes.resizeDividerHandle} />
        </div>

        {/* DATA PANE */}
        <div className={classes.containerMainResizable}>
          <div className={classes.header}>
            <ReportFilter onShow={onShow} deviceType="multiple" loading={loading} showDates={false}>
              {/* Geofence selector — same pattern as GeofenceReportPage */}
              <div className={classes.filterItem}>
                <SelectField
                  label={t('sharedGeofences')}
                  value={geofenceIds}
                  onChange={(e) =>
                    updateReportParams(searchParams, setSearchParams, 'geofenceId', e.target.value)
                  }
                  endpoint="/api/geofences"
                  multiple
                  singleLine
                  fullWidth
                />
              </div>
            </ReportFilter>
          </div>

          {/* View toggle */}
          {result && (
            <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={showNearest}
                    onChange={(e) => setShowNearest(e.target.checked)}
                    color="success"
                    size="small"
                  />
                }
                label={
                  <Typography variant="body2">
                    {showNearest ? 'Nearest only' : 'All vehicles'}
                  </Typography>
                }
              />
              {selectedDevice && (
                <Chip
                  label={selectedDevice}
                  size="small"
                  color="primary"
                  onDelete={() => setSelectedDevice(null)}
                  icon={<GpsFixedIcon />}
                />
              )}
            </Box>
          )}

          {/* Matrix table: rows = devices, cols = geofences */}
          <div style={{ overflowX: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {/* Corner cell */}
                  <TableCell
                    sx={{
                      fontWeight: 'bold',
                      minWidth: 120,
                      backgroundColor: 'background.paper',
                      borderRight: '2px solid',
                      borderColor: 'divider',
                    }}
                  >
                    {t('sharedDevice')} / {t('sharedGeofence')}
                  </TableCell>
                  {result?.geofenceNames.map((gfName) => (
                    <TableCell
                      key={gfName}
                      align="center"
                      sx={{
                        fontWeight: 'bold',
                        minWidth: 110,
                        color: '#E65100',
                        backgroundColor: 'background.paper',
                      }}
                    >
                      {gfName}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {!loading ? (
                  displayedDeviceNames.map((deviceName) => {
                    const isSelected = selectedDevice === deviceName;
                    return (
                      <TableRow
                        key={deviceName}
                        selected={isSelected}
                        sx={{ cursor: 'pointer' }}
                        onClick={() => setSelectedDevice(isSelected ? null : deviceName)}
                      >
                        {/* Device name cell */}
                        <TableCell
                          sx={{
                            fontWeight: 'bold',
                            borderRight: '2px solid',
                            borderColor: 'divider',
                            color: '#1565C0',
                          }}
                        >
                          {deviceName}
                        </TableCell>

                        {/* ETA cells per geofence */}
                        {result.geofenceNames.map((gfName) => {
                          const cell = cellMap[`${deviceName}__${gfName}`];
                          const isNearest = cell?.nearest ?? false;
                          const noRoute = !cell || cell.durationSeconds < 0;

                          return (
                            <TableCell
                              key={gfName}
                              align="center"
                              sx={{
                                backgroundColor: isNearest ? 'rgba(46, 125, 50, 0.08)' : undefined,
                                border: isNearest
                                  ? '1.5px solid rgba(46, 125, 50, 0.5)'
                                  : undefined,
                              }}
                            >
                              {noRoute ? (
                                <Typography variant="caption" color="text.disabled">
                                  —
                                </Typography>
                              ) : (
                                <Tooltip
                                  title={`${formatDistance(cell.distanceMeters)} · ${formatDuration(cell.durationSeconds)}`}
                                  arrow
                                >
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      gap: 0.25,
                                    }}
                                  >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                      <SpeedIcon
                                        sx={{
                                          fontSize: 12,
                                          color: isNearest ? 'success.main' : 'text.secondary',
                                        }}
                                      />
                                      <Typography
                                        variant="body2"
                                        fontWeight={isNearest ? 'bold' : 'normal'}
                                        color={isNearest ? 'success.main' : 'text.primary'}
                                      >
                                        {formatDuration(cell.durationSeconds)}
                                      </Typography>
                                    </Box>
                                    <Typography variant="caption" color="text.secondary">
                                      {formatDistance(cell.distanceMeters)}
                                    </Typography>
                                    {isNearest && (
                                      <Chip
                                        label="nearest"
                                        size="small"
                                        color="success"
                                        sx={{ height: 16, fontSize: 10 }}
                                      />
                                    )}
                                  </Box>
                                </Tooltip>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })
                ) : (
                  <TableShimmer columns={(result?.geofenceNames.length ?? 3) + 1} />
                )}
              </TableBody>
            </Table>
          </div>

          {/* Nearest summary section */}
          {result && Object.keys(nearestMap).length > 0 && (
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ color: 'success.main' }}>
                Nearest vehicle per geofence
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {Object.entries(nearestMap).map(([gfName, cell]) => (
                  <Chip
                    key={gfName}
                    icon={<GpsFixedIcon />}
                    label={`${gfName} → ${cell.deviceName} (${formatDuration(cell.durationSeconds)})`}
                    size="small"
                    color="success"
                    variant="outlined"
                    onClick={() => setSelectedDevice(cell.deviceName)}
                  />
                ))}
              </Box>
            </Box>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default EtaMatrixReportPage;
