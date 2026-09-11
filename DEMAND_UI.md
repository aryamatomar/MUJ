# 🛡️ SafeHer — Complete UI Component & Architecture Specification (DEMAND UI)

> **Document Purpose**: This document is the **master blueprint and component inventory** for the SafeHer Women Safety IoT & Emergency Monitoring Web Application. It specifies all views, routes, sections, cards, modals, layout tokens, state bindings, Socket.IO real-time hooks, and API endpoints needed to construct or rebuild the user interface from scratch.

---

## 📑 Table of Contents
1. [High-Level Application Architecture & Routes](#1-high-level-application-architecture--routes)
2. [Design Tokens & Theme System](#2-design-tokens--theme-system)
3. [Global Shell Components](#3-global-shell-components)
4. [Route 1: Girl / User Dashboard (`/user`)](#4-route-1-girl--user-dashboard-user)
   - [Tab 1: Live Safety Overview (`#dashboard`)](#tab-1-live-safety-overview-dashboard)
   - [Tab 2: Emergency SOS Center (`#emergency`)](#tab-2-emergency-sos-center-emergency)
   - [Tab 3: MPU6050 Motion Sensor Telemetry (`#sensors`)](#tab-3-mpu6050-motion-sensor-telemetry-sensors)
   - [Tab 4: Alert & Event History (`#history`)](#tab-4-alert--event-history-history)
   - [Tab 5: Device Hardware Architecture (`#device`)](#tab-5-device-hardware-architecture-device)
   - [Tab 6: Emergency Contacts Directory (`#contacts`)](#tab-6-emergency-contacts-directory-contacts)
   - [Tab 7: System Settings & Calibration (`#settings`)](#tab-7-system-settings--calibration-settings)
5. [Route 2: Admin Emergency Command Center (`/admin`)](#5-route-2-admin-emergency-command-center-admin)
   - [Admin Status Hero Banner](#admin-status-hero-banner)
   - [Admin 9-Metric Telemetry Grid](#admin-9-metric-telemetry-grid)
   - [Interactive Leaflet Map & Standby Privacy Overlay](#interactive-leaflet-map--standby-privacy-overlay)
   - [Real-Time Coordinates Readout Panel](#real-time-coordinates-readout-panel)
6. [Global Modals & Overlays](#6-global-modals--overlays)
7. [State Management & Lifecycle State Machines](#7-state-management--lifecycle-state-machines)
8. [Socket.IO & REST API Integration Matrix](#8-socketio--rest-api-integration-matrix)
9. [Component Checklist & Implementation Rules](#9-component-checklist--implementation-rules)

---

## 1. High-Level Application Architecture & Routes

SafeHer operates as a **dual-route single-page web application (SPA)**:

```
                               ┌────────────────────────┐
                               │  SafeHer Web App Shell │
                               └───────────┬────────────┘
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    ▼                                             ▼
       ┌────────────────────────┐                    ┌────────────────────────┐
       │   Route 1: `/user`     │                    │   Route 2: `/admin`    │
       │   Girl / Wearable View │                    │ Emergency Command View │
       └────────────┬───────────┘                    └────────────┬───────────┘
                    │                                             │
      ┌─────────────┼─────────────┐                  ┌────────────┼────────────┐
      ▼             ▼             ▼                  ▼            ▼            ▼
  7 Nav Tabs    9 Status Cards  GPS Sharing     Status Hero   9 Metrics   Leaflet Map
 (Dashboard,    (Device, SOS,   (Privacy-first: (🟢 SAFE vs    (SOS, ESP,  (Live GPS,
   Sensors,       Motion, IMU,   Active ONLY     🔴 EMERGENCY)  Buzzer,    Pulsing Pin,
   History, etc.) Buzzer, etc.)   during SOS)                   GPS Live)  Coords Panel)
```

### Route Definitions:
* **`/user` (or `#user`)**: Dedicated dashboard for the girl wearing the SafeHer band. Displays device connection, SOS state, motion detection, buzzer status, and the emergency-only GPS sharing widget.
* **`/admin` (or `#admin`)**: Dedicated emergency monitoring center for authorities/guardians. Displays high-priority emergency alerts, live telemetry metrics, real-time Leaflet map tracking, and remote reset controls.

---

## 2. Design Tokens & Theme System

SafeHer uses a modern **Dark Glassmorphism IoT Cyber-Security Aesthetic**.

### Color Palette Tokens (CSS Variables)
| Variable Name | Hex / RGBA Value | Semantic Usage |
| :--- | :--- | :--- |
| `--bg-app` | `#090d16` | Main application background |
| `--bg-sidebar` | `#0f1624` | Sidebar navigation background |
| `--bg-card` | `#141c2e` | Primary card background |
| `--bg-card-hover` | `#19233a` | Card hover state background |
| `--bg-card-inner` | `#0d1422` | Inner inset panels, canvas bg, code blocks |
| `--bg-header` | `rgba(15, 22, 36, 0.85)` | Sticky header with blur backdrop |
| `--border-subtle` | `#1e2a42` | Default component borders |
| `--border-focus` | `#3b82f6` | Active/Focused borders |
| `--primary` | `#3b82f6` | Brand blue accent |
| `--primary-soft` | `rgba(59, 130, 246, 0.12)` | Soft blue pill backgrounds |
| `--safe-green` | `#06d6a0` | Safe status, online indicators, success tags |
| `--safe-green-soft`| `rgba(6, 214, 160, 0.12)` | Soft safe badge backgrounds |
| `--safe-green-glow`| `rgba(6, 214, 160, 0.4)` | Pulsing safe ring glow |
| `--danger-red` | `#ef476f` | Critical SOS alarm, live GPS pulsing marker |
| `--danger-red-soft`| `rgba(239, 71, 111, 0.15)`| Alarm banner backgrounds |
| `--danger-red-glow`| `rgba(239, 71, 111, 0.5)` | Panic button pulsing ring |
| `--warning-yellow` | `#ffd166` | Standby warnings, connecting pills |
| `--info-cyan` | `#06b6d4` | MPU6050 telemetry, sensor highlights |
| `--text-main` | `#f8fafc` | Primary headings and main values |
| `--text-secondary`| `#94a3b8` | Subtitles, labels, secondary info |
| `--text-muted` | `#64748b` | Disabled tags, silent buzzer status |

### Typography
* **Headings**: `Plus Jakarta Sans`, `Inter`, sans-serif (Weights: 600, 700, 800)
* **Body / UI**: `Inter`, system-ui, sans-serif (Weights: 300, 400, 500, 600, 700)
* **Data / Coordinates**: `JetBrains Mono`, `Fira Code`, monospace (Weights: 600, 700)

### Border Radii
* `radius-sm`: `8px`
* `radius-md`: `12px`
* `radius-lg`: `16px`
* `radius-full`: `9999px` (Pills, circular buttons)

---

## 3. Global Shell Components

These components wrap around both `/user` and `/admin` views.

### 3.1 App Layout Container (`.app-layout`)
* **Type**: Root layout container (`display: flex; min-height: 100vh; width: 100vw;`)

### 3.2 Sidebar Navigation (`#sidebar` / `.sidebar`)
* **Header**:
  - Logo Shield (`.logo-shield` with SVG shield + exclamation icon, linear gradient background)
  - Brand Name: `"SafeHer"`
  - Brand Tagline: `"Safety IoT Core"`
  - Mobile close toggle button (`#sidebarCloseBtn`)
* **Navigation Links** (`.nav-menu`):
  1. `Dashboard` (`#dashboard` tab trigger) — Grid icon
  2. `Emergency SOS` (`#emergency` tab trigger) — Lightning bolt icon + Nav Badge (`#navSosBadge`: `"READY"` / `"ACTIVATED"`)
  3. `MPU6050 Sensor` (`#sensors` tab trigger) — Pulse activity icon
  4. `Alert History` (`#history` tab trigger) — Clock history icon + Count bubble (`#historyCount`)
  5. `Device Hardware` (`#device` tab trigger) — Microchip icon
  6. `Emergency Contacts` (`#contacts` tab trigger) — Users guardian icon
  7. `Settings` (`#settings` tab trigger) — Gear cog icon
* **Sidebar Footer** (`.sidebar-footer`):
  - Mini Hardware Status card showing Node ID (`"Node: ESP32-WS01"`) and Status tag (`"Simulated Core v1.0"`).

### 3.3 Top Application Header (`.app-header`)
* **Header Left**:
  - Mobile Menu Toggle Button (`#mobileMenuBtn`)
  - Title: `"SafeHer"`
  - Subtitle: `"WOMEN SAFETY MONITORING SYSTEM"`
* **Header Right**:
  - **Route Switcher Button Group** (`#routeSwitchGroup` / `.route-switch-group`):
    - Button 1 (`#btnRouteUser`): `👩 User View` + Badge (`"Node WS-001"`)
    - Button 2 (`#btnRouteAdmin`): `🛡️ Admin Command` + Badge (`#headerAdminBadge`: `"MONITOR"` / `"EMERGENCY"`)
  - **Backend Connection Status Pill** (`#backendStatusPill`):
    - Dot indicator (`#backendStatusDot`)
    - Label (`#backendStatusText`: `"BACKEND: CONNECTED"` / `"BACKEND: OFFLINE / SIMULATION"`)
  - **Prototype Badge**: `"Prototype • Hardware Ready"`
  - **Real-Time System Clock** (`#systemClock`):
    - Clock icon + Live 12-hour AM/PM display (`#currentTimeDisplay`)

### 3.4 Top Critical Emergency Alert Banner (`#emergencyBanner` / `.emergency-banner`)
* **Visibility**: Hidden in normal state; slides down and pulses red during `EMERGENCY`.
* **Contents**:
  - Warning triangle icon with pulsing animation.
  - Heading: `"CRITICAL EMERGENCY ALERT TRIGGERED"`
  - Subtext: `"SOS trigger detected from Node WS-001. Simulated buzzer is sounding and RGB LED is flashing red."`
  - Button: `"Reset Alert"` (`onclick="resetAlert()"`)

---

## 4. Route 1: Girl / User Dashboard (`/user`)

Container ID: `#viewUser` (class: `.role-view`)

Contains 7 distinct tab views switched via sidebar or URL hash.

---

### Tab 1: Live Safety Overview (`#dashboard`)

#### A. Section Header Row
* Title: `"Live Safety Overview"`
* Subtitle: `"Real-time status indicators and telemetry for wearable node WS-001"`
* Action: `"Sync Sensors"` button (`onclick="simulateSensorsOnce()"`)

#### B. 9-Status Cards Grid (`.cards-grid`)
Every card contains a `.card-header` (title + icon tag), `.card-body` (value row + dot indicator), and `.card-footer-info` (subtext + pill badge).

| # | Card Title | Element ID | Normal State (SAFE) | Emergency State (SOS) | Footer Info / Subtext |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Device Connection** | `#cardDeviceStatus` | `ONLINE` (Green dot) | `ONLINE` (Green dot) | `"ESP8266 Node WS-001"` • Badge: `"Connected"` |
| **2** | **Safety Status** | `#cardSafetyStatus` | `SAFE` (Green dot) | `EMERGENCY` (Red dot) | Subtext: `"No danger detected"` vs `"Panic Trigger Detected"` • Badge: `"ALL SECURE"` vs `"🚨 ALARM ACTIVE"` |
| **3** | **SOS Button** | `#cardSosStatus` | `SOS BUTTON — READY` (Green) | `SOS BUTTON — ACTIVATED` (Red) | `"Physical Tactile Switch"` • Badge: `"Arm State: Active"` vs `"Arm State: Triggered"` |
| **4** | **MPU6050 Motion** | `#cardMpuStatus` | `CONNECTED` (Green) | `CONNECTED` (Green) | `"6-Axis IMU Sensor"` • Badge: `"I2C 0x68"` |
| **5** | **Buzzer (Sound)** | `#cardBuzzerStatus` | `OFF` (Gray dot, muted text) | `ON` (Red dot, sounding) | `"Piezo Alarm 85dB"` • Badge: `"Silent"` vs `"2.7 kHz Active"` |
| **6** | **RGB LED Visual** | `#cardLedStatus` | `GREEN` (Green light preview) | `RED` (Red strobe preview) | `"Common Anode WS2812"` • Badge: `"Normal Pulse"` vs `"Strobe Panic"` |
| **7** | **Motion Detection** | `#cardMotionStatus` | `NORMAL` (Green dot) | `MOTION DETECTED` (Red dot) | Subtext: `"No motion detected"` vs `"Motion detected"` • Badge: `"Active Monitor"` vs `"Motion Alert"` |
| **8** | **Alerts Today** | `#cardAlertsToday` | Numeric counter (`#alertsTodayCount`) | Incrementing count | Subtext: `"Latest: 12:30 PM"` • Badge: `"Log Active"` |
| **9** | **Emergency Live GPS** | `#cardGpsSharing` | `Location sharing inactive` (Gray dot) | `Live location sharing active` (Red pulsing dot) | Privacy Badge: `"🔒 SOS-Triggered Only"` • Subtext: `"Normal state: GPS disabled for privacy"` vs `"Streaming live coordinates"` • Banner: Location denied warning (`#userGpsDeniedAlert`) |

#### C. Quick Hardware Simulation Banner (`.quick-simulation-banner`)
* Info Icon (`⚡`)
* Text: `"Interactive Hardware Simulation Engine"` — `"Click below to simulate real-world panic situations or reset back to safety state."`
* Buttons:
  - `TEST SOS ALERT` (`.btn-sos-test`, `onclick="triggerSOS()"`)
  - `RESET ALERT` (`.btn-reset-clean`, `onclick="resetAlert()"`)

---

### Tab 2: Emergency SOS Center (`#emergency`)

#### A. Emergency Hero Status Card (`#sosHeroCard` / `.emergency-hero-card`)
* **Left Column**:
  - Label: `"Current Emergency Level"`
  - Big Title (`#emergencyHeroTitle`): `"SAFE AND SECURE"` (Normal) / `"EMERGENCY ALERT ACTIVE"` (Emergency)
  - Detailed Description (`#emergencyHeroDesc`)
  - Telemetry Pill Readout:
    - Safety State (`#telemetrySafety`: `"SAFE"` / `"EMERGENCY"`)
    - RGB Indicator (`#telemetryLed`: `"GREEN"` / `"RED"`)
    - Alarm Buzzer (`#telemetryBuzzer`: `"OFF"` / `"ON"`)
    - SOS Switch (`#telemetrySos`: `"READY"` / `"ACTIVATED"`)
* **Right Column**:
  - Big Circular Interactive Panic Button (`#sosTriggerButton` / `.sos-big-action-btn`) with animated expanding pulse ring (`#sosPulseRing`).
  - Button text: `"TEST SOS ALERT"` • Subtitle: `"Click to Simulate Emergency"`
  - Reset Button (`.btn-reset-large`, `onclick="resetAlert()"`): `"RESET SYSTEM TO SAFE"`

#### B. Info Grid (`.info-grid-2`)
1. **Simulated ESP8266 Hardware Sequence Card**: 4-step numbered pipeline (Tactile Interrupt $\rightarrow$ Visual Alarm $\rightarrow$ Auditory Buzzer $\rightarrow$ Cloud Telemetry).
2. **Automated Responder Dispatch Card**: Pipeline pills for Family Primary SMS and National Helpline 112 Geolocation dispatch.

---

### Tab 3: MPU6050 Motion Sensor Telemetry (`#sensors`)

#### A. Dual 3-Axis Reading Cards (`.sensor-readings-grid`)
1. **Accelerometer Card** (`📐 Accelerometer` • Units: `g` • `±2g Range`):
   - Axis X (`#accelX`) + Progress Bar Meter (`#accelBarX`)
   - Axis Y (`#accelY`) + Progress Bar Meter (`#accelBarY`)
   - Axis Z Gravity (`#accelZ`) + Progress Bar Meter (`#accelBarZ`)
2. **Gyroscope Card** (`🔄 Gyroscope` • Units: `°/s` • `±250°/s Range`):
   - Axis X Roll (`#gyroX`) + Progress Bar Meter (`#gyroBarX`)
   - Axis Y Pitch (`#gyroY`) + Progress Bar Meter (`#gyroBarY`)
   - Axis Z Yaw (`#gyroZ`) + Progress Bar Meter (`#gyroBarZ`)

#### B. Live Motion Stream Waveform Chart (`.chart-card`)
* Canvas Container (`<canvas id="sensorWaveCanvas" width="900" height="220"></canvas>`)
* Real-time 40-point rolling waveform series:
  - Blue Line (`#3b82f6`): Accelerometer X
  - Green Line (`#10b981`): Accelerometer Y
  - Cyan Line (`#06b6d4`): Accelerometer Z
* Legend indicators (`.chart-legend`)
* Fall Detection Algorithm explanatory footer note.

---

### Tab 4: Alert & Event History (`#history`)

#### A. Header Action Bar
* Section Title: `"Alert & Event History"`
* Subtitle: `"Audit trail of triggered alarms, motion anomalies, and safety checks"`
* Actions:
  - `"Export Log"` button (`onclick="exportAlerts()"` — exports JSON file)
  - `"Clear"` button (`onclick="clearHistoryConfirmation()"`)

#### B. Responsive Data Table (`#alertsTable` / `.data-table`)
Columns:
1. `Date` (`YYYY-MM-DD`)
2. `Time` (`HH:MM:SS AM/PM`)
3. `Alert Type` (`🚨 SOS Button`, `⚡ Sudden Movement`, `🧪 Test Alert`)
4. `Device` (`SAFEHER-001`)
5. `Status` (Badges: `.badge-status-green` `"Resolved"`, `.badge-status-red` `"Active Alert"`, `.badge-status-gray` `"Reviewed"`)
6. `Action` (Inspection info icon button)

---

### Tab 5: Device Hardware Architecture (`#device`)

6 Hardware Peripheral Component Cards (`.hardware-grid`):
1. **ESP8266 Microcontroller**: Tensilica L106 32-bit RISC, 3.3V, Firmware v1.0.4, Status: Online.
2. **MPU6050 IMU Sensor**: 6-axis I2C (SDA/SCL) on GPIO 21 & 22, Status: Connected.
3. **SOS Emergency Button**: Tactile switch on GPIO 4, Active LOW interrupt, Status: Ready.
4. **RGB Status LED**: Common Anode on GPIO 16, 17, 18, Status: Green (Safe).
5. **Active Piezo Buzzer**: 85-90 dB Acoustic alarm on GPIO 5, Status: OFF.
6. **Wi-Fi Transceiver**: 802.11 b/g/n, SSID: SafeHer-Mesh-IoT, Status: Connected.

---

### Tab 6: Emergency Contacts Directory (`#contacts`)

#### A. Header Action
* Title: `"Emergency Contacts Directory"`
* Action: `"+ Add Contact"` button (`onclick="showAddContactModal()"`)

#### B. Contact Cards Grid (`#contactsGrid` / `.contacts-grid`)
Default directory cards:
1. **Mother** (Avatar `👩` • Primary Guardian • Priority 1 • `+91 98765 43210` • `SMS & Call Active`)
2. **Friend Sneha** (Avatar `🧑` • Secondary Contact • Priority 2 • `+91 91234 56789` • `SMS Active`)
3. **Emergency Services ERSS** (Avatar `🚨` • National Response 112 / 1091 • `Auto GPS Geolocation Dispatch` • `Instant Priority`)
4. Custom user-added contacts (dynamically appended).

---

### Tab 7: System Settings & Calibration (`#settings`)

1. **Simulation Controls Block**:
   - Refresh interval dropdown selector (`#refreshIntervalSelect`: 1.5s / 3.0s / 0.8s)
   - Fall sensitivity threshold range slider (`#fallSensRange`: 1.5g to 5.0g with live label `#sensVal`)
   - Device online simulation toggle switch (`#deviceOnlineToggle`)
2. **Future ESP8266/ESP32 Integration Blueprint Block**:
   - ESP32 REST Endpoint placeholder input
   - Cloud Backend Webhook input
   - Developer integration guide note box.

---

## 5. Route 2: Admin Emergency Command Center (`/admin`)

Container ID: `#viewAdmin` (class: `.role-view`)

This view monitors the girl's wearable device in real time.

---

### Admin Status Hero Banner (`#adminStatusHero` / `.admin-status-hero`)

* **Normal State (SAFE)**:
  - Class: `.admin-status-hero.normal`
  - Icon (`#adminHeroIcon`): Soft green background with `🟢` emoji.
  - Title (`#adminHeroTitle`): `🟢 NO ACTIVE EMERGENCY`
  - Subtitle (`#adminHeroSub`): `"SafeHer monitoring system active • Phone GPS sharing is inactive for privacy"`
  - Resolve Button (`#btnAdminResolve`): Hidden (`display: none;`)
* **Emergency State (SOS ACTIVE)**:
  - Class: `.admin-status-hero.emergency` (flashing red glow with animated border)
  - Icon (`#adminHeroIcon`): Pulsing red background with `🚨` / `🔴` emoji.
  - Title (`#adminHeroTitle`): `🔴 EMERGENCY ACTIVE`
  - Subtitle (`#adminHeroSub`): `"CRITICAL SOS IN PROGRESS: Real-time telemetry and browser GPS streaming."`
  - Resolve Button (`#btnAdminResolve`): Visible (`display: inline-flex;`, `onclick="resetAlert()"`)

---

### Admin 9-Metric Telemetry Grid (`.admin-metrics-grid`)

9 Structured Metric Cards:

```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   SOS STATUS    │ │ ESP8266 DEVICE  │ │  MOTION STATUS  │
│  READY / ACTIVE │ │ ONLINE/OFFLINE  │ │ NORMAL/DETECTED │
└─────────────────┘ └─────────────────┘ └─────────────────┘
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  BUZZER ALARM   │ │  EMERGENCY GPS  │ │  GPS ACCURACY   │
│    OFF / ON     │ │ NOT SHARED/LIVE │ │    -- / ±9.2m   │
└─────────────────┘ └─────────────────┘ └─────────────────┘
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ LAST GPS PING   │ │  INCIDENT REF   │ │ EMERGENCY START │
│  --:--:-- / Time│ │ INC-STANDBY/ID  │ │   -- / Timestamp│
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

| Metric Label | Value Element ID | Normal State (SAFE) | Emergency State (SOS) | Sub-label Element ID & Text |
| :--- | :--- | :--- | :--- | :--- |
| **SOS Status** | `#adminSosVal` | `READY` (Green) | `ACTIVATED` (Red) | `#adminSosSub`: `"Tactile Switch Standby"` vs `"SOS Button Triggered"` |
| **ESP8266 Device**| `#adminDeviceVal` | `ONLINE` (Green) | `ONLINE` (Green) | `#adminDeviceSub`: `"Node: SAFEHER-001"` |
| **Motion Status** | `#adminMotionVal` | `NORMAL` (Green) | `DETECTED` (Red) | `#adminMotionSub`: `"No abnormal motion"` vs `"Abnormal movement detected"` |
| **Buzzer Alarm** | `#adminBuzzerVal` | `OFF` (Gray) | `ON` (Red) | `#adminBuzzerSub`: `"85dB Piezo Silent"` |
| **Emergency GPS**| `#adminGpsVal` | `Not being shared` | `LIVE` (Red) | `#adminGpsSub`: `"Privacy protected in SAFE mode"` vs `"Live coordinates from phone"` |
| **GPS Accuracy** | `#adminAccuracyVal`| `--` (Muted) | `±X.X m` (Green) | `#adminAccuracySub`: `"Browser Geolocation"` |
| **Last Location Update** | `#adminLastUpdateVal` | `--:--:--` | Live timestamp | `#adminLastUpdateSub`: `"Live Socket.IO Stream"` |
| **Incident Reference** | `#adminIncidentVal` | `INC-STANDBY` | `#INC-XXXXXX` | `#adminIncidentSub`: `"SHA-256 Audit Log"` |
| **Emergency Start Time** | `#adminStartTimeVal` | `--` | Emergency Start Time | `#adminStartTimeSub`: `"Timestamp Recorded"` |

---

### Interactive Leaflet Map & Standby Privacy Overlay (`.admin-map-section`)

* **Map Header**:
  - Title: `"Live Emergency Geolocation Tracking"`
  - Subtitle: `"Real-time GPS coordinates transmitted directly from the girl's phone browser during SOS"`
  - Live Status Badge (`#adminMapLiveBadge`): `"🔴 LIVE EMERGENCY TRACKING"` (shown only during SOS)
  - Standby Status Badge (`#adminMapStandbyBadge`): `"🔒 GPS PROTECTED (STANDBY)"` (shown in normal state)
* **Map Viewport Wrapper** (`.admin-map-wrapper`):
  - Leaflet Map DOM Element (`<div id="adminMap"></div>`)
  - **Standby Privacy Overlay** (`#adminMapStandbyOverlay` / `.admin-map-overlay-standby`):
    - Overlay Icon (`📍`)
    - Title: `"GPS Tracking Standby"`
    - Description: *"Location tracking is strictly disabled during normal state to preserve user privacy. When the physical SOS button is pressed, the girl's browser will request permission and stream live coordinates here in real time."*
* **Live Emergency Marker & Radius (During SOS)**:
  - Custom DivIcon (`.emergency-leaflet-marker`) featuring an animated expanding ripple ring (`.pulse-marker-ring`) and pin core (`.pulse-marker-core`).
  - Dynamic Leaflet accuracy circle (`L.circle`) sized to exact GPS accuracy in meters.
  - Interactive Popup: `🚨 EMERGENCY SOS ACTIVE • Node: SAFEHER-001 • Accuracy: ±X.Xm`

---

### Real-Time Coordinates Readout Panel (`.admin-coords-panel`)

Displays raw coordinates received directly from the phone browser. **Zero fake GPS data is displayed.**

| Field Name | DOM Element ID | Normal State (SAFE) | Emergency State (SOS) |
| :--- | :--- | :--- | :--- |
| **Latitude** | `#adminPanelLat` | `--` | Real Decimal Latitude (e.g. `26.843789°`) |
| **Longitude** | `#adminPanelLng` | `--` | Real Decimal Longitude (e.g. `75.565412°`) |
| **Estimated Accuracy** | `#adminPanelAcc` | `--` | Real Accuracy in meters (e.g. `±9.2 m`) |
| **Last Transmission** | `#adminPanelTime` | `--` | Real Transmission Time (e.g. `12:30:45 PM`) |

---

## 6. Global Modals & Overlays

### 6.1 Add Emergency Contact Modal (`#contactModal` / `.modal-overlay`)
* **Trigger**: Click `"+ Add Contact"` button in Contacts tab.
* **Fields**:
  - Contact Name / Relationship (`#newContactName`, text input)
  - Phone Number (`#newContactPhone`, tel input)
  - Email Address (`#newContactEmail`, email input, optional)
* **Actions**:
  - Cancel (`onclick="closeAddContactModal()"`)
  - Save Contact (`onclick="saveNewContact()"`)

### 6.2 Toast Notification System (`#toastContainer` / `.toast-container`)
* **Trigger**: Invoked by `showToast(message, type)`.
* **Types**:
  - `toast-success`: Green border & icon (e.g., connected, safe reset).
  - `toast-danger`: Red border & icon (e.g., SOS alert triggered).
  - `toast-info`: Blue border & icon (e.g., settings change, log export).
  - `toast-warning`: Yellow border & icon (e.g., offline warning).
* **Behavior**: Slide-in from right, auto-dismiss after 3500ms, dismiss button (`×`).

---

## 7. State Management & Lifecycle State Machines

### 7.1 Global Hardware State Object (`hardwareState`)
```javascript
const hardwareState = {
  deviceId: "SAFEHER-001",
  deviceName: "SafeHer Band",
  deviceStatus: "ONLINE",     // 'ONLINE' | 'OFFLINE'
  safetyStatus: "SAFE",       // 'SAFE' | 'EMERGENCY'
  sosButton: "READY",         // 'READY' | 'ACTIVATED'
  motionStatus: "NORMAL",     // 'NORMAL' | 'MOTION DETECTED'
  mpuStatus: "CONNECTED",     // 'CONNECTED' | 'DISCONNECTED'
  buzzer: "OFF",              // 'OFF' | 'ON'
  rgbLed: "GREEN",            // 'GREEN' | 'RED'
  lastPingTime: new Date(),
  alertsCountToday: 3,
  accel: { x: 0.24, y: 0.91, z: 9.72 },
  gyro: { x: 1.20, y: 0.85, z: 2.10 }
};
```

### 7.2 Emergency-Only GPS State Machine (`gpsState`)

```
 ┌────────────────────────────────────────────────────────┐
 │                    1. INACTIVE                         │
 │     Normal State: No location request, privacy safe    │
 └──────────────────────────┬─────────────────────────────┘
                            │ Physical SOS button pressed
                            ▼
 ┌────────────────────────────────────────────────────────┐
 │             2. REQUESTING_PERMISSION                   │
 │       Browser prompts user for location access         │
 └─────────────┬────────────────────────────┬─────────────┘
               │ Allowed                    │ Denied / Unavailable
               ▼                            ▼
 ┌───────────────────────────┐ ┌───────────────────────────┐
 │        3. ACTIVE          │ │  4. DENIED / UNAVAILABLE  │
 │ navigator.geolocation     │ │ Show clear user alert:    │
 │ .watchPosition() active   │ │ "Location access required │
 │ Live coordinates sent     │ │  during emergency"        │
 └─────────────┬─────────────┘ └───────────────────────────┘
               │ Emergency resolved / Reset
               ▼
 ┌────────────────────────────────────────────────────────┐
 │                      5. STOPPED                        │
 │  navigator.geolocation.clearWatch(id) executed         │
 │  Location transmission halted -> Returns to INACTIVE   │
 └────────────────────────────────────────────────────────┘
```

---

## 8. Socket.IO & REST API Integration Matrix

### 8.1 Real-Time Socket.IO Events
| Event Name | Direction | Payload Structure | UI Response Action |
| :--- | :--- | :--- | :--- |
| `connect` | Inbound | `socket.id` | Set backend status pill to Green `CONNECTED`. Fetch device state and alerts. |
| `disconnect` | Inbound | `reason` | Set backend status pill to Yellow `OFFLINE / SIMULATION`. |
| `deviceStatus` | Inbound | `{ status, safetyStatus, sosButton, buzzer, rgbLed }` | Updates all 9 user cards and admin cards. If `EMERGENCY`, triggers `startEmergencyGPS()`. |
| `sensorData` | Inbound | `{ accelerationX, accelerationY, accelerationZ, gyroX, gyroY, gyroZ, motionDetected }` | Updates MPU6050 numbers, progress meters, and appends to canvas waveform. |
| `sosAlert` | Inbound | `{ alert: { _id, deviceId, type, timestamp } }` | Sets `safetyStatus = 'EMERGENCY'`, sounds buzzer, starts browser `watchPosition()`, shows Admin red hero banner. |
| `locationUpdate` | Inbound | `{ deviceId, latitude, longitude, accuracy, timestamp, incidentId }` | Removes standby overlay on Admin map, centers Leaflet view, plots pulsing marker & accuracy circle, updates coordinate readouts. |
| `alertResolved` | Inbound | `{ deviceId }` | Sets `safetyStatus = 'SAFE'`, stops buzzer, executes `clearWatch()`, clears Admin map marker, restores standby overlay. |

### 8.2 REST API Endpoints
| HTTP Method | Route Endpoint | Request Body | Response Payload |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | *None* | `{ success: true, database: "connected", socket: "ready" }` |
| `GET` | `/api/device/status` | *None* | `{ success: true, data: DeviceObject }` |
| `POST` | `/api/device/reset` | `{ deviceId: "SAFEHER-001" }` | `{ success: true, message: "Device alert state reset to SAFE successfully." }` |
| `POST` | `/api/alerts/sos` | `{ deviceId, type, message, triggeredBy }` | `{ success: true, alert: AlertObject }` |
| `GET` | `/api/alerts?limit=20` | *None* | `{ success: true, data: [ AlertObjects ] }` |
| `POST` | `/api/location/update` | `{ deviceId, latitude, longitude, accuracy, timestamp, incidentId }` | `{ success: true, message: "Live emergency location received", data: LocationObject }` |
| `GET` | `/api/location/latest/:deviceId` | *None* | `{ success: true, data: LatestLocationObject }` |
| `GET` | `/api/location/history/:deviceId`| *None* | `{ success: true, count: N, data: [ LocationObjects ] }` |

---

## 9. Component Checklist & Implementation Rules

When creating or rebuilding this UI, adhere strictly to these engineering requirements:

### ✅ Mandatory Rules:
1. **Web Application Only**: Build purely with HTML5, CSS3, JavaScript (ES6 Modules) and optional Vite bundling. No native mobile/Android code.
2. **GPS Privacy Rule**: **Never** call `navigator.geolocation.getCurrentPosition` or `navigator.geolocation.watchPosition` during normal/safe state. Geolocation must **only** be initiated upon entering `EMERGENCY` state.
3. **Emergency Cleanup**: When resetting from emergency to safe, **always** call `navigator.geolocation.clearWatch(geoWatchId)` and nullify the watch ID.
4. **Zero Battery Remnants**: Do not include any battery percentage cards, battery meters, or fake battery calculations anywhere in the UI.
5. **No Fake GPS Data**: In normal state, coordinates must display as `--` and map must display the standby privacy overlay. Coordinates must only be populated from real browser geolocation transmissions during SOS.
6. **Leaflet Map Integration**: Include Leaflet CSS & JS. Ensure `map.invalidateSize()` is invoked when switching to the `/admin` view to guarantee correct tile rendering.
7. **Dual-Route URL Support**: Support both path-based routing (`/user`, `/admin`) and hash fallback (`#user`, `#admin`) with seamless tab and view toggles.

---

*Master Specification prepared for SafeHer IoT Web Platform.*
