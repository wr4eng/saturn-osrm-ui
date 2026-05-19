#### // src/Navigation.jsx
```
import TimelineSnapPage from './other/TimelineSnapPage';

<Route path="timeline-snap" element={<TimelineSnapPage />} />
```

#### // src/reports/components/ReportsMenu.jsx

```
import TimelineIcon from '@mui/icons-material/Timeline';

<MenuItem
  title={t('reportTimeline')}
  link={buildLink('/reports/timeline-snap')}
  icon={<TimelineIcon />}
/>
```
#### // src/resources/l10n/en.json

```
"reportTimeline": "Timeline (Snap)"
```