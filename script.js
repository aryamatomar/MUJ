/**
 * ==============================================================================
 * SafeHer — Women Safety IoT Dashboard
 * Frontend Core Logic & Real-time Backend Engine (Version 1.1)
 * 
 * Features:
 * - Real-time Socket.IO communication with Node.js & MongoDB backend
 * - Instant fallback to local simulation if backend is offline
 * - MPU6050 Live Waveform Canvas Graph
 * - Interactive SOS trigger and Reset flow with REST API calls
 * ==============================================================================
 */

// ==========================================
// 1. BACKEND & HARDWARE STATE
// ==========================================
const BACKEND_URL = "http://localhost:5000";
let socket = null;
let isBackendConnected = false;

// Global Hardware State (Synced with MongoDB Device Model)
const hardwareState = {
  deviceId: "SAFEHER-001",
  deviceName: "SafeHer Band",
  deviceStatus: "ONLINE",     // 'ONLINE' | 'OFFLINE'
  safetyStatus: "SAFE",       // 'SAFE' | 'EMERGENCY'
  sosButton: "INACTIVE",      // 'READY' | 'INACTIVE' | 'ACTIVE'
  mpuStatus: "CONNECTED",     // 'CONNECTED' | 'DISCONNECTED'
  buzzer: "OFF",              // 'OFF' | 'ON'
  rgbLed: "GREEN",            // 'GREEN' | 'RED'
  batteryLevel: 92,           // Percentage (0 - 100)
  batteryVoltage: 3.95,       // Volts
  lastPingTime: new Date(),
  alertsCountToday: 3,
  
  // 6-Axis Motion Sensor Data
  accel: { x: 0.24, y: 0.91, z: 9.72 },
  gyro: { x: 1.20, y: 0.85, z: 2.10 }
};

// Simulation settings
let simIntervalMs = 1500;
let sensorTimer = null;

// Alert History dataset (Loaded from MongoDB / fallback memory)
let alertHistoryData = [
  {
    id: "alert-1",
    date: new Date().toISOString().split("T")[0],
    time: "12:30 PM",
    type: "SOS Button",
    device: "SAFEHER-001",
    status: "Resolved",
    statusType: "success"
  },
  {
    id: "alert-2",
    date: new Date().toISOString().split("T")[0],
    time: "11:15 AM",
    type: "Sudden Movement",
    device: "SAFEHER-001",
    status: "Reviewed",
    statusType: "info"
  },
  {
    id: "alert-3",
    date: new Date().toISOString().split("T")[0],
    time: "10:05 AM",
    type: "Test Alert",
    device: "SAFEHER-001",
    status: "Resolved",
    statusType: "success"
  }
];

// Canvas waveform history points (rolling 40 points)
const waveHistory = {
  x: Array(40).fill(0.24),
  y: Array(40).fill(0.91),
  z: Array(40).fill(9.72)
};

// ==========================================
// 2. LIFECYCLE & INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  console.log("SafeHer Dashboard initialized (Backend-Connected v1.1)");

  // Setup tab navigation
  initNavigation();

  // Setup real-time system clock
  startSystemClock();

  // Render initial alert history
  renderAlertHistory();

  // Render initial dashboard values
  updateDashboard();

  // Start periodic local sensor simulation (keeps dashboard active if backend is offline)
  startSensorSimulation();

  // Init canvas wave drawing loop
  initSensorWaveform();

  // Connect to Node.js & Socket.IO backend
  initBackendConnection();
});

// ==========================================
// 3. BACKEND & SOCKET.IO INTEGRATION
// ==========================================

function initBackendConnection() {
  updateBackendStatusUI(false, "BACKEND: CONNECTING...");

  // Check if Socket.IO library is loaded
  if (typeof io === "undefined") {
    console.warn("Socket.IO client library not found. Running in simulation mode.");
    updateBackendStatusUI(false, "BACKEND: OFFLINE / SIMULATION");
    return;
  }

  try {
    socket = io(BACKEND_URL, {
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 5000
    });

    socket.on("connect", () => {
      console.log("✅ Socket.IO connected to SafeHer backend server:", socket.id);
      isBackendConnected = true;
      updateBackendStatusUI(true, "BACKEND: CONNECTED");
      showToast("🟢 Connected to SafeHer Backend API & MongoDB", "success");

      // Fetch initial live state & alert history from API
      syncDeviceFromBackend();
      fetchAlertHistoryFromBackend();
    });

    socket.on("disconnect", () => {
      console.warn("⚠️ Socket.IO disconnected from SafeHer backend. Falling back to simulation mode.");
      isBackendConnected = false;
      updateBackendStatusUI(false, "BACKEND: OFFLINE / SIMULATION");
      showToast("⚠️ Backend offline. Dashboard active in Simulation Mode.", "info");
    });

    socket.on("connect_error", () => {
      isBackendConnected = false;
      updateBackendStatusUI(false, "BACKEND: OFFLINE / SIMULATION");
    });

    // --- REAL-TIME EVENT: DEVICE STATUS SYNC ---
    socket.on("deviceStatus", (device) => {
      console.log("📡 Live Device Status received:", device);
      if (device) {
        hardwareState.deviceStatus = device.status || hardwareState.deviceStatus;
        hardwareState.safetyStatus = device.safetyStatus || hardwareState.safetyStatus;
        hardwareState.sosButton = device.sosButton === "ACTIVE" ? "ACTIVE" : (device.sosButton === "READY" ? "READY" : "INACTIVE");
        hardwareState.buzzer = device.buzzer || hardwareState.buzzer;
        hardwareState.rgbLed = device.rgbLed || hardwareState.rgbLed;
        hardwareState.batteryLevel = device.batteryLevel !== undefined ? device.batteryLevel : hardwareState.batteryLevel;
        hardwareState.lastPingTime = new Date();
        updateDashboard();
      }
    });

    // --- REAL-TIME EVENT: MPU6050 SENSOR TELEMETRY ---
    socket.on("sensorData", (data) => {
      if (data) {
        const ax = data.accelerationX !== undefined ? data.accelerationX : hardwareState.accel.x;
        const ay = data.accelerationY !== undefined ? data.accelerationY : hardwareState.accel.y;
        const az = data.accelerationZ !== undefined ? data.accelerationZ : hardwareState.accel.z;
        const gx = data.gyroX !== undefined ? data.gyroX : hardwareState.gyro.x;
        const gy = data.gyroY !== undefined ? data.gyroY : hardwareState.gyro.y;
        const gz = data.gyroZ !== undefined ? data.gyroZ : hardwareState.gyro.z;

        hardwareState.accel = { x: ax, y: ay, z: az };
        hardwareState.gyro = { x: gx, y: gy, z: gz };

        // Push live values to waveform history
        waveHistory.x.shift();
        waveHistory.x.push(ax);
        waveHistory.y.shift();
        waveHistory.y.push(ay);
        waveHistory.z.shift();
        waveHistory.z.push(az);

        updateSensorDisplay();
      }
    });

    // --- REAL-TIME EVENT: EMERGENCY SOS ALERT BROADCAST ---
    socket.on("sosAlert", (payload) => {
      console.log("🚨 Emergency SOS Alert received from backend:", payload);
      hardwareState.safetyStatus = "EMERGENCY";
      hardwareState.sosButton = "ACTIVE";
      hardwareState.buzzer = "ON";
      hardwareState.rgbLed = "RED";
      hardwareState.alertsCountToday += 1;
      hardwareState.lastPingTime = new Date();

      if (payload && payload.alert) {
        const alert = payload.alert;
        addAlertRecord({
          id: alert._id || Date.now(),
          date: (alert.timestamp ? new Date(alert.timestamp) : new Date()).toISOString().split("T")[0],
          time: formatTimeAMPM(alert.timestamp ? new Date(alert.timestamp) : new Date()),
          type: alert.type || "SOS Button",
          device: alert.deviceId || hardwareState.deviceId,
          status: "Active Alert",
          statusType: "danger"
        });
      }

      updateDashboard();
      playSimulatedBeep();
      showToast("🚨 EMERGENCY SOS BROADCAST RECEIVED! Device in alarm state.", "danger");
    });

    // --- REAL-TIME EVENT: ALERT RESOLVED / RESET ---
    socket.on("alertResolved", (payload) => {
      console.log("✅ Alert Resolved event received:", payload);
      hardwareState.safetyStatus = "SAFE";
      hardwareState.sosButton = "INACTIVE";
      hardwareState.buzzer = "OFF";
      hardwareState.rgbLed = "GREEN";
      hardwareState.lastPingTime = new Date();

      updateDashboard();
      showToast("✅ System Reset: Device returned to SAFE state.", "success");
    });

  } catch (err) {
    console.warn("Backend initialization error:", err);
    updateBackendStatusUI(false, "BACKEND: OFFLINE / SIMULATION");
  }
}

function updateBackendStatusUI(connected, text) {
  const pill = document.getElementById("backendStatusPill");
  const dot = document.getElementById("backendStatusDot");
  const textEl = document.getElementById("backendStatusText");

  if (textEl) textEl.innerText = text;
  if (dot) {
    if (connected) {
      dot.className = "proto-dot status-green";
      dot.style.background = "var(--safe-green)";
      dot.style.boxShadow = "0 0 8px var(--safe-green)";
    } else {
      dot.className = "proto-dot";
      dot.style.background = "var(--warning-yellow)";
      dot.style.boxShadow = "0 0 8px var(--warning-yellow)";
    }
  }
}

async function syncDeviceFromBackend() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/device/status`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        hardwareState.deviceId = d.deviceId || hardwareState.deviceId;
        hardwareState.safetyStatus = d.safetyStatus || hardwareState.safetyStatus;
        hardwareState.sosButton = d.sosButton === "ACTIVE" ? "ACTIVE" : (d.sosButton === "READY" ? "READY" : "INACTIVE");
        hardwareState.buzzer = d.buzzer || hardwareState.buzzer;
        hardwareState.rgbLed = d.rgbLed || hardwareState.rgbLed;
        hardwareState.batteryLevel = d.batteryLevel !== undefined ? d.batteryLevel : hardwareState.batteryLevel;
        updateDashboard();
      }
    }
  } catch (err) {
    console.warn("Could not sync device status from REST API:", err.message);
  }
}

async function fetchAlertHistoryFromBackend() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/alerts?limit=20`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        alertHistoryData = json.data.map((item) => {
          const d = item.timestamp ? new Date(item.timestamp) : new Date();
          return {
            id: item._id,
            date: d.toISOString().split("T")[0],
            time: formatTimeAMPM(d),
            type: item.type || "SOS Button",
            device: item.deviceId || "SAFEHER-001",
            status: item.resolved ? "Resolved" : "Active Alert",
            statusType: item.resolved ? "success" : "danger"
          };
        });
        hardwareState.alertsCountToday = alertHistoryData.length;
        renderAlertHistory();
        updateDashboard();
      }
    }
  } catch (err) {
    console.warn("Could not fetch alerts from REST API:", err.message);
  }
}

// ==========================================
// 4. CORE ACTION FUNCTIONS (API + FALLBACK)
// ==========================================

/**
 * Triggers SOS Emergency sequence.
 * Calls backend POST /api/alerts/sos and falls back to local state if offline.
 */
async function triggerSOS() {
  console.log("🚨 triggerSOS invoked");

  // Immediate optimistic UI update
  hardwareState.safetyStatus = "EMERGENCY";
  hardwareState.sosButton = "ACTIVE";
  hardwareState.buzzer = "ON";
  hardwareState.rgbLed = "RED";
  hardwareState.alertsCountToday += 1;
  hardwareState.lastPingTime = new Date();

  const currentTimeStr = formatTimeAMPM(new Date());
  const currentDateStr = new Date().toISOString().split("T")[0];

  addAlertRecord({
    id: `local-${Date.now()}`,
    date: currentDateStr,
    time: currentTimeStr,
    type: "SOS Button",
    device: hardwareState.deviceId,
    status: "Active Alert",
    statusType: "danger"
  });

  updateDashboard();
  playSimulatedBeep();
  showToast("🚨 EMERGENCY SOS TRIGGERED! Node WS-001 sounding alarm.", "danger");

  // Dispatch to backend API
  if (isBackendConnected) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/alerts/sos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: hardwareState.deviceId,
          type: "SOS Button",
          message: "SOS alert triggered via SafeHer dashboard TEST SOS button.",
          triggeredBy: "Dashboard Test Button"
        })
      });
      const data = await res.json();
      console.log("Backend SOS API response:", data);
    } catch (err) {
      console.warn("Could not send SOS to backend API:", err.message);
    }
  }
}

/**
 * Resets system back to SAFE status.
 * Calls backend POST /api/device/reset and falls back to local state if offline.
 */
async function resetAlert() {
  console.log("✅ resetAlert invoked");

  hardwareState.safetyStatus = "SAFE";
  hardwareState.sosButton = "READY";
  hardwareState.buzzer = "OFF";
  hardwareState.rgbLed = "GREEN";
  hardwareState.lastPingTime = new Date();

  updateDashboard();
  showToast("✅ System Reset: Device WS-001 returned to SAFE state.", "success");

  // Dispatch to backend API
  if (isBackendConnected) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/device/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: hardwareState.deviceId
        })
      });
      const data = await res.json();
      console.log("Backend Reset API response:", data);
    } catch (err) {
      console.warn("Could not send Reset to backend API:", err.message);
    }
  }
}

/**
 * Reads device status.
 */
function getDeviceStatus() {
  return {
    status: hardwareState.deviceStatus,
    battery: hardwareState.batteryLevel,
    isMpuConnected: hardwareState.mpuStatus === "CONNECTED"
  };
}

/**
 * Generates local simulated MPU6050 reading when real ESP32 stream is idle
 */
function getSensorData() {
  if (hardwareState.safetyStatus === "EMERGENCY") {
    const ax = +(0.8 + (Math.random() * 2.2 - 1.1)).toFixed(2);
    const ay = +(1.5 + (Math.random() * 2.5 - 1.2)).toFixed(2);
    const az = +(9.8 + (Math.random() * 4.0 - 2.0)).toFixed(2);

    const gx = +(5.0 + (Math.random() * 15.0 - 7.5)).toFixed(2);
    const gy = +(4.2 + (Math.random() * 12.0 - 6.0)).toFixed(2);
    const gz = +(6.8 + (Math.random() * 18.0 - 9.0)).toFixed(2);

    return { accel: { x: ax, y: ay, z: az }, gyro: { x: gx, y: gy, z: gz } };
  } else {
    const ax = +(0.20 + (Math.random() * 0.12 - 0.06)).toFixed(2);
    const ay = +(0.90 + (Math.random() * 0.10 - 0.05)).toFixed(2);
    const az = +(9.72 + (Math.random() * 0.16 - 0.08)).toFixed(2);

    const gx = +(1.20 + (Math.random() * 0.40 - 0.20)).toFixed(2);
    const gy = +(0.85 + (Math.random() * 0.30 - 0.15)).toFixed(2);
    const gz = +(2.10 + (Math.random() * 0.50 - 0.25)).toFixed(2);

    return { accel: { x: ax, y: ay, z: az }, gyro: { x: gx, y: gy, z: gz } };
  }
}

/**
 * Global UI synchronizer - updates all DOM elements based on `hardwareState`.
 */
function updateDashboard() {
  const isEmergency = hardwareState.safetyStatus === "EMERGENCY";
  const isOnline = hardwareState.deviceStatus === "ONLINE";

  // 1. Device Status Card
  const deviceStatusText = document.getElementById("deviceStatusText");
  const deviceStatusDot = document.getElementById("deviceStatusDot");
  if (deviceStatusText && deviceStatusDot) {
    deviceStatusText.innerText = hardwareState.deviceStatus;
    if (isOnline) {
      deviceStatusText.className = "card-main-val text-green";
      deviceStatusDot.className = "status-indicator status-green";
    } else {
      deviceStatusText.className = "card-main-val text-muted";
      deviceStatusDot.className = "status-indicator status-gray";
    }
  }

  // 2. Safety Status Card
  const cardSafetyStatus = document.getElementById("cardSafetyStatus");
  const safetyStatusText = document.getElementById("safetyStatusText");
  const safetyStatusDot = document.getElementById("safetyStatusDot");
  const safetyBadge = document.getElementById("safetyBadge");
  const safetyStatusSub = document.getElementById("safetyStatusSub");

  if (safetyStatusText) {
    if (isEmergency) {
      safetyStatusText.innerText = "EMERGENCY";
      safetyStatusText.className = "card-main-val text-red";
      safetyStatusDot.className = "status-indicator status-red";
      safetyBadge.innerText = "🚨 ALARM ACTIVE";
      safetyBadge.className = "badge-status-red";
      safetyStatusSub.innerText = "Panic Trigger Detected";
      if (cardSafetyStatus) cardSafetyStatus.className = "status-card danger-highlight";
    } else {
      safetyStatusText.innerText = "SAFE";
      safetyStatusText.className = "card-main-val text-green";
      safetyStatusDot.className = "status-indicator status-green";
      safetyBadge.innerText = "ALL SECURE";
      safetyBadge.className = "badge-status-green";
      safetyStatusSub.innerText = "No danger detected";
      if (cardSafetyStatus) cardSafetyStatus.className = "status-card primary-highlight";
    }
  }

  // 3. SOS Button Status
  const sosStatusText = document.getElementById("sosStatusText");
  const sosStatusDot = document.getElementById("sosStatusDot");
  const navSosBadge = document.getElementById("navSosBadge");
  const hwSosBadge = document.getElementById("hwSosBadge");

  if (sosStatusText) {
    sosStatusText.innerText = hardwareState.sosButton === "INACTIVE" ? "READY" : hardwareState.sosButton;
    if (isEmergency) {
      sosStatusText.className = "card-main-val text-red";
      sosStatusDot.className = "status-indicator status-red";
      if (navSosBadge) {
        navSosBadge.innerText = "ACTIVE";
        navSosBadge.className = "badge-pill badge-sos-nav emergency";
      }
      if (hwSosBadge) {
        hwSosBadge.innerText = "TRIGGERED";
        hwSosBadge.className = "badge-status-red";
      }
    } else {
      sosStatusText.className = "card-main-val text-green";
      sosStatusDot.className = "status-indicator status-green";
      if (navSosBadge) {
        navSosBadge.innerText = "READY";
        navSosBadge.className = "badge-pill badge-sos-nav";
      }
      if (hwSosBadge) {
        hwSosBadge.innerText = "READY";
        hwSosBadge.className = "badge-status-green";
      }
    }
  }

  // 4. MPU6050 Status
  const mpuStatusText = document.getElementById("mpuStatusText");
  const mpuStatusDot = document.getElementById("mpuStatusDot");
  if (mpuStatusText) {
    mpuStatusText.innerText = hardwareState.mpuStatus;
    mpuStatusText.className = hardwareState.mpuStatus === "CONNECTED" ? "card-main-val text-green" : "card-main-val text-muted";
    mpuStatusDot.className = hardwareState.mpuStatus === "CONNECTED" ? "status-indicator status-green" : "status-indicator status-gray";
  }

  // 5. Buzzer Status
  const buzzerStatusText = document.getElementById("buzzerStatusText");
  const buzzerStatusDot = document.getElementById("buzzerStatusDot");
  const buzzerFreqTag = document.getElementById("buzzerFreqTag");
  const hwBuzzerBadge = document.getElementById("hwBuzzerBadge");

  if (buzzerStatusText) {
    buzzerStatusText.innerText = hardwareState.buzzer;
    if (hardwareState.buzzer === "ON") {
      buzzerStatusText.className = "card-main-val text-red";
      buzzerStatusDot.className = "status-indicator status-red";
      if (buzzerFreqTag) buzzerFreqTag.innerText = "2.7 kHz Active";
      if (hwBuzzerBadge) {
        hwBuzzerBadge.innerText = "ON (Sounding)";
        hwBuzzerBadge.className = "badge-status-red";
      }
    } else {
      buzzerStatusText.className = "card-main-val text-muted";
      buzzerStatusDot.className = "status-indicator status-gray";
      if (buzzerFreqTag) buzzerFreqTag.innerText = "Silent";
      if (hwBuzzerBadge) {
        hwBuzzerBadge.innerText = "OFF";
        hwBuzzerBadge.className = "badge-status-gray";
      }
    }
  }

  // 6. RGB LED Status
  const ledStatusText = document.getElementById("ledStatusText");
  const ledPreviewLight = document.getElementById("ledPreviewLight");
  const ledPatternTag = document.getElementById("ledPatternTag");
  const hwLedBadge = document.getElementById("hwLedBadge");

  if (ledStatusText) {
    ledStatusText.innerText = hardwareState.rgbLed;
    if (hardwareState.rgbLed === "RED") {
      ledStatusText.className = "card-main-val text-red";
      if (ledPreviewLight) ledPreviewLight.className = "led-light-preview led-red";
      if (ledPatternTag) ledPatternTag.innerText = "Strobe Panic";
      if (hwLedBadge) {
        hwLedBadge.innerText = "Red (Alarm)";
        hwLedBadge.className = "badge-status-red";
      }
    } else {
      ledStatusText.className = "card-main-val text-green";
      if (ledPreviewLight) ledPreviewLight.className = "led-light-preview led-green";
      if (ledPatternTag) ledPatternTag.innerText = "Normal Pulse";
      if (hwLedBadge) {
        hwLedBadge.innerText = "Green (Safe)";
        hwLedBadge.className = "badge-status-green";
      }
    }
  }

  // 7. Battery & Last Activity
  const batteryPercentText = document.getElementById("batteryPercentText");
  const batteryBarFill = document.getElementById("batteryBarFill");
  const lastActivityText = document.getElementById("lastActivityText");
  if (batteryPercentText) batteryPercentText.innerText = `${hardwareState.batteryLevel}%`;
  if (batteryBarFill) batteryBarFill.style.width = `${hardwareState.batteryLevel}%`;
  if (lastActivityText) lastActivityText.innerText = `Last ping: ${formatTimeAMPM(hardwareState.lastPingTime)}`;

  // 8. Alerts Count Today
  const alertsTodayCount = document.getElementById("alertsTodayCount");
  if (alertsTodayCount) alertsTodayCount.innerText = hardwareState.alertsCountToday;

  // 9. Emergency Banner & Hero Card
  const emergencyBanner = document.getElementById("emergencyBanner");
  const sosHeroCard = document.getElementById("sosHeroCard");
  const emergencyHeroTitle = document.getElementById("emergencyHeroTitle");
  const emergencyHeroDesc = document.getElementById("emergencyHeroDesc");
  const sosPulseRing = document.getElementById("sosPulseRing");

  const telemetrySafety = document.getElementById("telemetrySafety");
  const telemetryLed = document.getElementById("telemetryLed");
  const telemetryBuzzer = document.getElementById("telemetryBuzzer");
  const telemetrySos = document.getElementById("telemetrySos");

  if (emergencyBanner) {
    if (isEmergency) {
      emergencyBanner.classList.add("active");
    } else {
      emergencyBanner.classList.remove("active");
    }
  }

  if (sosHeroCard && emergencyHeroTitle) {
    if (isEmergency) {
      sosHeroCard.classList.add("emergency-active");
      emergencyHeroTitle.innerText = "EMERGENCY ALERT ACTIVE";
      emergencyHeroTitle.className = "sos-current-status-title emergency";
      emergencyHeroDesc.innerText = "SOS signal transmitted to cloud dashboard. Device alarm sounding and emergency contacts are being alerted.";
      if (sosPulseRing) sosPulseRing.classList.add("emergency");
    } else {
      sosHeroCard.classList.remove("emergency-active");
      emergencyHeroTitle.innerText = "SAFE AND SECURE";
      emergencyHeroTitle.className = "sos-current-status-title";
      emergencyHeroDesc.innerText = "The wearable device is armed and continuously monitoring for panic button presses and abrupt fall movements.";
      if (sosPulseRing) sosPulseRing.classList.remove("emergency");
    }
  }

  if (telemetrySafety) {
    telemetrySafety.innerText = hardwareState.safetyStatus;
    telemetrySafety.className = isEmergency ? "telemetry-val text-red" : "telemetry-val text-green";
  }
  if (telemetryLed) {
    telemetryLed.innerText = hardwareState.rgbLed;
    telemetryLed.className = isEmergency ? "telemetry-val text-red" : "telemetry-val text-green";
  }
  if (telemetryBuzzer) {
    telemetryBuzzer.innerText = hardwareState.buzzer;
    telemetryBuzzer.className = hardwareState.buzzer === "ON" ? "telemetry-val text-red" : "telemetry-val text-muted";
  }
  if (telemetrySos) {
    telemetrySos.innerText = hardwareState.sosButton === "INACTIVE" ? "READY" : hardwareState.sosButton;
    telemetrySos.className = isEmergency ? "telemetry-val text-red" : "telemetry-val text-green";
  }

  // 10. Update MPU6050 Values
  updateSensorDisplay();
}

/**
 * Updates DOM numbers and progress bars in the MPU6050 Sensor Tab.
 */
function updateSensorDisplay() {
  const { accel, gyro } = hardwareState;

  const accelXEl = document.getElementById("accelX");
  const accelYEl = document.getElementById("accelY");
  const accelZEl = document.getElementById("accelZ");
  const gyroXEl = document.getElementById("gyroX");
  const gyroYEl = document.getElementById("gyroY");
  const gyroZEl = document.getElementById("gyroZ");

  if (accelXEl) accelXEl.innerText = accel.x.toFixed(2);
  if (accelYEl) accelYEl.innerText = accel.y.toFixed(2);
  if (accelZEl) accelZEl.innerText = accel.z.toFixed(2);

  if (gyroXEl) gyroXEl.innerText = gyro.x.toFixed(2);
  if (gyroYEl) gyroYEl.innerText = gyro.y.toFixed(2);
  if (gyroZEl) gyroZEl.innerText = gyro.z.toFixed(2);

  const accelBarX = document.getElementById("accelBarX");
  const accelBarY = document.getElementById("accelBarY");
  const accelBarZ = document.getElementById("accelBarZ");

  if (accelBarX) accelBarX.style.width = `${Math.min(Math.abs(accel.x) * 50, 100)}%`;
  if (accelBarY) accelBarY.style.width = `${Math.min(Math.abs(accel.y) * 50, 100)}%`;
  if (accelBarZ) accelBarZ.style.width = `${Math.min((accel.z / 12) * 100, 100)}%`;
}

// ==========================================
// 5. SENSOR SIMULATION & WAVEFORM CHART
// ==========================================

function startSensorSimulation() {
  if (sensorTimer) clearInterval(sensorTimer);

  sensorTimer = setInterval(() => {
    simulateSensorsOnce();
  }, simIntervalMs);
}

function simulateSensorsOnce() {
  // If backend is connected, we can send a demo sensor reading to the API
  if (isBackendConnected) {
    fetch(`${BACKEND_URL}/api/demo/sensor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: hardwareState.deviceId,
        isAgitated: hardwareState.safetyStatus === "EMERGENCY"
      })
    }).catch(() => {
      // Local fallback on network error
      runLocalSensorUpdate();
    });
  } else {
    runLocalSensorUpdate();
  }
}

function runLocalSensorUpdate() {
  const freshData = getSensorData();
  hardwareState.accel = freshData.accel;
  hardwareState.gyro = freshData.gyro;

  waveHistory.x.shift();
  waveHistory.x.push(freshData.accel.x);

  waveHistory.y.shift();
  waveHistory.y.push(freshData.accel.y);

  waveHistory.z.shift();
  waveHistory.z.push(freshData.accel.z);

  updateSensorDisplay();
}

/**
 * Smooth real-time canvas waveform for MPU6050
 */
function initSensorWaveform() {
  const canvas = document.getElementById("sensorWaveCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  function draw() {
    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = "#0d1422";
    ctx.fillRect(0, 0, width, height);

    // Draw horizontal grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let y = 30; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw waveform series
    drawSeries(ctx, waveHistory.x, "#3b82f6", width, height, 0, 3);
    drawSeries(ctx, waveHistory.y, "#10b981", width, height, 0, 3);
    drawSeries(ctx, waveHistory.z, "#06b6d4", width, height, 8, 12);

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
}

function drawSeries(ctx, dataArray, color, width, height, minVal, maxVal) {
  if (!dataArray || dataArray.length < 2) return;

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineJoin = "round";

  const stepX = width / (dataArray.length - 1);

  dataArray.forEach((val, i) => {
    const normalized = (val - minVal) / (maxVal - minVal || 1);
    const clamped = Math.max(0, Math.min(1, normalized));
    const y = height - clamped * (height - 30) - 15;
    const x = i * stepX;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();
}

// ==========================================
// 6. ALERT HISTORY & TABLE RENDERING
// ==========================================

function renderAlertHistory() {
  const tbody = document.getElementById("alertsTableBody");
  const historyCount = document.getElementById("historyCount");
  if (!tbody) return;

  tbody.innerHTML = "";

  alertHistoryData.forEach((item) => {
    const row = document.createElement("tr");

    let badgeClass = "badge-status-green";
    if (item.statusType === "danger" || item.status === "Active Alert") badgeClass = "badge-status-red";
    if (item.statusType === "info" || item.status === "Reviewed") badgeClass = "badge-status-gray";

    row.innerHTML = `
      <td>${item.date}</td>
      <td><strong>${item.time}</strong></td>
      <td>
        <span style="display: flex; align-items: center; gap: 6px;">
          ${item.type === "SOS Button" ? "🚨" : item.type === "Sudden Movement" ? "⚡" : "🧪"}
          ${item.type}
        </span>
      </td>
      <td><code>${item.device}</code></td>
      <td><span class="${badgeClass}">${item.status}</span></td>
      <td>
        <button class="btn-icon" title="View details" onclick="showToast('Alert ID: ${item.id}', 'info')">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });

  if (historyCount) historyCount.innerText = alertHistoryData.length;
}

function addAlertRecord(newRecord) {
  alertHistoryData.unshift({
    id: newRecord.id || Date.now(),
    ...newRecord
  });
  renderAlertHistory();
}

function exportAlerts() {
  const jsonContent = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(alertHistoryData, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", jsonContent);
  downloadAnchor.setAttribute("download", `safeher-alerts-${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast("📥 Alert log exported as JSON", "info");
}

function clearHistoryConfirmation() {
  if (confirm("Are you sure you want to clear the alert log table?")) {
    alertHistoryData.length = 0;
    renderAlertHistory();
    showToast("Alert history cleared", "info");
  }
}

// ==========================================
// 7. NAVIGATION & TABS
// ==========================================

function initNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  const tabPanes = document.querySelectorAll(".tab-pane");
  const sidebar = document.getElementById("sidebar");
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const sidebarCloseBtn = document.getElementById("sidebarCloseBtn");

  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const targetTab = item.getAttribute("data-tab");

      navItems.forEach((nav) => nav.classList.remove("active"));
      item.classList.add("active");

      tabPanes.forEach((pane) => {
        if (pane.id === targetTab) {
          pane.classList.add("active");
        } else {
          pane.classList.remove("active");
        }
      });

      if (sidebar) sidebar.classList.remove("open");
    });
  });

  if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener("click", () => sidebar.classList.add("open"));
  }
  if (sidebarCloseBtn && sidebar) {
    sidebarCloseBtn.addEventListener("click", () => sidebar.classList.remove("open"));
  }
}

// ==========================================
// 8. TOAST NOTIFICATIONS & AUDIO
// ==========================================

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button class="btn-icon" style="color: #fff; padding: 0;" onclick="this.parentElement.remove()">&times;</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(40px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function playSimulatedBeep() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    // Audio optional
  }
}

// ==========================================
// 9. SETTINGS & UTILITY HELPERS
// ==========================================

function updateSimInterval(val) {
  simIntervalMs = parseInt(val, 10);
  startSensorSimulation();
  showToast(`Sensor update rate set to ${val / 1000}s`, "info");
}

function toggleDeviceOnline(isOnline) {
  hardwareState.deviceStatus = isOnline ? "ONLINE" : "OFFLINE";
  hardwareState.mpuStatus = isOnline ? "CONNECTED" : "DISCONNECTED";
  updateDashboard();

  if (isBackendConnected) {
    fetch(`${BACKEND_URL}/api/device/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: hardwareState.deviceId,
        status: hardwareState.deviceStatus
      })
    }).catch(() => {});
  }

  showToast(`Device status set to ${hardwareState.deviceStatus}`, isOnline ? "success" : "info");
}

function startSystemClock() {
  const clockEl = document.getElementById("currentTimeDisplay");
  if (!clockEl) return;

  function update() {
    clockEl.innerText = formatTimeAMPM(new Date());
  }
  update();
  setInterval(update, 1000);
}

function formatTimeAMPM(date) {
  let hours = date.getHours();
  let minutes = date.getMinutes();
  let seconds = date.getSeconds();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  minutes = minutes < 10 ? "0" + minutes : minutes;
  seconds = seconds < 10 ? "0" + seconds : seconds;
  return `${hours}:${minutes}:${seconds} ${ampm}`;
}

// ==========================================
// 10. MODAL: ADD EMERGENCY CONTACT
// ==========================================

function showAddContactModal() {
  const modal = document.getElementById("contactModal");
  if (modal) modal.classList.add("active");
}

function closeAddContactModal() {
  const modal = document.getElementById("contactModal");
  if (modal) modal.classList.remove("active");
}

function saveNewContact() {
  const name = document.getElementById("newContactName").value.trim();
  const phone = document.getElementById("newContactPhone").value.trim();
  const email = document.getElementById("newContactEmail").value.trim();

  if (!name || !phone) {
    alert("Please enter a contact name and phone number.");
    return;
  }

  const contactsGrid = document.getElementById("contactsGrid");
  if (contactsGrid) {
    const card = document.createElement("div");
    card.className = "card-generic contact-card";
    card.innerHTML = `
      <div class="contact-header">
        <div class="contact-avatar bg-blue-soft">👤</div>
        <div class="contact-meta">
          <h4 class="contact-name">${name}</h4>
          <span class="contact-rel">Custom Emergency Contact</span>
        </div>
      </div>
      <div class="contact-body">
        <div class="contact-info-row">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          <span>${phone}</span>
        </div>
        ${email ? `
        <div class="contact-info-row">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <span>${email}</span>
        </div>` : ''}
      </div>
      <div class="contact-footer">
        <span class="badge-status-green">Ready</span>
        <span class="contact-action-btn" title="Simulate call">📞 Test Dial</span>
      </div>
    `;
    contactsGrid.appendChild(card);
  }

  document.getElementById("newContactName").value = "";
  document.getElementById("newContactPhone").value = "";
  document.getElementById("newContactEmail").value = "";

  closeAddContactModal();
  showToast(`Contact "${name}" added to emergency directory`, "success");
}

// Global window attachments for inline HTML onclick handlers
window.triggerSOS = triggerSOS;
window.resetAlert = resetAlert;
window.simulateSensorsOnce = simulateSensorsOnce;
window.exportAlerts = exportAlerts;
window.clearHistoryConfirmation = clearHistoryConfirmation;
window.showAddContactModal = showAddContactModal;
window.closeAddContactModal = closeAddContactModal;
window.saveNewContact = saveNewContact;
window.updateSimInterval = updateSimInterval;
window.toggleDeviceOnline = toggleDeviceOnline;
window.showToast = showToast;
