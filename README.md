# Version 4.3.2

- Forces readable dark text inside the light Fleet Health card after Leaflet popup styling is applied.
- Retains green, amber, and red health states and the blue diagnostics link.

# Version 4.3.1

- Corrects Fleet Health popup-card contrast on the regular dashboard.
- Uses dark labels and values with a high-contrast blue diagnostics link.
- Leaves all integration behavior and kiosk mode unchanged.

# Version 4.3.0

- Integrates the regular operational dashboard with WTFD Fleet Health.
- Adds a Fleet Health button beside the regular-site controls.
- Adds health status, fuel, battery voltage, active faults, update age, and a full-diagnostics link to apparatus map popups.
- Matches vehicles by their F-number and refreshes health data once per minute.
- Leaves kiosk mode unchanged and does not request Fleet Health data in kiosk mode.

# Version 4.2.1

- Removes Area and Sector lines from the Active911 Details display.
- Gives the kiosk Details card more width and substantially more vertical room.
- Keeps the dispatched-units card visible while prioritizing the incident narrative.
- Leaves the standard dashboard layout and all other alert behavior unchanged.

# Version 4.2.0

- Applies the Headquarters administrative-marker filter to the standard map.
- Hides Prevention 41–44, Marshal 40, Chief 40–42, Safety 40, and Training 40 only while parked at Headquarters.
- Restores those markers immediately when Away, moving, responding, or located at another facility.
- Leaves Battalion 40 and all frontline apparatus visible.
- Preserves the existing kiosk movement-only filter and all roster entries.

# Version 4.1.9

- Extended the kiosk movement-only map filter to Safety 40 and Training 40.
- These units remain in kiosk station and Away rosters while hidden from the kiosk map when parked.
- Safety 40 and Training 40 reappear on the kiosk map when assigned Away or moving at 5 mph or faster.
- Standard dashboard behavior is unchanged.

# Version 4.1.8

- Corrected the runtime dashboard version so the footer displays the current release.
- Synchronized the stylesheet and script cache-buster values with the release version.
- Preserved the approved apparatus-pill sizing and compact marker fan-out behavior.

# Version 4.1.7

- Extended the kiosk movement-only map filter to Chief 40, Chief 41, and Chief 42.
- These chief units remain hidden while parked and reappear when Away or moving at 5 mph or faster.
- Standard dashboard map behavior is unchanged.

# Version 4.1.6

- Kiosk map hides Prevention 41–44 and Marshal 40 while they are parked.
- Those units reappear on the kiosk map when assigned Away or moving at 5 mph or faster.
- Units remain visible in the kiosk station and Away rosters.
- Standard dashboard map behavior is unchanged.

# Version 4.1.5

- Removed the eight-unit limit from the kiosk Away roster.
- Displays all away units in a compact three-column grid so they remain visible on the TV.
- Preserves full unit names while hiding secondary location text in the compact kiosk roster.

# Version 4.1.4

- Corrected the oversized ribbon in Fully Kiosk Browser.
- Reduced the kiosk ribbon to 290px to restore map space.
- Compacted kiosk-only vertical spacing so Station 45 and the complete lower status board remain visible.
- Standard dashboard sizing is unchanged.

# Version 4.0.0

## Apparatus icon system

- Engines and ladders now use a Maltese cross.
- Medic units now use a Star of Life.
- Prevention/CRRD and Marshal units now use a shield with a check mark.
- Existing command shield styling remains in place.
- Icons appear on the standard map, apparatus list, kiosk map, and kiosk station pills.
- Operational status colors still take priority, including red when responding.

# Version 3.9.0

- Replaced the vehicle icon on Chief 40/41/42, Battalion 40, Training 40, and Safety 40 with the selected shield-and-cross icon.
- Added a metallic gold treatment to Chief and Battalion map pills.
- Added a refined black-and-gold treatment to Training and Safety map pills.
- Added matching shield cues to the compact kiosk station pills.
- Preserved operational status overrides for responding, stale GPS, no GPS, and offline units.

# Version 3.8.0

- Adds dedicated command-unit pill colors on both the standard map and kiosk station rows.
- Battalion 40: gold pill with black lettering.
- Chief 40, Chief 41, and Chief 42: gold pill with white lettering.
- Training 40 and Safety 40: black pill with gold lettering and border.
- Preserves red responding/stale and gray no-GPS/offline overrides for operational clarity.

# Version 3.7.1

## Consolidated incident timer and release identification correction
- Uses v3.6.3 as the base and retains all marker, kiosk, Silk, and facility-grouping updates.
- Keeps one stable start time for each Active911 incident across repeated API polls.
- Prevents invalid or future-dated source timestamps from resetting the elapsed timer to 0:00.
- Ensures the same stable timestamp controls both the elapsed counter and 10-minute ribbon expiration.
- Updates the visible footer and browser cache-buster values to v3.7.1.

# Version 3.6.3

## 3.6.3 kiosk facility grouping correction
- Uses v3.6.1 as the base.
- Groups kiosk station rows by each unit's current recognized facility before its configured home station.
- Shows responding units in the station row when they are physically at that facility, including Engine 41 at Headquarters.
- Keeps the standard dashboard unchanged.

# Version 3.6.0

## 3.6.0 kiosk compatibility update
- Uses the latest 3.5.0 project as its base.
- Prevents Amazon Silk text autosizing from distorting the kiosk ribbon.
- Allows the kiosk ribbon to scroll independently when the usable TV viewport is shorter than expected.
- Prevents the Stations, Units Away, System Health, and version sections from being clipped.
- Retains the larger kiosk typography and leaves the standard dashboard unchanged.
- Uses `100dvh` with a `100vh` fallback and keeps the map aligned with the ribbon.


- Replaces vertical marker stacking with a compact fan-out pattern for 2–6 apparatus at the same or nearly identical coordinates.
- Uses a compact three-column layout for unusually large apparatus clusters.
- Keeps every marker and popup anchored to its true GPS coordinate and draws connector lines to displaced labels.
- Enlarges the kiosk status legend for across-the-room readability.
- Keeps GPS age formatting consistent, including values such as `GPS 4h 49m old` and `GPS 1d 3h old`.
- Immediately refreshes fleet and Active911 data when connectivity returns or the display wakes from a hidden state.
- Preserves all current standard-dashboard and kiosk features from v3.4.0.

# Version 3.4.0

- Reduced the width of kiosk apparatus identifiers displayed directly on the map.
- Removed forced minimum widths from ladder and prevention map markers.
- Preserved the existing marker height and standard dashboard sizing.

- Reduced the width of apparatus pills in kiosk station cards only.
- Preserved the standard dashboard layout and map marker sizing.

# WTFD Fleet Dashboard v2.9.4

## v2.9.4 standard-dashboard map framing update

- Standard dashboard opens one zoom level closer after fitting the service-area boundary.
- Standard dashboard keeps the same map center.
- Kiosk framing remains unchanged.
- Distant units still do not force the map to zoom outward.
- All v2.9.3 light-map, cache-control, reliability, Active911, and sound features are preserved.


## v2.9.3 light-map readability update

- Standard and kiosk displays now always start with the light Street basemap.
- Removed the Dark map option and automatic nighttime dark-theme switching.
- Satellite remains available as a manual alternate map.
- Slightly enlarged apparatus markers for across-the-room kiosk readability.
- Increased service-area fill slightly while retaining street visibility.
- Smoothed the responding-unit halo animation.
- Preserves the tighter v2.9.1 kiosk framing and all v2.9.0 reliability safeguards.


## v2.9.1 kiosk map framing
- Tightens the kiosk map by one effective zoom level after fitting the service-area boundary.
- Shifts the kiosk map center slightly east so the jurisdiction is better positioned in the available map pane.
- Limits the kiosk home view to zoom level 14 to preserve nearby mutual-aid context.
- Leaves the standard dashboard map framing unchanged.
- Preserves all v2.9.0 reliability, Active911, audible alert, stale-GPS, and kiosk safeguards.

## Version 2.8.1

- Reduces standard and kiosk fleet-data polling from 30 seconds to 10 seconds.
- Adds a timestamp cache-buster to every dashboard API request.
- Sends explicit browser and Cloudflare no-cache directives for dashboard and manual-sync requests.
- Keeps the one-minute Google Apps Script trigger unchanged; new sheet data should now appear on the display within approximately 0–10 seconds after the backend update.
- Preserves all v2.7.0 incident marker, alert tone, standard-site, and Fully Kiosk Browser features.

### Refresh setting

The fleet display refresh rate is controlled in `dashboard-config.js`:

```javascript
dashboardRefreshMs: 10000
```

Ten seconds is recommended. A shorter interval generally will not create newer coordinates because Google Apps Script is still updating once per minute.

## Version 2.7.0

- Keeps an Active911 incident location marker on the map for 10 minutes on both the standard and kiosk sites.
- Matches the incident marker duration to the 10-minute rolling incident banner.
- Makes the marker duration configurable in `dashboard-config.js` using `active911IncidentMarkerDurationMs`.
- A new incident replaces the prior incident marker and starts a new 10-minute timer.
- Keeps the 15-second popup, one-time alert tone, and all Fully Kiosk Browser compact-layout improvements.

### Changing the incident marker duration

The default setting is:

```javascript
active911IncidentMarkerDurationMs: 10 * 60 * 1000
```

For example, change `10` to `15` to keep the marker for 15 minutes. This setting applies to both the standard and kiosk sites.

## Version 2.6.0

- Adds a short, royalty-free two-note dispatch chime for new Active911 incidents.
- Plays the tone once per new incident on both the standard and kiosk sites.
- Stores the last sounded incident ID locally so a refresh does not replay the same call.
- Retries after the first user interaction when a standard browser blocks autoplay.
- Adds `dashboard-config.js` so the alert sound, volume, popup duration, banner duration, refresh rate, and polling rate can be changed without editing `script.js`.
- Keeps all v2.5.0 Fully Kiosk Browser portrait-layout corrections.

### Changing the tone later

The included tone is `sounds/dispatch-chime.wav`.

You may either:

1. Replace that file with another WAV file using the same filename, or
2. Add a different MP3/WAV file and change `alertSoundUrl` in `dashboard-config.js`.

Use `alertSoundEnabled: false` to disable the tone. Set `alertSoundVolume` from `0` to `1`.

### Fully Kiosk Browser audio

Make sure Android media volume is turned up and Fully Kiosk Browser is allowed to play web audio/media. The dashboard will request the tone immediately when a new incident is detected.


## Version 2.5.0

- Corrects Fully Kiosk Browser vertical clipping on portrait displays.
- Keeps all five summary cards on one row in kiosk mode.
- Uses dynamic viewport height (`100dvh`) for Android kiosk browsers.
- Compacts inactive incident, station, away-unit, and system-health sections.
- Adds additional short-screen rules while preserving all station rows.

# WTFD Fleet Dashboard v2.4.0

This release includes standard-dashboard and unattended-kiosk refinements.

## Standard dashboard
- Clear Last Update label with green/yellow/red age states
- More legible command-status cards
- Larger, better-spaced status legend
- Subtle responding-unit halo; moving units remain static
- Active911 elapsed-time counter
- “GPS Issues” terminology

## Kiosk dashboard
- Search, Force Sync, layer controls, and zoom controls remain hidden
- Sidebar reduced for additional map space
- Vehicle markers reduced approximately 10–15% while retaining label readability
- No Normal Operations banner when no incident or response exists
- Larger update-age treatment and legend
- Explicit station occupancy counts
- Active911 elapsed-time counter

## Deployment
Replace the repository contents with these files, commit, and allow Cloudflare Pages to redeploy. Then hard refresh the browser with Ctrl+F5.

## v2.3.0 GPS age formatting
- Stale GPS badges now use human-readable ages such as `GPS 4h 49m old`.
- Ages under one hour show minutes, and ages over one day show days and hours.


## v2.4.0 Samsara away-location formatting
- Away units now show the municipality or township parsed from Samsara's Current Location value.
- Postal codes are no longer used when a municipality is available.
- Display fallback order is municipality/township, street or available location text, then `Away`.
- `Washington Township` is shortened to `Washington Twp` to fit the sidebar.
- The improved location label is used on both the standard dashboard and kiosk Units Away list.


## Version 2.9.0
- Adds LIVE / DELAYED / OFFLINE status with exact data age.
- Adds a five-second connection-restored confirmation.
- Adds retry countdown details to the connection-loss overlay.
- Prevents overlapping dashboard requests.
- Reloads kiosk mode after 12 consecutive dashboard failures while preserving the existing periodic kiosk reload.
- Adds stronger visual treatment for stale GPS cards and markers.
- Keeps the 10-second dashboard polling interval and no-cache API behavior.
