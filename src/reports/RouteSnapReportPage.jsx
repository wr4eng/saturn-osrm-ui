// src/reports/RouteSnapReportPage.jsx

import { Fragment, useCallback, useState } from 'react';
import { IconButton, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import LocationSearchingIcon from '@mui/icons-material/LocationSearching';
import ReportFilter from './components/ReportFilter';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import ReportsMenu from './components/ReportsMenu';
import PositionValue from '../common/components/PositionValue';
import { useCatch } from '../reactHelper';
import MapView from '../map/core/MapView';
import MapRoutePathSnap from '../map/MapRoutePathSnap';
import MapRoutePointsSnap from '../map/MapRoutePointsSnap';
import MapPositions from '../map/MapPositions';
import MapCamera from '../map/MapCamera';
import MapGeofence from '../map/MapGeofence';
import MapScale from '../map/MapScale';
import useReportStyles from './common/useReportStyles';
import useResizableLayout from './common/useResizableLayout';
import TableShimmer from '../common/components/TableShimmer';
import fetchOrThrow from '../common/util/fetchOrThrow';

const defaultColumns = ['fixTime', 'latitude', 'longitude', 'speed', 'address'];

const RouteSnapReportPage = () => {
  const { classes } = useReportStyles();
  const t = useTranslation();

  const { ratio, setRatio, containerRef, dividerProps } = useResizableLayout(0.6);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const onMapPointClick = useCallback(
    (positionId) => {
      setSelectedItem(items.find((it) => it.id === positionId));
    },
    [items],
  );

  const onShow = useCatch(async ({ deviceIds, from, to }) => {
    const query = new URLSearchParams({ from, to });
    deviceIds.forEach((deviceId) => query.append('deviceId', deviceId));
    setLoading(true);
    try {
      const response = await fetchOrThrow(`/api/reports/route-snap?${query.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      setItems(await response.json());
    } finally {
      setLoading(false);
    }
  });

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'reportRouteSnap']}>
      <div className={classes.container} ref={containerRef}>
        {/* MAP PANE — flexBasis controlled by drag ratio */}
        <div
          className={classes.containerMapResizable}
          style={{ flexBasis: `${Math.round(ratio * 100)}%` }}
        >
          <MapView>
            <MapGeofence />
            {[...new Set(items.map((it) => it.deviceId))].map((deviceId) => {
              const positions = items.filter((p) => p.deviceId === deviceId);
              return (
                <Fragment key={deviceId}>
                  <MapRoutePathSnap positions={positions} />
                  <MapRoutePointsSnap positions={positions} onClick={onMapPointClick} />
                </Fragment>
              );
            })}
            {selectedItem && <MapPositions positions={[selectedItem]} titleField="fixTime" />}
          </MapView>
          <MapScale />
          <MapCamera positions={items} />

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
            <ReportFilter onShow={onShow} deviceType="single" loading={loading} />
          </div>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell className={classes.columnAction} />
                {defaultColumns.map((key) => (
                  <TableCell key={key}>{key}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading ? (
                items.slice(0, 4000).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className={classes.columnAction} padding="none">
                      {selectedItem === item ? (
                        <IconButton size="small" onClick={() => setSelectedItem(null)}>
                          <GpsFixedIcon fontSize="small" />
                        </IconButton>
                      ) : (
                        <IconButton size="small" onClick={() => setSelectedItem(item)}>
                          <LocationSearchingIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                    {defaultColumns.map((key) => (
                      <TableCell key={key}>
                        <PositionValue
                          position={item}
                          property={item.hasOwnProperty(key) ? key : null}
                          attribute={item.hasOwnProperty(key) ? null : key}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableShimmer columns={defaultColumns.length + 1} startAction />
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </PageLayout>
  );
};

export default RouteSnapReportPage;
