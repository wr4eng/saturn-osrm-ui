// src/reports/TripxSnapReportPage.jsx

import { useCallback, useState } from 'react';
import {
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Typography,
} from '@mui/material';
import ReportFilter from './components/ReportFilter';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import LocationSearchingIcon from '@mui/icons-material/LocationSearching';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import ReportsMenu from './components/ReportsMenu';
import { useCatch } from '../reactHelper';
import MapView from '../map/core/MapView';
import MapTripPathSnap from '../map/MapTripPathSnap';
import MapTripStopsSnap from '../map/MapTripStopsSnap';
import MapCamera from '../map/MapCamera';
import MapGeofence from '../map/MapGeofence';
import MapScale from '../map/MapScale';
import useReportStyles from './common/useReportStyles';
import useResizableLayout from './common/useResizableLayout';
import TableShimmer from '../common/components/TableShimmer';
import fetchOrThrow from '../common/util/fetchOrThrow';

// Format seconds to "Xh Ym" or "Ym Zs"
const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

// Format meters to "X.X km" or "X m"
const formatDistance = (meters) => {
  if (!meters || meters <= 0) return '-';
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
};

const TripxSnapReportPage = () => {
  const { classes } = useReportStyles();
  const t = useTranslation();

  const { ratio, setRatio, containerRef, dividerProps } = useResizableLayout(0.6);

  const [stops, setStops] = useState([]);
  const [legs, setLegs] = useState([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedStop, setSelectedStop] = useState(null);

  // Build camera positions from stop positions
  const cameraPositions = stops.map((s) => s.position);

  const onMapStopClick = useCallback(
    (positionId) => {
      setSelectedStop(stops.find((s) => s.position.id === positionId) ?? null);
    },
    [stops],
  );

  // trip-snap has no from/to — uses last position per device
  const onShow = useCatch(async ({ deviceIds }) => {
    if (!deviceIds?.length) return;
    const query = new URLSearchParams();
    deviceIds.forEach((deviceId) => query.append('deviceId', deviceId));
    setLoading(true);
    try {
      const response = await fetchOrThrow(`/api/reports/tripx-snap?${query.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      const data = await response.json();
      setStops(data.stops ?? []);
      setLegs(data.osrmResult?.legs ?? []);
      setTotalDistance(data.totalDistanceMeters ?? 0);
      setTotalDuration(data.totalDurationSeconds ?? 0);
      setSelectedStop(null);
    } finally {
      setLoading(false);
    }
  });

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'reportTripxSnap']}>
      <div className={classes.container} ref={containerRef}>
        {/* MAP PANE */}
        <div
          className={classes.containerMapResizable}
          style={{ flexBasis: `${Math.round(ratio * 100)}%` }}
        >
          <MapView>
            <MapGeofence />
            {legs.length > 0 && <MapTripPathSnap legs={legs} />}
            {stops.length > 0 && <MapTripStopsSnap stops={stops} onClick={onMapStopClick} />}
          </MapView>
          <MapScale />
          {cameraPositions.length > 0 && <MapCamera positions={cameraPositions} />}

          {/* Summary chip — shown after data loaded */}
          {stops.length > 0 && (
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
                icon={<AltRouteIcon />}
                label={`${stops.length} stops`}
                size="small"
                color="success"
                variant="filled"
              />
              <Chip
                label={formatDistance(totalDistance)}
                size="small"
                color="success"
                variant="outlined"
              />
              <Chip
                label={formatDuration(totalDuration)}
                size="small"
                color="success"
                variant="outlined"
              />
            </div>
          )}

          {/* Resize preset buttons */}
          <div className={classes.resizePresetButtons}>
            <button
              className={classes.resizePresetButton}
              onClick={() => setRatio(0.8)}
              title="Zoom in on the map"
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
              title="Enlarge the table"
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
            {/* deviceType="multiple" — no from/to date picker needed */}
            <ReportFilter
              onShow={onShow}
              deviceType="multiple"
              loading={loading}
              showDates={false}
            />
          </div>

          <Table>
            <TableHead>
              <TableRow>
                <TableCell className={classes.columnAction} />
                <TableCell>#</TableCell>
                <TableCell>{t('sharedDevice')}</TableCell>
                <TableCell>{t('positionLatitude')}</TableCell>
                <TableCell>{t('positionLongitude')}</TableCell>
                <TableCell>{t('positionAddress')}</TableCell>
                <TableCell>{t('reportDistance')}</TableCell>
                <TableCell>{t('reportDuration')}</TableCell>
                <TableCell>{t('deviceLastUpdate')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading ? (
                stops.map((stop) => (
                  <TableRow
                    key={stop.position.id}
                    selected={selectedStop?.position.id === stop.position.id}
                  >
                    <TableCell className={classes.columnAction} padding="none">
                      {selectedStop?.position.id === stop.position.id ? (
                        <IconButton size="small" onClick={() => setSelectedStop(null)}>
                          <GpsFixedIcon fontSize="small" color="success" />
                        </IconButton>
                      ) : (
                        <IconButton size="small" onClick={() => setSelectedStop(stop)}>
                          <LocationSearchingIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                    {/* Visit order badge */}
                    <TableCell>
                      <Chip
                        label={stop.visitOrder}
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ minWidth: 32 }}
                      />
                    </TableCell>
                    <TableCell>{stop.deviceName}</TableCell>
                    <TableCell>{stop.position.latitude?.toFixed(6)}</TableCell>
                    <TableCell>{stop.position.longitude?.toFixed(6)}</TableCell>
                    <TableCell>{stop.position.address ?? '-'}</TableCell>
                    <TableCell>{formatDistance(stop.legDistanceMeters)}</TableCell>
                    <TableCell>{formatDuration(stop.legDurationSeconds)}</TableCell>
                    <TableCell>
                      {stop.position.fixTime
                        ? new Date(stop.position.fixTime).toLocaleString()
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableShimmer columns={9} startAction />
              )}

              {/* Total row */}
              {!loading && stops.length > 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="right">
                    <Typography variant="body2" fontWeight="bold">
                      Total
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {formatDistance(totalDistance)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {formatDuration(totalDuration)}
                    </Typography>
                  </TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </PageLayout>
  );
};

export default TripxSnapReportPage;
