/**
 * ==============================================================================
 * SafeHer — Women Safety IoT Dashboard & Emergency Tracking System
 * Frontend Core Logic & Real-time Backend Engine (Version 2.0)
 * 
 * Features:
 * - Real-time Socket.IO communication with Node.js & MongoDB backend
 * - Emergency-Only GPS: Phone browser GPS is strictly requested & transmitted ONLY during SOS
 * - Admin Emergency Command Center & Live Leaflet Map tracking
 * - Dual Route Architecture: /user (Girl Dashboard) & /admin (Emergency Command)
 * - MPU6050 Live Waveform Canvas Graph
 * - Complete removal of battery telemetry
 * ==============================================================================
 */

// ==========================================
// 1. BACKEND & APPLICATION STATE
// ==========================================
const BACKEND_URL = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_BACKEND_URL)
  ? import.meta.env.VITE_BACKEND_URL
  : "http://localhost:5000";
let socket = null;
let isBackendConnected = false;

// Client Routing State ('/user' | '/admin' | '/login')
let currentRoute = "/user";

// ==========================================
// 1.1 AUTHENTICATION & SESSION MANAGEMENT
// ==========================================
const STORAGE_KEY_TOKEN = "safeher_token";
const STORAGE_KEY_USER = "safeher_user";

const authStorage = {
  getToken: () => localStorage.getItem(STORAGE_KEY_TOKEN),
  setToken: (token) => localStorage.setItem(STORAGE_KEY_TOKEN, token),
  getUser: () => {
    try {
      const u = localStorage.getItem(STORAGE_KEY_USER);
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },
  setUser: (user) => localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user)),
  clear: () => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USER);
  },
  isAuthenticated: () => Boolean(localStorage.getItem(STORAGE_KEY_TOKEN)),
  isAdmin: () => {
    try {
      const u = JSON.parse(localStorage.getItem(STORAGE_KEY_USER) || "{}");
      return u?.role === "ADMIN";
    } catch {
      return false;
    }
  },
};

/**
 * Centralized authenticated fetch wrapper.
 * Automatically injects 'Authorization: Bearer <JWT>' header.
 */
async function authFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = authStorage.getToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, { ...options, headers });

  // If token is expired or unauthorized (401), clear credentials and prompt login
  if (response.status === 401 && authStorage.isAuthenticated()) {
    console.warn("Session expired or invalid token. Redirecting to login...");
    authStorage.clear();
    updateHeaderAuthUI();
    showAuthAlert("Your session has expired. Please sign in again.", "danger");
    navigateToRoute("/login");
  }

  return response;
}

function updateHeaderAuthUI() {
  const userPill = document.getElementById("headerUserPill");
  const btnHeaderLogin = document.getElementById("btnHeaderLogin");
  const userNameEl = document.getElementById("headerUserName");
  const userRoleEl = document.getElementById("headerUserRole");
  const userAvatarEl = document.getElementById("headerUserAvatar");

  const user = authStorage.getUser();
  const isAuth = authStorage.isAuthenticated() && user;

  if (isAuth) {
    if (userPill) userPill.style.display = "flex";
    if (btnHeaderLogin) btnHeaderLogin.style.display = "none";
    if (userNameEl) userNameEl.innerText = user.name || user.username || "User";
    if (userRoleEl) {
      userRoleEl.innerText = user.role || "USER";
      userRoleEl.className = `badge-role user-role-badge ${user.role === "ADMIN" ? "role-admin" : "role-user"}`;
    }
    if (userAvatarEl) {
      const initial = (user.name || user.username || "U").charAt(0).toUpperCase();
      userAvatarEl.innerText = initial;
    }
  } else {
    if (userPill) userPill.style.display = "none";
    if (btnHeaderLogin) btnHeaderLogin.style.display = "inline-flex";
  }
}

function switchAuthTab(tab) {
  const tabBtnLogin = document.getElementById("tabBtnLogin");
  const tabBtnRegister = document.getElementById("tabBtnRegister");
  const formLogin = document.getElementById("formLogin");
  const formRegister = document.getElementById("formRegister");
  const authTitle = document.getElementById("authTitle");
  const authSubtitle = document.getElementById("authSubtitle");

  hideAuthAlert();

  if (tab === "register") {
    if (tabBtnLogin) tabBtnLogin.classList.remove("active");
    if (tabBtnRegister) tabBtnRegister.classList.add("active");
    if (formLogin) formLogin.classList.remove("active");
    if (formRegister) formRegister.classList.add("active");
    if (authTitle) authTitle.innerText = "Create SafeHer Account";
    if (authSubtitle) authSubtitle.innerText = "Register your device profile for safety tracking";
  } else {
    if (tabBtnRegister) tabBtnRegister.classList.remove("active");
    if (tabBtnLogin) tabBtnLogin.classList.add("active");
    if (formRegister) formRegister.classList.remove("active");
    if (formLogin) formLogin.classList.add("active");
    if (authTitle) authTitle.innerText = "Sign in to SafeHer";
    if (authSubtitle) authSubtitle.innerText = "Access IoT telemetry, emergency controls & monitoring";
  }
}

function showAuthAlert(message, type = "danger") {
  const alertBox = document.getElementById("authAlertBox");
  const alertMessage = document.getElementById("authAlertMessage");
  const alertIcon = document.getElementById("authAlertIcon");
  if (!alertBox || !alertMessage) return;

  alertBox.className = `auth-alert-banner ${type}`;
  alertMessage.innerText = message;
  if (alertIcon) {
    alertIcon.innerText = type === "success" ? "✅" : "⚠️";
  }
}

function hideAuthAlert() {
  const alertBox = document.getElementById("authAlertBox");
  if (alertBox) alertBox.className = "auth-alert-banner";
}

async function handleLoginSubmit(event) {
  if (event) event.preventDefault();
  hideAuthAlert();

  const usernameInput = document.getElementById("loginUsername");
  const passwordInput = document.getElementById("loginPassword");
  const submitBtn = document.getElementById("btnLoginSubmit");

  const username = usernameInput ? usernameInput.value.trim() : "";
  const password = passwordInput ? passwordInput.value : "";

  if (!username || !password) {
    showAuthAlert("Please enter both username and password.", "danger");
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Signing in...</span>`;
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      showAuthAlert(data.message || "Invalid username or password.", "danger");
      return;
    }

    // Save JWT token & safe user profile
    authStorage.setToken(data.token);
    authStorage.setUser(data.user);
    updateHeaderAuthUI();
    showToast(`Welcome, ${data.user.name || data.user.username}!`, "success");

    // Clear password input
    if (passwordInput) passwordInput.value = "";

    // Route based on role
    if (data.user.role === "ADMIN") {
      navigateToRoute("/admin");
    } else {
      navigateToRoute("/user");
    }
  } catch (err) {
    showAuthAlert("Network/server error connecting to SafeHer backend. Ensure backend is running.", "danger");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
        <span>Login to SafeHer</span>
      `;
    }
  }
}

async function handleRegisterSubmit(event) {
  if (event) event.preventDefault();
  hideAuthAlert();

  const nameInput = document.getElementById("registerName");
  const usernameInput = document.getElementById("registerUsername");
  const emailInput = document.getElementById("registerEmail");
  const passwordInput = document.getElementById("registerPassword");
  const confirmPasswordInput = document.getElementById("registerConfirmPassword");
  const submitBtn = document.getElementById("btnRegisterSubmit");

  const name = nameInput ? nameInput.value.trim() : "";
  const username = usernameInput ? usernameInput.value.trim() : "";
  const email = emailInput ? emailInput.value.trim() : "";
  const password = passwordInput ? passwordInput.value : "";
  const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : "";

  // 1. Required fields
  if (!name || !username || !email || !password || !confirmPassword) {
    showAuthAlert("All fields are required.", "danger");
    return;
  }

  // 2. Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showAuthAlert("Please provide a valid email address.", "danger");
    return;
  }

  // 3. Username length
  if (username.length < 3) {
    showAuthAlert("Username must be at least 3 characters long.", "danger");
    return;
  }

  // 4. Password length
  if (password.length < 6) {
    showAuthAlert("Password must be at least 6 characters long.", "danger");
    return;
  }

  // 5. Passwords match
  if (password !== confirmPassword) {
    showAuthAlert("Passwords do not match.", "danger");
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Creating Account...</span>`;
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, email, password }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      showAuthAlert(data.message || "Registration failed. Please check your inputs.", "danger");
      return;
    }

    // Success: switch to login tab and prefill username
    switchAuthTab("login");
    const loginUsernameInput = document.getElementById("loginUsername");
    if (loginUsernameInput) loginUsernameInput.value = username;

    // Reset register form inputs
    if (nameInput) nameInput.value = "";
    if (usernameInput) usernameInput.value = "";
    if (emailInput) emailInput.value = "";
    if (passwordInput) passwordInput.value = "";
    if (confirmPasswordInput) confirmPasswordInput.value = "";

    showAuthAlert("Account created successfully! Please sign in with your password.", "success");
    showToast("Account created! Please sign in.", "success");
  } catch (err) {
    showAuthAlert("Network/server error. Could not connect to SafeHer backend.", "danger");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
        <span>Create Account</span>
      `;
    }
  }
}

function handleLogout() {
  const user = authStorage.getUser();
  authStorage.clear();
  updateHeaderAuthUI();
  showToast(`Signed out of ${user?.name || "SafeHer"}.`, "info");
  navigateToRoute("/login");
  showAuthAlert("You have logged out successfully.", "success");
}

// Global Hardware State (Synced with MongoDB Device Model)
const hardwareState = {
  deviceId: "SAFEHER-001",
  deviceName: "SafeHer Band",
  deviceStatus: "ONLINE",     // 'ONLINE' | 'OFFLINE' (ESP8266)
  safetyStatus: "SAFE",       // 'SAFE' | 'EMERGENCY'
  sosButton: "READY",         // 'READY' | 'ACTIVATED'
  motionStatus: "NORMAL",     // 'NORMAL' | 'MOTION DETECTED'
  mpuStatus: "CONNECTED",     // 'CONNECTED' | 'DISCONNECTED'
  buzzer: "OFF",              // 'OFF' | 'ON'
  rgbLed: "GREEN",            // 'GREEN' | 'RED'
  lastPingTime: new Date(),
  alertsCountToday: 3,
  
  // 6-Axis Motion Sensor Data
  accel: { x: 0.24, y: 0.91, z: 9.72 },
  gyro: { x: 1.20, y: 0.85, z: 2.10 }
};

// Emergency GPS Lifecycle State
let geoWatchId = null;
let currentEmergencyLocation = null;
let gpsState = "INACTIVE"; // 'INACTIVE' | 'REQUESTING_PERMISSION' | 'ACTIVE' | 'DENIED' | 'UNAVAILABLE' | 'STOPPED'
let emergencyStartTime = null;
let activeIncidentId = "INC-STANDBY";

// Admin Leaflet Map State
let adminMap = null;
let adminMarker = null;
let adminAccuracyCircle = null;

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
  console.log("SafeHer Web App initialized (Architecture v2.0 - Emergency GPS Only)");

  // Setup client routing (/user vs /admin)
  initRouter();

  // Setup tab navigation
  initNavigation();

  // Setup real-time system clock
  startSystemClock();

  // Render initial alert history
  renderAlertHistory();

  // Render initial dashboard values
  updateDashboard();

  // Initialize GPS UI in default inactive privacy state (NEVER request GPS on load)
  updateUserGPSUI("INACTIVE", "Location sharing inactive");
  clearAdminLocationDisplay();

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
        hardwareState.sosButton = (device.sosButton === "ACTIVE" || device.sosButton === "ACTIVATED") ? "ACTIVATED" : "READY";
        if (device.motionStatus) {
          hardwareState.motionStatus = device.motionStatus;
        } else if (device.safetyStatus === "EMERGENCY") {
          hardwareState.motionStatus = "MOTION DETECTED";
        }
        hardwareState.buzzer = device.buzzer || hardwareState.buzzer;
        hardwareState.rgbLed = device.rgbLed || hardwareState.rgbLed;
        hardwareState.lastPingTime = new Date();

        // If backend state says EMERGENCY, start browser emergency GPS
        if (hardwareState.safetyStatus === "EMERGENCY" && geoWatchId === null) {
          startEmergencyGPS();
        } else if (hardwareState.safetyStatus === "SAFE" && geoWatchId !== null) {
          stopEmergencyGPS();
        }

        updateDashboard();
      }
    });

    // --- REAL-TIME EVENT: SENSOR TELEMETRY & MOTION DETECTION ---
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

        // Determine real-time motion detection from sensor acceleration deviation or flag
        const totalAccel = Math.sqrt(ax * ax + ay * ay + az * az);
        const isSignificantMotion = Math.abs(totalAccel - 9.81) > 2.2 || Math.abs(gx) > 4.0 || Math.abs(gy) > 4.0 || Math.abs(gz) > 4.0;
        
        if (data.motionStatus) {
          hardwareState.motionStatus = data.motionStatus;
        } else if (data.motionDetected !== undefined) {
          hardwareState.motionStatus = data.motionDetected ? "MOTION DETECTED" : "NORMAL";
        } else if (isSignificantMotion || hardwareState.safetyStatus === "EMERGENCY") {
          hardwareState.motionStatus = "MOTION DETECTED";
        } else {
          hardwareState.motionStatus = "NORMAL";
        }

        // Push live values to waveform history
        waveHistory.x.shift();
        waveHistory.x.push(ax);
        waveHistory.y.shift();
        waveHistory.y.push(ay);
        waveHistory.z.shift();
        waveHistory.z.push(az);

        updateSensorDisplay();
        updateDashboard();
      }
    });

    // --- REAL-TIME EVENT: EMERGENCY SOS ALERT BROADCAST ---
    socket.on("sosAlert", (payload) => {
      console.log("🚨 Emergency SOS Alert received from backend:", payload);
      hardwareState.safetyStatus = "EMERGENCY";
      hardwareState.sosButton = "ACTIVATED";
      hardwareState.motionStatus = "MOTION DETECTED";
      hardwareState.buzzer = "ON";
      hardwareState.rgbLed = "RED";
      hardwareState.alertsCountToday += 1;
      hardwareState.lastPingTime = new Date();
      emergencyStartTime = new Date();

      if (payload && payload.alert) {
        const alert = payload.alert;
        activeIncidentId = alert._id ? `INC-${String(alert._id).slice(-6).toUpperCase()}` : `INC-${Math.floor(100000 + Math.random() * 900000)}`;
        addAlertRecord({
          id: alert._id || Date.now(),
          date: (alert.timestamp ? new Date(alert.timestamp) : new Date()).toISOString().split("T")[0],
          time: formatTimeAMPM(alert.timestamp ? new Date(alert.timestamp) : new Date()),
          type: alert.type || "SOS Button",
          device: alert.deviceId || hardwareState.deviceId,
          status: "Active Alert",
          statusType: "danger"
        });
      } else {
        activeIncidentId = `INC-${Math.floor(100000 + Math.random() * 900000)}`;
      }

      // Start Browser Geolocation ONLY on emergency trigger
      startEmergencyGPS();

      updateDashboard();
      playSimulatedBeep();
      showToast("🚨 EMERGENCY SOS BROADCAST RECEIVED! Device in alarm state.", "danger");
    });

    // --- REAL-TIME EVENT: ALERT RESOLVED / RESET ---
    socket.on("alertResolved", (payload) => {
      console.log("✅ Alert Resolved event received:", payload);
      hardwareState.safetyStatus = "SAFE";
      hardwareState.sosButton = "READY";
      hardwareState.motionStatus = "NORMAL";
      hardwareState.buzzer = "OFF";
      hardwareState.rgbLed = "GREEN";
      hardwareState.lastPingTime = new Date();

      // Stop Geolocation tracking immediately
      stopEmergencyGPS();

      updateDashboard();
      showToast("✅ System Reset: Device returned to SAFE state.", "success");
    });

    // --- REAL-TIME EVENT: LIVE EMERGENCY LOCATION UPDATES (For Admin) ---
    socket.on("locationUpdate", (locData) => {
      console.log("📍 Live Location Update received via Socket.IO:", locData);
      if (locData) {
        currentEmergencyLocation = locData;
        updateAdminLocationDisplay(locData);
      }
    });

    socket.on("liveLocation", (locData) => {
      if (locData) {
        currentEmergencyLocation = locData;
        updateAdminLocationDisplay(locData);
      }
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
        hardwareState.deviceStatus = d.status || hardwareState.deviceStatus;
        hardwareState.safetyStatus = d.safetyStatus || hardwareState.safetyStatus;
        hardwareState.sosButton = (d.sosButton === "ACTIVE" || d.sosButton === "ACTIVATED") ? "ACTIVATED" : "READY";
        if (d.motionStatus) {
          hardwareState.motionStatus = d.motionStatus;
        } else if (d.safetyStatus === "EMERGENCY") {
          hardwareState.motionStatus = "MOTION DETECTED";
        }
        hardwareState.buzzer = d.buzzer || hardwareState.buzzer;
        hardwareState.rgbLed = d.rgbLed || hardwareState.rgbLed;

        if (hardwareState.safetyStatus === "EMERGENCY" && geoWatchId === null) {
          startEmergencyGPS();
        }

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
 * Calls backend POST /api/alerts/sos and activates browser emergency GPS.
 */
async function triggerSOS() {
  console.log("🚨 triggerSOS invoked");

  // Immediate optimistic UI update
  hardwareState.safetyStatus = "EMERGENCY";
  hardwareState.sosButton = "ACTIVATED";
  hardwareState.motionStatus = "MOTION DETECTED";
  hardwareState.buzzer = "ON";
  hardwareState.rgbLed = "RED";
  hardwareState.alertsCountToday += 1;
  hardwareState.lastPingTime = new Date();
  emergencyStartTime = new Date();
  activeIncidentId = `INC-${Math.floor(100000 + Math.random() * 900000)}`;

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

  // Start Browser Geolocation ONLY on emergency trigger
  startEmergencyGPS();

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
      if (data?.alert?._id) {
        activeIncidentId = `INC-${String(data.alert._id).slice(-6).toUpperCase()}`;
        updateDashboard();
      }
    } catch (err) {
      console.warn("Could not send SOS to backend API:", err.message);
    }
  }
}

/**
 * Resets system back to SAFE status.
 * Calls backend POST /api/device/reset and halts GPS tracking.
 */
async function resetAlert() {
  console.log("✅ resetAlert invoked");

  hardwareState.safetyStatus = "SAFE";
  hardwareState.sosButton = "READY";
  hardwareState.motionStatus = "NORMAL";
  hardwareState.buzzer = "OFF";
  hardwareState.rgbLed = "GREEN";
  hardwareState.lastPingTime = new Date();

  // Stop Geolocation tracking immediately
  stopEmergencyGPS();

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
    motionStatus: hardwareState.motionStatus,
    sosButton: hardwareState.sosButton,
    isMpuConnected: hardwareState.mpuStatus === "CONNECTED"
  };
}

/**
 * Generates local simulated MPU6050 reading when real ESP stream is idle
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

// ==========================================
// 5. EMERGENCY-ONLY GPS IMPLEMENTATION
// ==========================================

/**
 * Starts browser geolocation tracking ONLY during an active emergency.
 * Strictly adheres to privacy protocol: never runs during normal state.
 */
function startEmergencyGPS() {
  if (hardwareState.safetyStatus !== "EMERGENCY") {
    console.log("🔒 Privacy rule: GPS cannot be started while safety status is SAFE.");
    return;
  }

  if (geoWatchId !== null) {
    console.log("GPS watchPosition already active (id=" + geoWatchId + ")");
    return;
  }

  if (!navigator.geolocation) {
    console.warn("Geolocation API is not supported by this browser.");
    gpsState = "UNAVAILABLE";
    updateUserGPSUI("UNAVAILABLE", "Geolocation not supported by browser");
    return;
  }

  console.log("🚨 SOS Active: Requesting browser location permission and starting watchPosition...");
  gpsState = "REQUESTING_PERMISSION";
  updateUserGPSUI("REQUESTING_PERMISSION", "Requesting location permission...");

  const geoOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0
  };

  try {
    geoWatchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const timestamp = new Date(position.timestamp || Date.now()).toISOString();

        currentEmergencyLocation = {
          deviceId: hardwareState.deviceId,
          latitude,
          longitude,
          accuracy,
          timestamp,
          incidentId: activeIncidentId
        };

        gpsState = "ACTIVE";
        updateUserGPSUI("ACTIVE", "Live location sharing active", accuracy);
        updateAdminLocationDisplay(currentEmergencyLocation);

        // Transmit live coordinates to backend API
        sendLocationUpdateToBackend(currentEmergencyLocation);
      },
      (error) => {
        console.warn("Geolocation error:", error.code, error.message);
        if (error.code === error.PERMISSION_DENIED) {
          gpsState = "DENIED";
          updateUserGPSUI("DENIED", "Location permission denied. Please allow location access to share your live location during this emergency.");
        } else {
          gpsState = "UNAVAILABLE";
          updateUserGPSUI("UNAVAILABLE", "Location unavailable");
        }
      },
      geoOptions
    );
  } catch (err) {
    console.error("Failed to invoke watchPosition:", err);
    gpsState = "UNAVAILABLE";
    updateUserGPSUI("UNAVAILABLE", "Location unavailable");
  }
}

/**
 * Stops browser geolocation tracking immediately when emergency ends/resets.
 */
function stopEmergencyGPS() {
  if (geoWatchId !== null) {
    console.log("🛑 Emergency resolved: clearing GPS watchPosition (id=" + geoWatchId + ")");
    navigator.geolocation.clearWatch(geoWatchId);
    geoWatchId = null;
  }

  gpsState = "STOPPED";
  currentEmergencyLocation = null;
  emergencyStartTime = null;

  updateUserGPSUI("STOPPED", "Location sharing stopped");
  clearAdminLocationDisplay();

  // Return to inactive state after brief transition
  setTimeout(() => {
    if (hardwareState.safetyStatus === "SAFE") {
      gpsState = "INACTIVE";
      updateUserGPSUI("INACTIVE", "Location sharing inactive");
    }
  }, 2500);
}

/**
 * Transmits real emergency browser location to backend.
 */
async function sendLocationUpdateToBackend(locData) {
  if (!isBackendConnected && !BACKEND_URL) return;

  try {
    const res = await fetch(`${BACKEND_URL}/api/location/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(locData)
    });
    const result = await res.json();
    console.log("📡 Location update transmitted to backend:", result);
  } catch (err) {
    console.warn("Could not transmit location update:", err.message);
  }
}

/**
 * Updates GPS status widget in Girl / User dashboard
 */
function updateUserGPSUI(state, message, accuracy) {
  const dot = document.getElementById("userGpsDot");
  const text = document.getElementById("userGpsStatusText");
  const sub = document.getElementById("userGpsSubText");
  const badge = document.getElementById("userGpsBadge");
  const deniedAlert = document.getElementById("userGpsDeniedAlert");

  if (!text) return;

  if (state === "INACTIVE") {
    text.innerText = "Location sharing inactive";
    text.className = "card-main-val text-muted";
    if (dot) dot.className = "status-indicator status-gray";
    if (sub) sub.innerText = "Normal state: GPS disabled for privacy";
    if (badge) {
      badge.innerText = "Standby";
      badge.className = "badge-subtle";
    }
    if (deniedAlert) deniedAlert.style.display = "none";
  } else if (state === "REQUESTING_PERMISSION") {
    text.innerText = "Requesting location permission...";
    text.className = "card-main-val text-yellow";
    if (dot) dot.className = "status-indicator status-yellow";
    if (sub) sub.innerText = "Awaiting browser location approval";
    if (badge) {
      badge.innerText = "Requesting...";
      badge.className = "badge-subtle";
    }
    if (deniedAlert) deniedAlert.style.display = "none";
  } else if (state === "ACTIVE") {
    text.innerText = "Live location sharing active";
    text.className = "card-main-val text-red";
    if (dot) dot.className = "status-indicator status-red";
    if (sub) sub.innerText = accuracy ? `Streaming live coordinates (±${accuracy.toFixed(1)}m)` : "Streaming live coordinates to Admin";
    if (badge) {
      badge.innerText = "🔴 TRANSMITTING";
      badge.className = "badge-status-red";
    }
    if (deniedAlert) deniedAlert.style.display = "none";
  } else if (state === "DENIED") {
    text.innerText = "Location permission denied";
    text.className = "card-main-val text-red";
    if (dot) dot.className = "status-indicator status-red";
    if (sub) sub.innerText = "Permission required to share location during emergency";
    if (badge) {
      badge.innerText = "DENIED";
      badge.className = "badge-status-red";
    }
    if (deniedAlert) deniedAlert.style.display = "flex";
  } else if (state === "UNAVAILABLE") {
    text.innerText = "Location unavailable";
    text.className = "card-main-val text-yellow";
    if (dot) dot.className = "status-indicator status-yellow";
    if (sub) sub.innerText = message || "Location signal unavailable";
    if (badge) {
      badge.innerText = "UNAVAILABLE";
      badge.className = "badge-subtle";
    }
    if (deniedAlert) deniedAlert.style.display = "none";
  } else if (state === "STOPPED") {
    text.innerText = "Location sharing stopped";
    text.className = "card-main-val text-muted";
    if (dot) dot.className = "status-indicator status-gray";
    if (sub) sub.innerText = "Emergency resolved • Tracking halted";
    if (badge) {
      badge.innerText = "Stopped";
      badge.className = "badge-subtle";
    }
    if (deniedAlert) deniedAlert.style.display = "none";
  }
}

// ==========================================
// 6. ADMIN DASHBOARD & LEAFLET MAP
// ==========================================

function initAdminMap() {
  const mapEl = document.getElementById("adminMap");
  if (!mapEl || typeof L === "undefined") return;

  if (!adminMap) {
    try {
      // Default to Jaipur / central India view
      adminMap = L.map("adminMap", {
        zoomControl: true,
        attributionControl: false
      }).setView([26.8437, 75.5654], 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19
      }).addTo(adminMap);
    } catch (err) {
      console.warn("Leaflet map init error:", err);
    }
  }
}

function updateAdminLocationDisplay(loc) {
  if (!loc) return;

  const lat = loc.latitude !== undefined ? Number(loc.latitude) : null;
  const lng = loc.longitude !== undefined ? Number(loc.longitude) : null;
  const acc = loc.accuracy !== undefined ? Number(loc.accuracy) : null;

  if (lat === null || lng === null) return;

  // Update Admin coordinate readout panel
  const panelLat = document.getElementById("adminPanelLat");
  const panelLng = document.getElementById("adminPanelLng");
  const panelAcc = document.getElementById("adminPanelAcc");
  const panelTime = document.getElementById("adminPanelTime");

  if (panelLat) panelLat.innerText = lat.toFixed(6) + "°";
  if (panelLng) panelLng.innerText = lng.toFixed(6) + "°";
  if (panelAcc) panelAcc.innerText = acc ? `±${acc.toFixed(1)} m` : "N/A";
  if (panelTime) panelTime.innerText = formatTimeAMPM(loc.timestamp ? new Date(loc.timestamp) : new Date());

  // Update Admin Metric Cards
  const adminGpsVal = document.getElementById("adminGpsVal");
  const adminGpsDot = document.getElementById("adminGpsDot");
  const adminGpsSub = document.getElementById("adminGpsSub");
  const adminAccuracyVal = document.getElementById("adminAccuracyVal");
  const adminLastUpdateVal = document.getElementById("adminLastUpdateVal");

  if (adminGpsVal) {
    adminGpsVal.innerText = "LIVE";
    adminGpsVal.className = "text-red";
  }
  if (adminGpsDot) adminGpsDot.className = "status-indicator status-red";
  if (adminGpsSub) adminGpsSub.innerText = "Live coordinates from phone browser";
  if (adminAccuracyVal) {
    adminAccuracyVal.innerText = acc ? `±${acc.toFixed(1)} m` : "High Accuracy";
    adminAccuracyVal.className = "text-green";
  }
  if (adminLastUpdateVal) {
    adminLastUpdateVal.innerText = formatTimeAMPM(loc.timestamp ? new Date(loc.timestamp) : new Date());
  }

  // Update Leaflet Map
  if (typeof L !== "undefined" && adminMap) {
    const standbyOverlay = document.getElementById("adminMapStandbyOverlay");
    if (standbyOverlay) standbyOverlay.classList.add("hidden");

    const liveBadge = document.getElementById("adminMapLiveBadge");
    const standbyBadge = document.getElementById("adminMapStandbyBadge");
    if (liveBadge) liveBadge.style.display = "inline-flex";
    if (standbyBadge) standbyBadge.style.display = "none";

    const customIcon = L.divIcon({
      className: "emergency-leaflet-marker",
      html: '<div class="pulse-marker-ring"></div><div class="pulse-marker-core">📍</div>',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    if (adminMarker) {
      adminMarker.setLatLng([lat, lng]);
    } else {
      adminMarker = L.marker([lat, lng], { icon: customIcon }).addTo(adminMap);
      adminMarker.bindPopup(`<b>🚨 EMERGENCY SOS ACTIVE</b><br>Device: ${loc.deviceId || 'SAFEHER-001'}<br>Accuracy: ±${acc ? acc.toFixed(1) : 0}m`).openPopup();
    }

    if (acc) {
      if (adminAccuracyCircle) {
        adminAccuracyCircle.setLatLng([lat, lng]);
        adminAccuracyCircle.setRadius(acc);
      } else {
        adminAccuracyCircle = L.circle([lat, lng], {
          radius: acc,
          color: "#ef476f",
          fillColor: "#ef476f",
          fillOpacity: 0.15,
          weight: 1.5
        }).addTo(adminMap);
      }
    }

    adminMap.setView([lat, lng], 16);
    adminMap.invalidateSize();
  }
}

function clearAdminLocationDisplay() {
  const panelLat = document.getElementById("adminPanelLat");
  const panelLng = document.getElementById("adminPanelLng");
  const panelAcc = document.getElementById("adminPanelAcc");
  const panelTime = document.getElementById("adminPanelTime");

  if (panelLat) panelLat.innerText = "--";
  if (panelLng) panelLng.innerText = "--";
  if (panelAcc) panelAcc.innerText = "--";
  if (panelTime) panelTime.innerText = "--";

  const adminGpsVal = document.getElementById("adminGpsVal");
  const adminGpsDot = document.getElementById("adminGpsDot");
  const adminGpsSub = document.getElementById("adminGpsSub");
  const adminAccuracyVal = document.getElementById("adminAccuracyVal");

  if (adminGpsVal) {
    adminGpsVal.innerText = "Not being shared";
    adminGpsVal.className = "text-muted";
  }
  if (adminGpsDot) adminGpsDot.className = "status-indicator status-gray";
  if (adminGpsSub) adminGpsSub.innerText = "Privacy protected in SAFE mode";
  if (adminAccuracyVal) {
    adminAccuracyVal.innerText = "--";
    adminAccuracyVal.className = "text-muted";
  }

  // Restore map standby
  const standbyOverlay = document.getElementById("adminMapStandbyOverlay");
  if (standbyOverlay) standbyOverlay.classList.remove("hidden");

  const liveBadge = document.getElementById("adminMapLiveBadge");
  const standbyBadge = document.getElementById("adminMapStandbyBadge");
  if (liveBadge) liveBadge.style.display = "none";
  if (standbyBadge) standbyBadge.style.display = "inline-flex";

  if (adminMarker && adminMap) {
    adminMap.removeLayer(adminMarker);
    adminMarker = null;
  }
  if (adminAccuracyCircle && adminMap) {
    adminMap.removeLayer(adminAccuracyCircle);
    adminAccuracyCircle = null;
  }
}

// ==========================================
// 7. CLIENT ROUTING (/user vs /admin)
// ==========================================

function initRouter() {
  function handleRoute() {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();

    if (path.includes("/admin") || hash === "#admin") {
      switchView("/admin");
    } else if (path.includes("/login") || path.includes("/auth") || hash === "#login" || hash === "#auth") {
      switchView("/login");
    } else {
      switchView("/user");
    }
  }

  window.addEventListener("popstate", handleRoute);
  window.addEventListener("hashchange", handleRoute);
  handleRoute();
}

function navigateToRoute(route) {
  if (window.location.protocol === "http:" || window.location.protocol === "https:") {
    try {
      history.pushState(null, "", route);
    } catch (e) {
      window.location.hash = route.replace("/", "");
    }
  } else {
    window.location.hash = route.replace("/", "");
  }
  switchView(route);
}

function switchView(route) {
  const isAuth = authStorage.isAuthenticated();
  const currentUser = authStorage.getUser();

  // Route Protection & Role Guard
  if (route === "/user") {
    if (!isAuth) {
      route = "/login";
      showAuthAlert("Please sign in to access your SafeHer device dashboard.", "danger");
    }
  } else if (route === "/admin") {
    if (!isAuth) {
      route = "/login";
      showAuthAlert("Administrator credentials required to access Emergency Command Center.", "danger");
    } else if (currentUser?.role !== "ADMIN") {
      showToast("Access Denied: Admin privileges required.", "danger");
      route = "/user";
    }
  }

  currentRoute = route === "/admin" ? "/admin" : (route === "/login" ? "/login" : "/user");

  const viewUser = document.getElementById("viewUser");
  const viewAdmin = document.getElementById("viewAdmin");
  const viewAuth = document.getElementById("viewAuth");
  const btnUser = document.getElementById("btnRouteUser");
  const btnAdmin = document.getElementById("btnRouteAdmin");
  const headerAdminBadge = document.getElementById("headerAdminBadge");

  // Keep header auth status synchronized
  updateHeaderAuthUI();

  if (currentRoute === "/login") {
    if (viewUser) viewUser.classList.remove("active");
    if (viewAdmin) viewAdmin.classList.remove("active");
    if (viewAuth) viewAuth.classList.add("active");
    if (btnUser) btnUser.classList.remove("active");
    if (btnAdmin) btnAdmin.classList.remove("active");
  } else if (currentRoute === "/admin") {
    if (viewAuth) viewAuth.classList.remove("active");
    if (viewUser) viewUser.classList.remove("active");
    if (viewAdmin) viewAdmin.classList.add("active");
    if (btnUser) btnUser.classList.remove("active");
    if (btnAdmin) btnAdmin.classList.add("active");

    // Initialize Leaflet map and force layout recalculation
    initAdminMap();
    setTimeout(() => {
      if (adminMap) adminMap.invalidateSize();
    }, 120);
  } else {
    // /user view
    if (viewAuth) viewAuth.classList.remove("active");
    if (viewAdmin) viewAdmin.classList.remove("active");
    if (viewUser) viewUser.classList.add("active");
    if (btnAdmin) btnAdmin.classList.remove("active");
    if (btnUser) btnUser.classList.add("active");
  }

  if (headerAdminBadge) {
    headerAdminBadge.innerText = hardwareState.safetyStatus === "EMERGENCY" ? "EMERGENCY" : "MONITOR";
  }
}

// ==========================================
// 8. GLOBAL UI SYNCHRONIZER
// ==========================================

function updateDashboard() {
  const isEmergency = hardwareState.safetyStatus === "EMERGENCY";
  const isOnline = hardwareState.deviceStatus === "ONLINE";

  // 1. Device Status Card (ESP8266 Connection)
  const deviceStatusText = document.getElementById("deviceStatusText");
  const deviceStatusDot = document.getElementById("deviceStatusDot");
  const deviceWifiBadge = document.getElementById("deviceWifiBadge");
  if (deviceStatusText && deviceStatusDot) {
    deviceStatusText.innerText = hardwareState.deviceStatus;
    if (isOnline) {
      deviceStatusText.className = "card-main-val text-green";
      deviceStatusDot.className = "status-indicator status-green";
      if (deviceWifiBadge) deviceWifiBadge.innerText = "Connected";
    } else {
      deviceStatusText.className = "card-main-val text-muted";
      deviceStatusDot.className = "status-indicator status-gray";
      if (deviceWifiBadge) deviceWifiBadge.innerText = "Disconnected";
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
  const sosSubBadge = document.getElementById("sosSubBadge");
  const navSosBadge = document.getElementById("navSosBadge");
  const hwSosBadge = document.getElementById("hwSosBadge");
  const isSosActivated = isEmergency || hardwareState.sosButton === "ACTIVATED" || hardwareState.sosButton === "ACTIVE";

  if (sosStatusText) {
    if (isSosActivated) {
      sosStatusText.innerText = "SOS BUTTON — ACTIVATED";
      sosStatusText.className = "card-main-val text-red";
      if (sosStatusDot) sosStatusDot.className = "status-indicator status-red";
      if (sosSubBadge) sosSubBadge.innerText = "Arm State: Triggered";
      if (navSosBadge) {
        navSosBadge.innerText = "ACTIVATED";
        navSosBadge.className = "badge-pill badge-sos-nav emergency";
      }
      if (hwSosBadge) {
        hwSosBadge.innerText = "ACTIVATED";
        hwSosBadge.className = "badge-status-red";
      }
    } else {
      sosStatusText.innerText = "SOS BUTTON — READY";
      sosStatusText.className = "card-main-val text-green";
      if (sosStatusDot) sosStatusDot.className = "status-indicator status-green";
      if (sosSubBadge) sosSubBadge.innerText = "Arm State: Active";
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

  // 7. Motion Detection Status (Replaces Battery & Power)
  const motionStatusText = document.getElementById("motionStatusText");
  const motionStatusDot = document.getElementById("motionStatusDot");
  const motionActivitySub = document.getElementById("motionActivitySub");
  const motionSensorBadge = document.getElementById("motionSensorBadge");
  const isMotion = hardwareState.motionStatus === "MOTION DETECTED" || isEmergency;

  if (motionStatusText) {
    if (isMotion) {
      motionStatusText.innerText = "MOTION DETECTED";
      motionStatusText.className = "card-main-val text-red";
      if (motionStatusDot) motionStatusDot.className = "status-indicator status-red";
      if (motionActivitySub) motionActivitySub.innerText = "Motion detected";
      if (motionSensorBadge) {
        motionSensorBadge.innerText = "Motion Alert";
        motionSensorBadge.className = "badge-subtle";
      }
    } else {
      motionStatusText.innerText = "NORMAL";
      motionStatusText.className = "card-main-val text-green";
      if (motionStatusDot) motionStatusDot.className = "status-indicator status-green";
      if (motionActivitySub) motionActivitySub.innerText = "No motion detected";
      if (motionSensorBadge) {
        motionSensorBadge.innerText = "Active Monitor";
        motionSensorBadge.className = "badge-subtle";
      }
    }
  }

  // 8. Alerts Count Today
  const alertsTodayCount = document.getElementById("alertsTodayCount");
  if (alertsTodayCount) alertsTodayCount.innerText = hardwareState.alertsCountToday;

  // 9. Emergency Banner & Hero Card (User View)
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
      emergencyHeroDesc.innerText = "SOS signal transmitted to cloud dashboard. Device alarm sounding and live phone GPS streaming.";
      if (sosPulseRing) sosPulseRing.classList.add("emergency");
    } else {
      sosHeroCard.classList.remove("emergency-active");
      emergencyHeroTitle.innerText = "SAFE AND SECURE";
      emergencyHeroTitle.className = "sos-current-status-title";
      emergencyHeroDesc.innerText = "The wearable device is armed and continuously monitoring for panic button presses and abrupt motion.";
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
    telemetrySos.innerText = isSosActivated ? "ACTIVATED" : "READY";
    telemetrySos.className = isEmergency ? "telemetry-val text-red" : "telemetry-val text-green";
  }

  // 10. ADMIN DASHBOARD METRICS & HERO SYNC
  const adminStatusHero = document.getElementById("adminStatusHero");
  const adminHeroIcon = document.getElementById("adminHeroIcon");
  const adminHeroEmoji = document.getElementById("adminHeroEmoji");
  const adminHeroTitle = document.getElementById("adminHeroTitle");
  const adminHeroSub = document.getElementById("adminHeroSub");
  const btnAdminResolve = document.getElementById("btnAdminResolve");
  const headerAdminBadge = document.getElementById("headerAdminBadge");

  const adminSosDot = document.getElementById("adminSosDot");
  const adminSosVal = document.getElementById("adminSosVal");
  const adminSosSub = document.getElementById("adminSosSub");

  const adminDeviceDot = document.getElementById("adminDeviceDot");
  const adminDeviceVal = document.getElementById("adminDeviceVal");
  const adminDeviceSub = document.getElementById("adminDeviceSub");

  const adminMotionDot = document.getElementById("adminMotionDot");
  const adminMotionVal = document.getElementById("adminMotionVal");
  const adminMotionSub = document.getElementById("adminMotionSub");

  const adminBuzzerDot = document.getElementById("adminBuzzerDot");
  const adminBuzzerVal = document.getElementById("adminBuzzerVal");
  const adminBuzzerSub = document.getElementById("adminBuzzerSub");

  const adminIncidentVal = document.getElementById("adminIncidentVal");
  const adminStartTimeVal = document.getElementById("adminStartTimeVal");

  if (adminStatusHero) {
    if (isEmergency) {
      adminStatusHero.className = "admin-status-hero emergency";
      if (adminHeroIcon) adminHeroIcon.className = "admin-hero-icon emergency";
      if (adminHeroEmoji) adminHeroEmoji.innerText = "🔴";
      if (adminHeroTitle) {
        adminHeroTitle.innerText = "🔴 EMERGENCY ACTIVE";
        adminHeroTitle.className = "admin-hero-title emergency";
      }
      if (adminHeroSub) adminHeroSub.innerText = "CRITICAL SOS IN PROGRESS: Real-time telemetry and browser GPS streaming.";
      if (btnAdminResolve) btnAdminResolve.style.display = "inline-flex";
      if (headerAdminBadge) {
        headerAdminBadge.innerText = "EMERGENCY";
        headerAdminBadge.className = "badge-role admin";
      }
    } else {
      adminStatusHero.className = "admin-status-hero normal";
      if (adminHeroIcon) adminHeroIcon.className = "admin-hero-icon normal";
      if (adminHeroEmoji) adminHeroEmoji.innerText = "🟢";
      if (adminHeroTitle) {
        adminHeroTitle.innerText = "🟢 NO ACTIVE EMERGENCY";
        adminHeroTitle.className = "admin-hero-title normal";
      }
      if (adminHeroSub) adminHeroSub.innerText = "SafeHer monitoring system active • Phone GPS sharing is inactive for privacy";
      if (btnAdminResolve) btnAdminResolve.style.display = "none";
      if (headerAdminBadge) {
        headerAdminBadge.innerText = "MONITOR";
        headerAdminBadge.className = "badge-role user";
      }
    }
  }

  if (adminSosVal && adminSosDot) {
    if (isSosActivated) {
      adminSosVal.innerText = "ACTIVATED";
      adminSosVal.className = "text-red";
      adminSosDot.className = "status-indicator status-red";
      if (adminSosSub) adminSosSub.innerText = "SOS Button Triggered";
    } else {
      adminSosVal.innerText = "READY";
      adminSosVal.className = "text-green";
      adminSosDot.className = "status-indicator status-green";
      if (adminSosSub) adminSosSub.innerText = "Tactile Switch Standby";
    }
  }

  if (adminDeviceVal && adminDeviceDot) {
    adminDeviceVal.innerText = hardwareState.deviceStatus;
    adminDeviceVal.className = isOnline ? "text-green" : "text-muted";
    adminDeviceDot.className = isOnline ? "status-indicator status-green" : "status-indicator status-gray";
  }

  if (adminMotionVal && adminMotionDot) {
    if (isMotion) {
      adminMotionVal.innerText = "DETECTED";
      adminMotionVal.className = "text-red";
      adminMotionDot.className = "status-indicator status-red";
      if (adminMotionSub) adminMotionSub.innerText = "Abnormal movement detected";
    } else {
      adminMotionVal.innerText = "NORMAL";
      adminMotionVal.className = "text-green";
      adminMotionDot.className = "status-indicator status-green";
      if (adminMotionSub) adminMotionSub.innerText = "No abnormal motion";
    }
  }

  if (adminBuzzerVal && adminBuzzerDot) {
    adminBuzzerVal.innerText = hardwareState.buzzer;
    adminBuzzerVal.className = hardwareState.buzzer === "ON" ? "text-red" : "text-muted";
    adminBuzzerDot.className = hardwareState.buzzer === "ON" ? "status-indicator status-red" : "status-indicator status-gray";
  }

  if (adminIncidentVal) {
    adminIncidentVal.innerText = isEmergency ? activeIncidentId : "INC-STANDBY";
  }
  if (adminStartTimeVal) {
    adminStartTimeVal.innerText = isEmergency && emergencyStartTime ? formatTimeAMPM(emergencyStartTime) : "--";
  }

  // 11. Update Sensor Values
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
// 9. SENSOR SIMULATION & WAVEFORM CHART
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

  if (hardwareState.safetyStatus === "EMERGENCY") {
    hardwareState.motionStatus = "MOTION DETECTED";
  }

  waveHistory.x.shift();
  waveHistory.x.push(freshData.accel.x);

  waveHistory.y.shift();
  waveHistory.y.push(freshData.accel.y);

  waveHistory.z.shift();
  waveHistory.z.push(freshData.accel.z);

  updateSensorDisplay();
  updateDashboard();
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
// 10. ALERT HISTORY & TABLE RENDERING
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
// 11. NAVIGATION & TABS
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

      // Make sure we are on the user dashboard view when clicking sidebar tabs
      if (currentRoute !== "/user") {
        navigateToRoute("/user");
      }

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
// 12. TOAST NOTIFICATIONS & AUDIO
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
// 13. SETTINGS & UTILITY HELPERS
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
// 14. MODAL: ADD EMERGENCY CONTACT
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
window.navigateToRoute = navigateToRoute;
window.startEmergencyGPS = startEmergencyGPS;
window.stopEmergencyGPS = stopEmergencyGPS;
window.switchAuthTab = switchAuthTab;
window.handleLoginSubmit = handleLoginSubmit;
window.handleRegisterSubmit = handleRegisterSubmit;
window.handleLogout = handleLogout;
window.authStorage = authStorage;
window.authFetch = authFetch;
