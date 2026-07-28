/*
 * WTFD Fleet Dashboard - site settings
 *
 * Alert tone changes do not require editing script.js.
 * Rules are checked from top to bottom against the Active911 description.
 */
window.WTFD_DASHBOARD_CONFIG = {
  alertSoundEnabled: true,
  alertSoundUrl: 'sounds/dispatch-chime.wav',
  alertSoundVolume: 1.0,
  alertSoundPlayOncePerIncident: true,
  alertSoundToneRules: [
    {
      name: 'Fire',
      url: 'sounds/fire-alert.wav',
      prefixes: [
        'FALARM', 'FIRE', 'MAFIRE', 'FRES', 'FHIRS', 'SCHOOL ALARM'
      ],
      keywords: [
        'STRUCTURE FIRE - 69', '-SF-COMMERCIAL BLDG'
      ]
    },
    {
      name: 'Vehicle Accident / Rescue',
      url: 'sounds/rescue-alert.wav',
      prefixes: [
        'VEHACC', 'RESCUE', 'ELEVATOR'
      ]
    },
    {
      name: 'Hazmat / Special Rescue',
      url: 'sounds/special-ops-alert.wav',
      prefixes: [
        'INVES', 'GAS', 'CO ALARM', 'HAZMT', 'FUEL', 'WATER', 'WIRES',
        'BOMBF', 'FD INFO', 'FDEVENT'
      ]
    },
    {
      name: 'EMS',
      url: 'sounds/ems-alert.wav',
      prefixes: [
        'ABD', 'ALLER', 'ALCOM', 'ANIMAL BITES', 'ASSAULT',
        'ATTEMPTED SUICIDE', 'BRETH', 'CHEST PAIN', 'CHILD BIRTH',
        'CHOKING', 'DIABETIC PROBLEMS', 'DIFFICULTY BREATHING',
        'FALL', 'FULL', 'ILL', 'LIFT', 'MAMEDIC', 'MEDICAL ALARM',
        'MENTAL HEALTH', 'OVERDOSE', 'PERSON DOWN', 'SEIZURE',
        'SHOOTING', 'STROKE', 'TRAUMATIC INJURY', 'UNCON'
      ],
      keywords: ['-SUIC-']
    }
  ],

  // Fleet assignment reference. The live CSV call sign always takes priority.
  // Primary assignments are fallbacks only when the feed supplies a generic
  // apparatus label. Alternates document expected temporary assignments.
  unitAssignments: {
    F103: { primary: 'Battalion 40', alternates: ['Training 40', 'Safety 40'] },
    F104: { primary: 'Chief 41', alternates: [] },
    F107: { primary: 'Prevention 42', alternates: [] },
    F108: { primary: 'Engine 45', alternates: ['Engine 41', 'Engine 42', 'Engine 43', 'Engine 44', 'Engine 143', 'Engine 243', 'Engine 142'] },
    F109: { primary: 'Chief 42', alternates: [] },
    F111: { primary: 'Utility 41', alternates: ['Safety 40', 'Training 40', 'Battalion 40'] },
    F112: { primary: 'Training 40', alternates: ['Battalion 40', 'Safety 40'] },
    F115: { primary: 'Engine 44', alternates: ['Engine 41', 'Engine 42', 'Engine 43', 'Engine 45', 'Engine 143', 'Engine 243', 'Engine 142'] },
    F116: { primary: 'Engine 43', alternates: ['Engine 41', 'Engine 42', 'Engine 44', 'Engine 45', 'Engine 143', 'Engine 243', 'Engine 142'] },
    F117: { primary: 'Medic 244', alternates: ['Medic 41', 'Medic 42', 'Medic 43', 'Medic 44', 'Medic 45', 'Medic 144'] },
    F118: { primary: 'Engine 41', alternates: ['Engine 42', 'Engine 43', 'Engine 44', 'Engine 45', 'Engine 143', 'Engine 243', 'Engine 142'] },
    F119: { primary: 'Engine 45', alternates: ['Engine 41', 'Engine 42', 'Engine 43', 'Engine 44', 'Engine 143', 'Engine 243', 'Engine 142'] },
    F121: { primary: 'Chief 40', alternates: ['Central Supply'] },
    F122: { primary: 'Medic 44', alternates: ['Medic 41', 'Medic 42', 'Medic 43', 'Medic 45', 'Medic 144', 'Medic 244'] },
    F123: { primary: 'Medic 43', alternates: ['Medic 41', 'Medic 42', 'Medic 44', 'Medic 45', 'Medic 144', 'Medic 244'] },
    F124: { primary: 'Engine 143', alternates: ['Engine 41', 'Engine 42', 'Engine 43', 'Engine 44', 'Engine 45', 'Engine 142', 'Engine 243'] },
    F126: { primary: 'Medic 41', alternates: ['Medic 42', 'Medic 43', 'Medic 44', 'Medic 45', 'Medic 144', 'Medic 244'] },
    F129: { primary: 'Engine 42', alternates: ['Engine 41', 'Engine 43', 'Engine 44', 'Engine 45', 'Engine 143', 'Engine 142', 'Engine 243'] },
    F130: { primary: 'Prevention 43', alternates: [] },
    F131: { primary: 'Safety 40', alternates: ['Battalion 40', 'Training 40'] },
    F132: { primary: 'Marshal 40', alternates: [] },
    F133: { primary: 'Prevention 41', alternates: [] },
    F136: { primary: 'Prevention 44', alternates: [] },
    F137: { primary: 'Medic 144', alternates: ['Medic 41', 'Medic 42', 'Medic 43', 'Medic 44', 'Medic 45', 'Medic 244'] },
    F138: { primary: 'Medic 45', alternates: ['Medic 41', 'Medic 42', 'Medic 43', 'Medic 44', 'Medic 144', 'Medic 244'] },
    F139: { primary: 'Medic 42', alternates: ['Medic 41', 'Medic 43', 'Medic 44', 'Medic 45', 'Medic 144', 'Medic 244'] },
    F141: { primary: 'Ladder 41', alternates: [] }
  },

  active911PopupDurationMs: 15000,
  // How long the incident location marker remains on the map.
  active911IncidentMarkerDurationMs: 10 * 60 * 1000,
  active911BannerDurationMs: 10 * 60 * 1000,
  dashboardRefreshMs: 10000,
  active911PollMs: 5000,
  // Show an unseen current call after a kiosk/page reload when it is still new.
  active911StartupPopupMaxAgeMs: 2 * 60 * 1000,
  // Do not rely on the Fire TV/browser timezone for Received times.
  active911TimeZone: 'America/New_York',
  connectionDelayedMs: 30000,
  connectionLostMs: 90000,
  kioskReloadAfterFailures: 12,

  // Standard dashboard uses the natural jurisdiction-boundary fit.
  standardServiceAreaZoomBoost: 0,
  standardServiceAreaMaxZoom: 13,

  // Kiosk-only service-area framing.
  kioskServiceAreaZoomBoost: 0,
  kioskServiceAreaFitPadding: 50,
  kioskServiceAreaMaxZoom: 14,
  kioskServiceAreaCenterShiftLon: 0.006
};
