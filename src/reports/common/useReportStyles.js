// src/reports/common/useReportStyles.js

import { makeStyles } from 'tss-react/mui';

export default makeStyles()((theme) => ({
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },

  // Old class — retained for report pages that do not use resizable
  // (PositionsReportPage, TripReportPage)
  containerMap: {
    flexBasis: '60%',
    flexShrink: 0,
  },
  containerMain: {
    overflow: 'auto',
  },

  // New classes for resizable layouts (RouteSnapReportPage, TripSnapReportPage)
  containerMapResizable: {
    flexShrink: 0,
    minHeight: 80,
    position: 'relative',
    // flexBasis is set via an inline style from the useResizableLayout ratio
  },
  resizeDivider: {
    flexShrink: 0,
    height: 6,
    cursor: 'row-resize',
    backgroundColor: theme.palette.background.default,
    borderTop: `1px solid ${theme.palette.divider}`,
    borderBottom: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
    '&:hover $resizeDividerHandle': {
      backgroundColor: theme.palette.action.active,
    },
  },
  resizeDividerHandle: {
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.palette.divider,
    transition: 'background-color 0.15s',
    pointerEvents: 'none',
  },
  containerMainResizable: {
    flex: '1 1 0',
    minHeight: 60,
    overflow: 'auto',
  },
  resizePresetButtons: {
    position: 'absolute',
    top: theme.spacing(1),
    right: theme.spacing(6), // avoid MapScale overlap
    display: 'flex',
    gap: theme.spacing(0.5),
    zIndex: 1,
  },
  resizePresetButton: {
    minWidth: 0,
    padding: '2px 8px',
    fontSize: 11,
    lineHeight: 1.4,
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    cursor: 'pointer',
    color: theme.palette.text.secondary,
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
      color: theme.palette.text.primary,
    },
  },

  header: {
    position: 'sticky',
    left: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  columnAction: {
    width: '1%',
    paddingLeft: theme.spacing(1),
    '@media print': {
      display: 'none',
    },
  },
  columnActionContainer: {
    display: 'flex',
  },
  filter: {
    display: 'inline-flex',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
    padding: theme.spacing(3, 2, 2),
    '@media print': {
      display: 'none !important',
    },
  },
  filterItem: {
    minWidth: 0,
    flex: `1 1 ${theme.dimensions.filterFormWidth}`,
  },
  filterButtons: {
    display: 'flex',
    gap: theme.spacing(1),
    flex: `1 1 ${theme.dimensions.filterFormWidth}`,
  },
  filterButton: {
    flexGrow: 1,
  },
  chart: {
    flexGrow: 1,
    overflow: 'hidden',
  },
  actionCellPadding: {
    '&.MuiTableCell-body': {
      paddingTop: 0,
      paddingBottom: 0,
    },
    '@media print': {
      display: 'none',
    },
  },
}));
