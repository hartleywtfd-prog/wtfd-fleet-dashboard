# Version 5.0.6

- Moves apparatus markers into one managed Leaflet layer so refreshes cannot
  leave orphaned or duplicated markers behind.
- Deduplicates repeated physical vehicles and repeated operational call signs,
  retaining the newest location record.
- Makes the visible, collision-offset unit label the click target and uses a
  direct vehicle-to-marker reference for sidebar selection.

# Version 5.0.5

- Fixes CrewSense call-sign normalization so every vehicle remains selectable
  and matches abbreviated schedule assignments, not only the cross-staffed
  Engine/Medic 43 and Engine/Medic 44 units.
- Softens the marker status shadows so moving, away, and command units no
  longer display with a heavy black halo.

# Version 5.0.4

- Treats Engine 43/Medic 43 and Engine 44/Medic 44 as cross-staffed unit pairs.
- Displays the same live CrewSense crew on both members of each pair with a clear cross-staffed label.
- Adds configurable standard personnel mappings for Chief 40–42, Marshal 40, Prevention 41–44, Training 40, and Safety 40.
- Searches all active CrewSense assignments for each mapped employee, including common formal-name variants.
- Gives live operational assignments priority over standard mappings.
- Prevents Training 40 or Safety 40 from displaying its normal assignee when that person is actively filling Battalion 40.

# Version 5.0.3

- Automatically matches expanded dashboard call signs to CrewSense abbreviations.
- Examples: `Medic 45 → M45`, `Engine 44 → E44`, `Ladder 41 → L41`, and `Battalion 40 → BC40`.
- Continues to support explicit aliases for nonstandard assignment names.
- Hides the position line when CrewSense does not supply shift labels.

# Version 5.0.2

- Accepts CrewSense days, assignments, shifts, positions, and labels as either arrays or keyed objects.
- Reports the live `days` collection type, object keys, and CrewSense-returned date window without exposing personnel data.
- Preserves the interactive-only display and all credential protections from v5.0.1.

# Version 5.0.1

- Adds privacy-safe CrewSense response diagnostics containing only counts and field names.
- Recognizes additional current API response wrappers such as `schedule.days`, `data.schedule.days`, `data`, and `items`.
- Recognizes `shifts`, `users`, or `crew` arrays within an assignment.
- Never includes raw schedule data, credentials, or employee values in diagnostics.

# Version 5.0.0

- Adds a server-side CrewSense / Vector Scheduling API integration for the regular interactive dashboard.
- Displays the currently assigned employees and CrewSense position labels when a vehicle marker is clicked.
- Matches the live dashboard call sign, such as `Medic 45`, to the CrewSense assignment name.
- Supports configurable assignment-name aliases in `dashboard-config.js`.
- Keeps the CrewSense Client ID and Client Secret in encrypted Cloudflare environment variables.
- Does not request or display CrewSense data in kiosk mode.
- Refreshes crew assignments every 60 seconds and uses the existing popup refresh behavior.

# Version 4.9.4

- Rebuilds Active911 tone matching from 2,743 actual WTFD alert records containing 117 distinct descriptions.
- Uses the Active911 `description` as the run type; recognizes that `cad_code` is the incident number rather than a call-type field.
- Uses stable description prefixes such as `FALARM`, `FIRE`, `VEHACC`, `INVES`, `GAS`, and medical determinant names.
- Prevents apparatus updates or appended dispatch narrative from changing the selected tone.
- Uses the stable CAD incident number to prevent an apparatus addition/change from replaying the popup or tone for the same incident.
- Keeps unmatched and future call types on the original default dispatch chime.

# Version 4.9.3

- Plays distinct tones for Fire, EMS, vehicle accident/rescue, and hazmat/special-rescue Active911 alerts.
- Matches configurable keywords against the Active911 description.
- Uses the existing dispatch chime when a run type does not match a configured category.
- Preserves one-time-per-incident playback, autoplay retry behavior, and both standard and kiosk alert behavior.
- Tone categories, keywords, file paths, and volume can be changed in `dashboard-config.js`.

# Version 4.9.2

- Prevents duplicate frontline call signs such as three E45 markers.
- Does not apply Engine, Medic, Ladder, or Truck primary assignments when the live feed contains only a generic vehicle identity.
- Requires a live CSV call sign before reserve, out-of-service, or not-yet-ready frontline vehicles display as an operational unit.
- Continues to use stable command/admin primaries such as Battalion 40, Training 40, and Safety 40 as generic-name fallbacks.
- Preserves the complete primary and alternate assignment reference from v4.9.1.

# Version 4.9.1

- Adds the complete 27-apparatus primary and alternate assignment reference supplied in Assignments.csv.
- Keeps the live CSV / UnitConfig call sign authoritative for every apparatus.
- Uses each primary assignment only when the live feed supplies a missing or apparatus-based placeholder.
- Converts the prior F137 / Medic 144 hard override into a fallback so F137 can display a temporary live assignment.
- Supports the Engine 45 transition among F108, F118, and F119 without forcing any of them to display Engine 45.
- Adds compact map labels for Utility assignments (U##) and Central Supply (CS).
- Normalizes punctuation separators in the supplied alternate lists and expands F103's primary assignment from Battalion to Battalion 40.

# Version 4.9.0

- Keeps the live CSV / UnitConfig operational call sign authoritative for F103, F112, and F131.
- Uses normal assignments only when the feed supplies no valid call sign: F103 as Battalion 40, F112 as Training 40, and F131 as Safety 40.
- Allows F112 or F131 to display as Battalion 40 (B40 on the map) whenever either is placed in service under that call sign.
- Prevents apparatus-number placeholders such as B112 from appearing when a normal assignment should be used.
- Preserves the existing F137 / Medic 144 correction and all prior behavior.

# Version 4.8.9

- Corrects apparatus F112 to display as Training 40 (T40 on the map) instead of B112.
- Applies the correction to both the standard and kiosk views while keeping F112 as the underlying apparatus identity.
- Preserves the existing F137 / Medic 144 correction and all v4.8.8 behavior.

# Version 4.8.8

- Corrects apparatus F137 to display its current operational call sign as Medic 144 (M144 on the map).
- Keeps F137 as the underlying apparatus identity for Fleet Health and other F-number matching.
- Adds a simple `unitOverrides` setting in `dashboard-config.js` so a temporary call-sign correction can be changed or removed without editing the main dashboard code.
- Preserves all v4.8.7 audio packaging, Headquarters / Station 45 assignments, map behavior, and privacy logic.

# Version 4.8.7

- Repackages the v4.8.6 Headquarters / Station 45 logic in a deployment-ready repository root.
- Preserves `functions/api/` and `sounds/` directory structure so Cloudflare Pages routes and the Active911 chime are deployed under the correct paths.
- Adds an explicit WAV content type for the alert sound.
- No change to the v4.8.6 Headquarters unit assignments or residence privacy behavior.

# Version 4.8.6

- Separates the shared Station 45 / Headquarters building into logical dashboard locations.
- Assigns Prevention 41–44, Marshal 40, Chief 40–42, Safety 40, and Training 40 to Headquarters whenever Samsara reports the shared building as either Headquarters/HQ or Station 45.
- Assigns all other apparatus at that shared building to Station 45.
- Leaves units at all other facilities unchanged and preserves chief-residence privacy behavior.

# Version 4.8.5

- Replaces the outdated status-color legend with an accurate two-part map
  legend for apparatus colors and operational indicators.
- Keeps normal apparatus and command identity colors intact.
- Adds a blue outline for moving units and an amber outline for away units.
- Retains the animated red responding halo and gives stale GPS a dashed red
  border.
- Clarifies the gray No GPS / Offline treatment.

# Version 4.8.4

- Corrects chief-residence privacy detection when Samsara provides the
  protected place name in `Location` instead of `Facility`.
- Recognizes both the current `Chief 40/41/42 Residence` names and the earlier
  shortened place names.
- Hides every vehicle marker at a protected chief residence from both maps.
- Keeps the assigned chief in the kiosk Units Away ribbon while displaying
  only `Away`, never the protected place name or address.
- Leaves the version 4.8.3 basemap, map framing, marker layout, and all other
  dashboard behavior unchanged.

# Version 4.8.3

- Restores the original full-color OpenStreetMap Standard basemap on both the
  standard dashboard and kiosk site.
- Reduces the jurisdiction boundary opacity from `0.9` to `0.65` and the
  interior fill opacity from `0.025` to `0.012`.
- Groups vehicles at the same defined facility into one coordinated marker
  layout even when their raw GPS points differ slightly.
- Adds additional horizontal and vertical spacing for clusters containing five
  or more vehicles, improving readability at Headquarters and other crowded
  facilities.
- Preserves marker sizing, precise GPS dots, map framing, Satellite mode, and
  all kiosk behavior.

# Version 4.8.2

- Restores the detailed Esri World Street Map used in version 4.8.0 on both
  the standard dashboard and kiosk site.
- Applies a restrained color treatment only to the street-map tiles to reduce
  the yellow/tan cast and soften road colors while preserving road hierarchy,
  city labels, parks, and waterways.
- Leaves Satellite imagery completely unfiltered.
- Preserves the refined jurisdiction boundary, marker placement, overlap
  fan-out, precise GPS dots, map framing, and kiosk behavior.

# Version 4.8.1

- Replaces the tan Esri World Street Map with the cleaner CARTO Voyager
  basemap on both the standard dashboard and kiosk site.
- Uses a neutral off-white background, restrained road hierarchy, subtle
  parks, and clear waterways to improve geographic context without competing
  with apparatus markers.
- Includes the required OpenStreetMap and CARTO attribution.
- Preserves the refined jurisdiction boundary, marker placement, overlap
  fan-out, GPS dots, map framing, Satellite option, and kiosk behavior.

# Version 4.8.0

- Replaces the pale Esri Light Gray Canvas with Esri World Street Map on both
  the standard dashboard and kiosk site.
- Adds clearer road hierarchy, neighborhoods, parks, waterways, and geographic
  context while keeping apparatus markers prominent.
- Reduces the jurisdiction interior fill opacity from `0.07` to `0.025`.
- Refines the jurisdiction outline from a 3-pixel bright red line to a
  2-pixel deeper red line.
- Renames the standard-site map selector from `Light Map` to `Street Map`.
- Retains Satellite on the standard site and leaves marker placement, overlap
  fan-out, precise GPS dots, map framing, and kiosk behavior unchanged.

# Version 4.7.1

- Reduces the jurisdiction interior fill opacity from `0.14` to `0.07` on
  both maps.
- Preserves the existing red boundary line while allowing more Light Gray
  Canvas road and neighborhood detail to remain visible.
- Leaves map framing, markers, GPS dots, and all operational behavior
  unchanged.

# Version 4.7.0

- Replaces the default OpenStreetMap Standard tiles with Esri Light Gray
  Canvas on both the standard and kiosk sites.
- Uses the matching Esri reference-label layer to retain geographic context
  while reducing visual competition with apparatus markers.
- Renames the standard-site `Street` layer button to `Light Map`.
- Retains Satellite as an option on the standard site.
- Preserves the existing service-area boundary, center, zoom, apparatus
  markers, precise GPS dots, and kiosk controls.
- Adds the required Esri and source-data attribution.

# Version 4.6.1

- Moves precise-location apparatus pills 10 pixels farther above their GPS
  dots on both the standard and kiosk maps.
- Makes the dot-to-pill connector easier to see while keeping the amber dot
  fixed at the vehicle's true coordinate.
- Leaves pill sizing and all other map behavior unchanged.

# Version 4.6.0

- Adds precise GPS-point markers for vehicles outside defined facilities on
  both the standard and kiosk maps.
- Places a small amber dot at the vehicle's true GPS coordinate.
- Lifts the existing apparatus pill above the coordinate and connects it to
  the dot with a short line so nearby streets and properties remain visible.
- Preserves the existing pill colors, unit labels, popup behavior, marker
  priority, and compact collision fan-out.
- Leaves markers at defined facilities in their existing centered-pill layout.

# Version 4.5.0

- Hides Chief 40, Chief 41, and Chief 42 map markers on both sites while each
  vehicle is inside its matching Samsara residence geofence.
- Treats `Chief 40 Residence`, `Chief 41 Residence`, and `Chief 42 Residence`
  as private Away locations.
- Keeps the affected chief visible in the kiosk Units Away ribbon as `Away`.
- Prevents residence geofences from appearing as station cards or exposing
  residence names and addresses in the kiosk ribbon.
- Restores the existing map behavior automatically when the vehicle leaves its
  assigned residence geofence.

# Version 4.4.3

- Forces Active911 Received times to America/New_York instead of relying on the kiosk device timezone.
- Automatically observes Eastern Standard Time and Eastern Daylight Time.
- Corrects Fire TV devices configured or reported as UTC while leaving timestamp parsing and alert-age logic intact.

# Version 4.4.2

- Corrects Active911 Received times that appeared four hours ahead.
- Treats unzoned Active911 date/time values as UTC and displays them in the device's local Eastern time.
- Applies the same correction to alert age, startup detection, and rolling-incident elapsed time.

# Version 4.4.1

- Removes Beat from Active911 Details along with Area and Sector.
- Preloads the included alert chime and raises its configured volume to 100%.
- Automatically retries blocked sound playback once per second while the 15-second popup remains visible.
- Preserves one successful sound per incident so a displayed call does not repeatedly chime.

# Version 4.4.0

- Prevents a new Active911 call from being silently treated as the startup baseline after a kiosk or page reload.
- Remembers the last seen alert ID and displays an unseen startup alert when it was received within the prior two minutes.
- Removes Area and Sector from Active911 Details in the Cloudflare response and again in the browser as a safeguard.
- Enlarges the kiosk narrative card and automatically reduces narrative text size for longer details.
- Removes the unusable kiosk scroll area so text remains inside the visible popup.

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
