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
