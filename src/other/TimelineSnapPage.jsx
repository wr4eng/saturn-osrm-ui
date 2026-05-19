/* eslint-disable no-unused-vars */
// src/other/TimelineSnapPage.jsx
// 2026 WrA (wra.eng@gmail.com)
//
// Historical timeline page with OSRM snap route.
// Desktop: sidebar left (device + filter) + map + timeline bottom bar
// Mobile:  map full screen + compact timeline bar (back · device · period · show)
//
// Route  : /reports/timeline-snap
// Endpoint: GET /api/reports/route-snap?deviceId=X&from=...&to=...

import { useState, useRef, useCallback, useMemo } from 'react';
import {
  IconButton,
  Paper,
  Toolbar,
  Typography,
  Select,
  MenuItem,
  FormControl,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import MapView from '../map/core/MapView';
import MapRoutePathSnap from '../map/MapRoutePathSnap';
import MapRoutePointsSnap from '../map/MapRoutePointsSnap';
import MapPositions from '../map/MapPositions';
import MapCamera from '../map/MapCamera';
import MapGeofence from '../map/MapGeofence';
import MapScale from '../map/MapScale';
import MapOverlay from '../map/overlay/MapOverlay';
import ReportFilter from '../reports/components/ReportFilter';
import StatusCard from '../common/components/StatusCard';
import BackIcon from '../common/components/BackIcon';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useCatch } from '../reactHelper';
import { formatTime } from '../common/util/formatter';
import fetchOrThrow from '../common/util/fetchOrThrow';

// ─── Constants ────────────────────────────────────────────────────────────────

const MOVEMENT_THRESHOLD_M = 20; // meters — same as HTML
const TIMELINE_HEIGHT = 90; // px — collapsed height
const TIMELINE_HEIGHT_OPEN = 130; // px — expanded with info row

// ─── Styles ───────────────────────────────────────────────────────────────────

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
    // Reserve space for timeline bar at bottom
    paddingBottom: TIMELINE_HEIGHT_OPEN,
  },
  // Sidebar — desktop only, hidden on mobile
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    zIndex: 3,
    left: 0,
    top: 0,
    margin: theme.spacing(1.5),
    width: theme.dimensions.drawerWidthDesktop,
    [theme.breakpoints.down('md')]: {
      display: 'none', // hidden on mobile — controls move to timeline bar
    },
  },
  title: {
    flexGrow: 1,
  },
  snapBadge: {
    fontSize: 10,
    fontWeight: 500,
    lineHeight: 1,
    padding: '2px 6px',
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.dark,
    marginLeft: theme.spacing(1),
    alignSelf: 'center',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(2),
    [theme.breakpoints.down('md')]: {
      margin: theme.spacing(1),
    },
    [theme.breakpoints.up('md')]: {
      marginTop: theme.spacing(1),
    },
  },

  // ── Timeline bottom bar ──────────────────────────────────────────────────────
  timelineBar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 4,
    backgroundColor: theme.palette.background.paper,
    borderTop: `1px solid ${theme.palette.divider}`,
    boxShadow: '0 -2px 6px rgba(0,0,0,0.12)',
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(0.75, 1.5, 0.5, 1.5),
    userSelect: 'none',
  },
  timelineTrackArea: {
    position: 'relative',
    width: '100%',
    height: 28,
    backgroundColor: theme.palette.action.hover,
    borderRadius: theme.shape.borderRadius,
    cursor: 'crosshair',
    overflow: 'hidden',
    marginBottom: theme.spacing(0.25),
  },
  // Movement segment bar
  timelineSegment: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    height: '60%',
    borderRadius: 3,
    opacity: 0.82,
    transition: 'opacity 0.15s',
    '&:hover': {
      opacity: 1,
    },
  },
  // Scrubber line
  scrubberLine: {
    position: 'absolute',
    top: 0,
    width: 2,
    height: '100%',
    backgroundColor: theme.palette.text.primary,
    pointerEvents: 'none',
    zIndex: 5,
    transform: 'translateX(-50%)',
  },
  scrubberLocked: {
    backgroundColor: theme.palette.primary.main,
    width: 3,
  },
  // Tick labels row
  timelineTickRow: {
    position: 'relative',
    width: '100%',
    height: 16,
    pointerEvents: 'none',
  },
  timelineTick: {
    position: 'absolute',
    fontSize: 10,
    color: theme.palette.text.secondary,
    whiteSpace: 'nowrap',
  },
  // Info row below ticks
  timelineInfoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    marginTop: theme.spacing(0.25),
    minHeight: 20,
  },
  timelineInfoText: {
    fontSize: 11,
    color: theme.palette.text.secondary,
  },
  timelineInfoHighlight: {
    fontSize: 11,
    color: theme.palette.primary.main,
    fontWeight: 600,
  },
  // Mobile-only compact controls row inside timeline bar
  mobileControlsRow: {
    display: 'none',
    [theme.breakpoints.down('md')]: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      marginBottom: theme.spacing(0.5),
    },
  },
  mobileSelect: {
    fontSize: 13,
    height: 32,
    flex: 1,
    minWidth: 0,
    '& .MuiSelect-select': {
      padding: '4px 8px',
    },
  },
  mobileShowBtn: {
    flexShrink: 0,
    fontSize: 12,
    padding: '4px 10px',
    height: 32,
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    border: 'none',
    borderRadius: theme.shape.borderRadius,
    cursor: 'pointer',
    '&:disabled': {
      opacity: 0.5,
      cursor: 'default',
    },
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Detect movement segments from position array. */
function detectMovementSegments(positions) {
  if (!positions || positions.length < 2) return [];
  const segments = [];
  let segStart = null;
  let segEnd = null;

  for (let i = 1; i < positions.length; i++) {
    const prev = positions[i - 1];
    const curr = positions[i];
    const dist = haversineM(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    if (dist >= MOVEMENT_THRESHOLD_M) {
      if (!segStart) segStart = new Date(prev.fixTime);
      segEnd = new Date(curr.fixTime);
    } else {
      if (segStart && segEnd) {
        segments.push({ start: segStart, end: segEnd });
        segStart = null;
        segEnd = null;
      }
    }
  }
  if (segStart && segEnd) {
    segments.push({ start: segStart, end: segEnd });
  }
  return segments;
}

/** Generate tick marks for the timeline. */
function generateTicks(startMs, endMs) {
  const durationH = (endMs - startMs) / 3600000;
  let intervalMs;
  let fmt;

  if (durationH <= 6) {
    intervalMs = 3600000; // 1h
    fmt = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (durationH <= 24) {
    intervalMs = 4 * 3600000; // 4h
    fmt = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (durationH <= 72) {
    intervalMs = 12 * 3600000;
    fmt = (d) =>
      d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ' ' +
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    intervalMs = 24 * 3600000;
    fmt = (d) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  const ticks = [];
  for (let t = startMs; t <= endMs; t += intervalMs) {
    ticks.push({ ms: t, label: fmt(new Date(t)) });
  }
  return ticks;
}

function formatSpeed(knots) {
  if (knots == null) return null;
  return `${(knots * 1.852).toFixed(1)} km/h`;
}

// ─── Timeline component ───────────────────────────────────────────────────────

const TimelineBar = ({
  positions,
  segments,
  startMs,
  endMs,
  lockedIndex,
  onScrub,
  color,
  // mobile props
  isMobile,
  deviceList,
  selectedDeviceId,
  onDeviceChange,
  period,
  onPeriodChange,
  onMobileShow,
  loading,
}) => {
  const { classes, cx } = useStyles();
  const trackRef = useRef(null);

  const durationMs = endMs - startMs;

  const ticks = useMemo(() => generateTicks(startMs, endMs), [startMs, endMs]);

  const xFromEvent = useCallback((clientX) => {
    if (!trackRef.current) return null;
    const rect = trackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const handlePointer = useCallback(
    (clientX) => {
      const frac = xFromEvent(clientX);
      if (frac == null || !positions.length) return;
      const targetMs = startMs + frac * durationMs;
      // Find closest position index
      let best = 0;
      let bestDiff = Infinity;
      positions.forEach((p, i) => {
        const diff = Math.abs(new Date(p.fixTime).getTime() - targetMs);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = i;
        }
      });
      onScrub(best);
    },
    [xFromEvent, positions, startMs, durationMs, onScrub],
  );

  const onMouseDown = useCallback(
    (e) => {
      handlePointer(e.clientX);
      const onMove = (ev) => handlePointer(ev.clientX);
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [handlePointer],
  );

  const onTouchStart = useCallback(
    (e) => {
      handlePointer(e.touches[0].clientX);
    },
    [handlePointer],
  );

  // Scrubber position
  const scrubberPct =
    positions.length && lockedIndex != null
      ? ((new Date(positions[lockedIndex].fixTime).getTime() - startMs) / durationMs) * 100
      : null;

  const lockedPos = lockedIndex != null && positions[lockedIndex];

  return (
    <div className={classes.timelineBar}>
      {/* Mobile-only compact controls row: ← back · device · period · SHOW */}
      {isMobile && (
        <div className={classes.mobileControlsRow}>
          <IconButton size="small" onClick={() => history.back()} sx={{ flexShrink: 0 }}>
            <BackIcon />
          </IconButton>
          <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
            <Select
              className={classes.mobileSelect}
              value={selectedDeviceId ?? ''}
              onChange={(e) => onDeviceChange(e.target.value)}
              displayEmpty
              renderValue={(v) => {
                if (!v) return <em style={{ fontSize: 12, opacity: 0.6 }}>Device</em>;
                const d = deviceList.find((x) => x.id === v);
                return d ? d.name : v;
              }}
            >
              {deviceList.map((d) => (
                <MenuItem key={d.id} value={d.id} sx={{ fontSize: 13 }}>
                  {d.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 90 }}>
            <Select
              className={classes.mobileSelect}
              value={period}
              onChange={(e) => onPeriodChange(e.target.value)}
            >
              <MenuItem value="today" sx={{ fontSize: 12 }}>
                Today
              </MenuItem>
              <MenuItem value="yesterday" sx={{ fontSize: 12 }}>
                Yesterday
              </MenuItem>
              <MenuItem value="thisWeek" sx={{ fontSize: 12 }}>
                This week
              </MenuItem>
              <MenuItem value="previousWeek" sx={{ fontSize: 12 }}>
                Prev week
              </MenuItem>
              <MenuItem value="thisMonth" sx={{ fontSize: 12 }}>
                This month
              </MenuItem>
            </Select>
          </FormControl>
          <button
            className={classes.mobileShowBtn}
            disabled={!selectedDeviceId || loading}
            onClick={onMobileShow}
          >
            {loading ? '…' : 'Show'}
          </button>
        </div>
      )}

      {/* Track */}
      <div
        ref={trackRef}
        className={classes.timelineTrackArea}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        {/* Movement segments */}
        {segments.map((seg, i) => {
          const left = ((seg.start.getTime() - startMs) / durationMs) * 100;
          const width = ((seg.end.getTime() - seg.start.getTime()) / durationMs) * 100;
          return (
            <div
              key={i}
              className={classes.timelineSegment}
              style={{
                left: `${Math.max(0, left)}%`,
                width: `${Math.min(100 - left, width)}%`,
                backgroundColor: color,
              }}
            />
          );
        })}

        {/* Scrubber */}
        {scrubberPct != null && (
          <div
            className={cx(classes.scrubberLine, classes.scrubberLocked)}
            style={{ left: `${scrubberPct}%` }}
          />
        )}
      </div>

      {/* Tick labels */}
      <div className={classes.timelineTickRow}>
        {ticks.map((tick, i) => {
          const pct = ((tick.ms - startMs) / durationMs) * 100;
          const isFirst = i === 0;
          const isLast = i === ticks.length - 1;
          return (
            <span
              key={tick.ms}
              className={classes.timelineTick}
              style={{
                left: isFirst ? '0%' : isLast ? 'auto' : `${pct}%`,
                right: isLast ? '0%' : 'auto',
                transform: isFirst || isLast ? 'none' : 'translateX(-50%)',
              }}
            >
              {tick.label}
            </span>
          );
        })}
      </div>

      {/* Info row */}
      <div className={classes.timelineInfoRow}>
        {lockedPos ? (
          <>
            <span className={classes.timelineInfoHighlight}>
              {formatTime(lockedPos.fixTime, 'seconds')}
            </span>
            {lockedPos.speed > 0 && (
              <span className={classes.timelineInfoText}>{formatSpeed(lockedPos.speed)}</span>
            )}
            {lockedPos.address && (
              <span
                className={classes.timelineInfoText}
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {lockedPos.address}
              </span>
            )}
            <span className={classes.timelineInfoText}>
              {`${lockedIndex + 1} / ${positions.length}`}
            </span>
          </>
        ) : (
          <span className={classes.timelineInfoText}>
            {positions.length > 0
              ? `${positions.length} positions — click or drag to scrub`
              : 'Select a device and time range'}
          </span>
        )}
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const TimelineSnapPage = () => {
  const t = useTranslation();
  const { classes } = useStyles();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const defaultDeviceId = useSelector((state) => state.devices.selectedId);
  const deviceList = useSelector((state) =>
    Object.values(state.devices.items).sort((a, b) => a.name.localeCompare(b.name)),
  );

  const [positions, setPositions] = useState([]);
  const [index, setIndex] = useState(0);
  const [selectedDeviceId, setSelectedDeviceId] = useState(defaultDeviceId);
  const [showCard, setShowCard] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState({ startMs: 0, endMs: 0 });
  // Mobile period picker state
  const [mobilePeriod, setMobilePeriod] = useState('today');

  const loaded = Boolean(positions.length && !loading);

  // Device color from Redux (use web.reportColor or fallback)
  const deviceColor = useSelector((state) => {
    const device = state.devices.items[selectedDeviceId];
    return device?.attributes?.['web.reportColor'] ?? '#1565C0';
  });

  // Movement segments derived from positions
  const segments = useMemo(() => detectMovementSegments(positions), [positions]);

  // Fetch snapped route
  const onShow = useCatch(async ({ deviceIds, from, to }) => {
    const deviceId = deviceIds.find(() => true);
    if (!deviceId) return;
    setLoading(true);
    setSelectedDeviceId(deviceId);
    setIndex(0);
    setShowCard(false);
    const query = new URLSearchParams({ deviceId, from, to });
    try {
      const response = await fetchOrThrow(`/api/reports/route-snap?${query.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      const data = await response.json();
      setPositions(data);
      if (data.length) {
        setTimeRange({
          startMs: new Date(data[0].fixTime).getTime(),
          endMs: new Date(data[data.length - 1].fixTime).getTime(),
        });
        setIndex(0);
      }
      if (!data.length) throw Error(t('sharedNoData'));
    } finally {
      setLoading(false);
    }
  });

  const onScrub = useCallback((i) => {
    setIndex(i);
    setShowCard(false);
  }, []);

  const onPointClick = useCallback((_, idx) => {
    setIndex(idx);
  }, []);

  const onMarkerClick = useCallback((positionId) => {
    setShowCard(!!positionId);
  }, []);

  /** Mobile Show button — derives from/to from mobilePeriod */
  const onMobileShow = useCallback(() => {
    if (!selectedDeviceId) return;
    const now = new Date();
    let from,
      to = now;
    switch (mobilePeriod) {
      case 'yesterday':
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
        to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        break;
      case 'thisWeek':
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay(), 0, 0, 0);
        break;
      case 'previousWeek':
        from = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - now.getDay() - 7,
          0,
          0,
          0,
        );
        to = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay(), 0, 0, 0);
        break;
      case 'thisMonth':
        from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        break;
      default: // today
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    }
    onShow({ deviceIds: [selectedDeviceId], from: from.toISOString(), to: to.toISOString() });
  }, [selectedDeviceId, mobilePeriod, onShow]);

  return (
    <div className={classes.root}>
      {/* MAP */}
      <MapView>
        <MapOverlay />
        <MapGeofence />
        <MapRoutePathSnap positions={positions} />
        <MapRoutePointsSnap positions={positions} onClick={onPointClick} />
        {loaded && index < positions.length && (
          <MapPositions
            positions={[positions[index]]}
            onMarkerClick={onMarkerClick}
            titleField="fixTime"
          />
        )}
      </MapView>
      <MapScale />
      {loaded && <MapCamera positions={positions} />}

      {/* SIDEBAR */}
      <div className={classes.sidebar}>
        <Paper elevation={3} square>
          <Toolbar>
            <IconButton edge="start" sx={{ mr: 2 }} onClick={() => navigate(-1)}>
              <BackIcon />
            </IconButton>
            <Typography variant="h6" className={classes.title}>
              {t('reportTimeline')}
            </Typography>
            <span className={classes.snapBadge}>snap</span>
          </Toolbar>
        </Paper>

        <Paper className={classes.content} square>
          <ReportFilter onShow={onShow} deviceType="single" loading={loading} />
        </Paper>
      </div>

      {/* TIMELINE BAR — full width bottom */}
      <TimelineBar
        positions={positions}
        segments={segments}
        startMs={timeRange.startMs}
        endMs={timeRange.endMs}
        lockedIndex={loaded ? index : null}
        onScrub={onScrub}
        color={deviceColor}
        isMobile={isMobile}
        deviceList={deviceList}
        selectedDeviceId={selectedDeviceId}
        onDeviceChange={setSelectedDeviceId}
        period={mobilePeriod}
        onPeriodChange={setMobilePeriod}
        onMobileShow={onMobileShow}
        loading={loading}
      />

      {/* STATUS CARD */}
      {showCard && loaded && index < positions.length && (
        <StatusCard
          deviceId={selectedDeviceId}
          position={positions[index]}
          onClose={() => setShowCard(false)}
          disableActions
        />
      )}
    </div>
  );
};

export default TimelineSnapPage;
