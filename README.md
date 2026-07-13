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
