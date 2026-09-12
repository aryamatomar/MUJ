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
const STORAGE_KEY_THEME = "safeher_theme";

// ==========================================
// 1.2 THEME MANAGEMENT (Dark / Light Mode)
// ==========================================
function initTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || "dark";
  applyTheme(savedTheme, false);
}

function applyTheme(theme, showFeedback = false) {
  const isLight = theme === "light";
  if (isLight) {
    document.documentElement.setAttribute("data-theme", "light");
    document.body.classList.add("theme-light");
    document.body.classList.remove("theme-dark");
  } else {
    document.documentElement.setAttribute("data-theme", "dark");
    document.body.classList.remove("theme-light");
    document.body.classList.add("theme-dark");
  }

  // Update theme toggle button UI
  const themeToggleLabel = document.getElementById("themeToggleLabel");
  const btnThemeToggle = document.getElementById("btnThemeToggle");
  if (themeToggleLabel) {
    themeToggleLabel.innerText = isLight ? "Light" : "Dark";
  }
  if (btnThemeToggle) {
    btnThemeToggle.setAttribute("aria-label", `Switch to ${isLight ? "Dark" : "Light"} mode`);
    btnThemeToggle.setAttribute("title", `Switch to ${isLight ? "Dark" : "Light"} mode`);
  }

  if (showFeedback && typeof showToast === "function") {
    showToast(`Switched to ${isLight ? "Light" : "Dark"} Theme`, "info");
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme") || (document.body.classList.contains("theme-light") ? "light" : "dark");
  const newTheme = currentTheme === "light" ? "dark" : "light";
  localStorage.setItem(STORAGE_KEY_THEME, newTheme);
  applyTheme(newTheme, true);
}

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

// Track Selected Login Role ('user' | 'admin')
let selectedLoginRole = "user"; // default: 'user'

function selectLoginRole(role) {
  selectedLoginRole = role === "admin" ? "admin" : "user";

  const btnUser = document.getElementById("roleBtnUser");
  const btnAdmin = document.getElementById("roleBtnAdmin");
  const submitText = document.getElementById("loginSubmitBtnText");

  if (selectedLoginRole === "admin") {
    if (btnUser) btnUser.classList.remove("active");
    if (btnAdmin) btnAdmin.classList.add("active");
    if (submitText) submitText.innerText = "Login as Admin";
  } else {
    if (btnAdmin) btnAdmin.classList.remove("active");
    if (btnUser) btnUser.classList.add("active");
    if (submitText) submitText.innerText = "Login as User";
  }
}

// Track Selected Registration Role ('user' | 'admin')
let selectedRegisterRole = "user"; // default: 'user'

function selectRegisterRole(role) {
  selectedRegisterRole = role === "admin" ? "admin" : "user";

  const btnUser = document.getElementById("regRoleBtnUser");
  const btnAdmin = document.getElementById("regRoleBtnAdmin");
  const adminSecretGroup = document.getElementById("regAdminSecretGroup");
  const submitText = document.getElementById("registerSubmitBtnText");

  if (selectedRegisterRole === "admin") {
    if (btnUser) btnUser.classList.remove("active");
    if (btnAdmin) btnAdmin.classList.add("active");
    if (adminSecretGroup) adminSecretGroup.style.display = "block";
    if (submitText) submitText.innerText = "Create Admin Account";
  } else {
    if (btnAdmin) btnAdmin.classList.remove("active");
    if (btnUser) btnUser.classList.add("active");
    if (adminSecretGroup) adminSecretGroup.style.display = "none";
    if (submitText) submitText.innerText = "Create User Account";
  }
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
    submitBtn.innerHTML = `<span>Signing in as ${selectedLoginRole.toUpperCase()}...</span>`;
  }

  try {
    // Submit credentials along with chosen role
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        username, 
        password,
        role: selectedLoginRole 
      }),
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
    showToast(`Welcome back, ${data.user.name || data.user.username}!`, "success");

    // Clear password input
    if (passwordInput) passwordInput.value = "";

    // Sync emergency contacts and device from MongoDB for this authenticated user
    loadEmergencyContactsFromBackend();
    loadMyDeviceFromBackend();

    // Conditional post-login redirection based on selected role / privileges
    if (selectedLoginRole === "admin" || data.user.role === "ADMIN") {
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
  const adminSecretInput = document.getElementById("registerAdminSecret");
  const submitBtn = document.getElementById("btnRegisterSubmit");

  const name = nameInput ? nameInput.value.trim() : "";
  const username = usernameInput ? usernameInput.value.trim() : "";
  const email = emailInput ? emailInput.value.trim() : "";
  const password = passwordInput ? passwordInput.value : "";
  const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : "";
  const adminSecret = adminSecretInput ? adminSecretInput.value.trim() : "";

  // 1. Required fields
  if (!name || !username || !email || !password || !confirmPassword) {
    showAuthAlert("All fields are required.", "danger");
    return;
  }

  // 1b. If admin role is selected, validate invite passcode presence
  if (selectedRegisterRole === "admin" && !adminSecret) {
    showAuthAlert("Admin Secret Key / Invite Code is required to create an Administrator account.", "danger");
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
    submitBtn.innerHTML = `<span>Creating ${selectedRegisterRole.toUpperCase()} Account...</span>`;
  }

  try {
    const payload = {
      name,
      username,
      email,
      password,
      role: selectedRegisterRole,
    };
    if (selectedRegisterRole === "admin") {
      payload.adminSecret = adminSecret;
    }

    const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      showAuthAlert(data.message || "Registration failed. Please check your inputs.", "danger");
      return;
    }

    // Success: switch to login tab, prefill username, and align login role
    switchAuthTab("login");
    selectLoginRole(selectedRegisterRole);
    const loginUsernameInput = document.getElementById("loginUsername");
    if (loginUsernameInput) loginUsernameInput.value = username;

    // Reset register form inputs
    if (nameInput) nameInput.value = "";
    if (usernameInput) usernameInput.value = "";
    if (emailInput) emailInput.value = "";
    if (passwordInput) passwordInput.value = "";
    if (confirmPasswordInput) confirmPasswordInput.value = "";
    if (adminSecretInput) adminSecretInput.value = "";

    showAuthAlert(`Account created successfully as ${data.user?.role || selectedRegisterRole.toUpperCase()}! Please sign in.`, "success");
    showToast(`Account created as ${data.user?.role || selectedRegisterRole.toUpperCase()}! Please sign in.`, "success");
  } catch (err) {
    showAuthAlert("Network/server error. Could not connect to SafeHer backend.", "danger");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
        <span id="registerSubmitBtnText">${selectedRegisterRole === "admin" ? "Create Admin Account" : "Create User Account"}</span>
      `;
    }
  }
}

function handleLogout() {
  const user = authStorage.getUser();
  authStorage.clear();
  updateHeaderAuthUI();
  showToast(`Signed out of ${user?.name || "SafeHer"}.`, "info");
  userEmergencyContacts = [];
  renderEmergencyContacts();
  currentUserDevice = null;
  renderMyDeviceSection();
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

// 30-Second SOS Emergency Countdown State
let sosCountdownTimer = null;
let sosCountdownSeconds = 30;
let sosCountdownStatus = "IDLE"; // 'IDLE' | 'COUNTING' | 'CANCELLED' | 'READY'

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

  // Initialize theme mode (Dark / Light)
  initTheme();

  // Setup client routing (/user vs /admin)
  initRouter();

  // Setup tab navigation
  initNavigation();

  // Sync initial role navigation visibility
  updateRoleNavVisibility();

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

  // Load authenticated user emergency contacts & device from MongoDB
  if (authStorage.isAuthenticated()) {
    loadEmergencyContactsFromBackend();
    loadMyDeviceFromBackend();
  }

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

      // Capture associated username for Admin dashboard attribution
      const alertUsername = payload?.username || payload?.alert?.username || payload?.user?.username || null;
      currentActiveSosUser = alertUsername;

      if (payload && payload.alert) {
        const alert = payload.alert;
        activeIncidentId = alert._id ? `INC-${String(alert._id).slice(-6).toUpperCase()}` : `INC-${Math.floor(100000 + Math.random() * 900000)}`;
        addAlertRecord({
          id: alert._id || Date.now(),
          date: (alert.timestamp ? new Date(alert.timestamp) : new Date()).toISOString().split("T")[0],
          time: formatTimeAMPM(alert.timestamp ? new Date(alert.timestamp) : new Date()),
          type: alert.type || "SOS Button",
          device: alert.deviceId || hardwareState.deviceId,
          username: alertUsername,
          status: "Active Alert",
          statusType: "danger"
        });
      } else {
        activeIncidentId = `INC-${Math.floor(100000 + Math.random() * 900000)}`;
      }

      // Start Browser Geolocation ONLY on emergency trigger
      startEmergencyGPS();

      // Start 30-Second SOS Emergency Countdown
      startSosCountdown(30);

      updateDashboard();
      playSimulatedBeep();
      const toastMsg = alertUsername
        ? `🚨 EMERGENCY SOS BROADCAST: User @${alertUsername} triggered alarm!`
        : "🚨 EMERGENCY SOS BROADCAST RECEIVED! Device in alarm state.";
      showToast(toastMsg, "danger");
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
      currentActiveSosUser = null;

      // Stop Geolocation tracking immediately
      stopEmergencyGPS();

      // Reset SOS Countdown
      resetSosCountdown();

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

  // Start 30-Second SOS Emergency Countdown
  startSosCountdown(30);

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

  // Reset SOS Countdown
  resetSosCountdown();

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

// ==========================================
// 4.1 SOS EMERGENCY 30-SECOND COUNTDOWN ENGINE
// ==========================================

/**
 * Initiates the 30-second visible countdown.
 */
function startSosCountdown(duration = 30) {
  if (sosCountdownTimer) {
    clearInterval(sosCountdownTimer);
    sosCountdownTimer = null;
  }

  sosCountdownSeconds = duration;
  sosCountdownStatus = "COUNTING";
  updateSosCountdownUI();

  sosCountdownTimer = setInterval(() => {
    sosCountdownSeconds--;
    if (sosCountdownSeconds > 0) {
      updateSosCountdownUI();
    } else {
      sosCountdownSeconds = 0;
      clearInterval(sosCountdownTimer);
      sosCountdownTimer = null;
      sosCountdownStatus = "READY";
      updateSosCountdownUI();
      showToast("📞 Emergency call ready", "success");
    }
  }, 1000);
}

/**
 * Cancels emergency countdown without resetting SOS / GPS telemetry.
 */
function cancelEmergencyCountdown() {
  if (sosCountdownTimer) {
    clearInterval(sosCountdownTimer);
    sosCountdownTimer = null;
  }
  sosCountdownStatus = "CANCELLED";
  updateSosCountdownUI();
  showToast("Emergency countdown cancelled. SOS alarm and live GPS tracking remain active.", "info");
}

/**
 * Resets countdown state back to idle.
 */
function resetSosCountdown() {
  if (sosCountdownTimer) {
    clearInterval(sosCountdownTimer);
    sosCountdownTimer = null;
  }
  sosCountdownSeconds = 30;
  sosCountdownStatus = "IDLE";
  updateSosCountdownUI();
}

/**
 * Synchronizes DOM elements for the countdown timer and button across banner and hero card.
 */
function updateSosCountdownUI() {
  // 1. Top Banner Elements
  const bannerCountdownGroup = document.getElementById("bannerCountdownGroup");
  const countdownBadge = document.getElementById("countdownBadge");
  const countdownClockIcon = document.getElementById("countdownClockIcon");
  const countdownText = document.getElementById("countdownText");
  const btnCancelEmergency = document.getElementById("btnCancelEmergency");

  // 2. Hero Section Elements (Emergency Tab)
  const heroCountdownCard = document.getElementById("sosHeroCountdownCard");
  const countdownCircle = document.getElementById("countdownCircle");
  const heroSeconds = document.getElementById("heroCountdownSeconds");
  const heroUnit = document.getElementById("heroCountdownUnit");
  const heroTitle = document.getElementById("heroCountdownTitle");
  const heroDesc = document.getElementById("heroCountdownDesc");
  const btnHeroCancelEmergency = document.getElementById("btnHeroCancelEmergency");

  if (sosCountdownStatus === "COUNTING") {
    // Top banner
    if (bannerCountdownGroup) bannerCountdownGroup.style.display = "flex";
    if (countdownBadge) countdownBadge.className = "countdown-badge";
    if (countdownClockIcon) countdownClockIcon.innerText = "⏱️";
    if (countdownText) countdownText.innerHTML = `Dispatching in <strong id="countdownSeconds">${sosCountdownSeconds}</strong>s`;
    if (btnCancelEmergency) {
      btnCancelEmergency.style.display = "inline-flex";
      btnCancelEmergency.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        <span>Cancel Emergency</span>
      `;
    }

    // Hero card
    if (heroCountdownCard) heroCountdownCard.style.display = "flex";
    if (heroCountdownCard) heroCountdownCard.className = "sos-countdown-card";
    if (countdownCircle) countdownCircle.className = "countdown-timer-circle";
    if (heroSeconds) heroSeconds.innerText = sosCountdownSeconds;
    if (heroUnit) heroUnit.innerText = "SEC";
    if (heroTitle) heroTitle.innerText = "Emergency Dispatch Countdown";
    if (heroDesc) heroDesc.innerText = "Automated emergency response countdown active. Press Cancel if triggered by mistake.";
    if (btnHeroCancelEmergency) {
      btnHeroCancelEmergency.style.display = "inline-flex";
      btnHeroCancelEmergency.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        <span>Cancel Emergency</span>
      `;
    }
  } else if (sosCountdownStatus === "READY") {
    // Reached 0 -> Show "Emergency call ready" only
    if (bannerCountdownGroup) bannerCountdownGroup.style.display = "flex";
    if (countdownBadge) countdownBadge.className = "countdown-badge ready";
    if (countdownClockIcon) countdownClockIcon.innerText = "📞";
    if (countdownText) countdownText.innerHTML = `<span style="color: var(--safe-green); font-weight: 700;">Emergency call ready</span>`;
    if (btnCancelEmergency) btnCancelEmergency.style.display = "none";

    // Hero card: Reached 0 -> "Emergency call ready"
    if (heroCountdownCard) heroCountdownCard.style.display = "flex";
    if (heroCountdownCard) heroCountdownCard.className = "sos-countdown-card ready";
    if (countdownCircle) countdownCircle.className = "countdown-timer-circle ready";
    if (heroSeconds) heroSeconds.innerText = "0";
    if (heroUnit) heroUnit.innerText = "CALL";
    if (heroTitle) heroTitle.innerHTML = `<span style="color: var(--safe-green);">Emergency call ready</span>`;
    if (heroDesc) heroDesc.innerText = "Verification countdown elapsed. Automated emergency call line is ready.";
    if (btnHeroCancelEmergency) btnHeroCancelEmergency.style.display = "none";
  } else if (sosCountdownStatus === "CANCELLED") {
    // Cancelled: stop timer, keep SOS/GPS data intact
    if (bannerCountdownGroup) bannerCountdownGroup.style.display = "flex";
    if (countdownBadge) countdownBadge.className = "countdown-badge cancelled";
    if (countdownClockIcon) countdownClockIcon.innerText = "🛑";
    if (countdownText) countdownText.innerHTML = `<span>Countdown cancelled • SOS/GPS active</span>`;
    if (btnCancelEmergency) btnCancelEmergency.style.display = "none";

    if (heroCountdownCard) heroCountdownCard.style.display = "flex";
    if (heroCountdownCard) heroCountdownCard.className = "sos-countdown-card cancelled";
    if (countdownCircle) countdownCircle.className = "countdown-timer-circle cancelled";
    if (heroSeconds) heroSeconds.innerText = "OFF";
    if (heroUnit) heroUnit.innerText = "HALT";
    if (heroTitle) heroTitle.innerText = "Countdown Cancelled";
    if (heroDesc) heroDesc.innerText = "Emergency call countdown cancelled. Live SOS alerts and GPS tracking remain active.";
    if (btnHeroCancelEmergency) btnHeroCancelEmergency.style.display = "none";
  } else {
    // IDLE
    if (bannerCountdownGroup) bannerCountdownGroup.style.display = "none";
    if (heroCountdownCard) heroCountdownCard.style.display = "none";
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
    // -----------------------------------------------------------------
    // STANDALONE AUTH LAYOUT:
    // Completely hide sidebar, top header, and dashboard components
    // -----------------------------------------------------------------
    document.body.classList.add("layout-auth");
    document.body.classList.remove("layout-dashboard");

    if (viewUser) viewUser.classList.remove("active");
    if (viewAdmin) viewAdmin.classList.remove("active");
    if (viewAuth) viewAuth.classList.add("active");
    if (btnUser) btnUser.classList.remove("active");
    if (btnAdmin) btnAdmin.classList.remove("active");
  } else {
    // -----------------------------------------------------------------
    // PROTECTED DASHBOARD LAYOUT:
    // Render sidebar, top header, and dashboard components
    // -----------------------------------------------------------------
    document.body.classList.remove("layout-auth");
    document.body.classList.add("layout-dashboard");

    if (viewAuth) viewAuth.classList.remove("active");

    if (currentRoute === "/admin") {
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
      if (viewAdmin) viewAdmin.classList.remove("active");
      if (viewUser) viewUser.classList.add("active");
      if (btnAdmin) btnAdmin.classList.remove("active");
      if (btnUser) btnUser.classList.add("active");

      // Sync emergency contacts & device from MongoDB
      if (authStorage.isAuthenticated()) {
        loadEmergencyContactsFromBackend();
        loadMyDeviceFromBackend();
      }
    }
  }

  // Update role-based navigation item visibility (Admin vs User)
  updateRoleNavVisibility();

  if (headerAdminBadge) {
    headerAdminBadge.innerText = hardwareState.safetyStatus === "EMERGENCY" ? "EMERGENCY" : "MONITOR";
  }
}

// ==========================================
// 7.1 ROLE-BASED NAVIGATION ACCESS CONTROL
// ==========================================

function updateRoleNavVisibility() {
  const navItemHistory = document.getElementById("navItemHistory");
  const navItemContacts = document.getElementById("navItemContacts");
  const tabHistory = document.getElementById("history");
  const tabContacts = document.getElementById("contacts");
  const tabDashboard = document.getElementById("dashboard");
  const navItemDashboard = document.getElementById("navItemDashboard");

  if (currentRoute === "/admin") {
    // Admin Command View:
    // - Show Alert History (restricted to Admin view)
    // - Hide Emergency Contacts (restricted to User view)
    if (navItemHistory) navItemHistory.style.display = "flex";
    if (navItemContacts) navItemContacts.style.display = "none";

    // If currently on contacts tab, redirect to dashboard
    if (tabContacts && tabContacts.classList.contains("active")) {
      tabContacts.classList.remove("active");
      if (tabDashboard) tabDashboard.classList.add("active");
      document.querySelectorAll(".nav-menu .nav-item").forEach(n => n.classList.remove("active"));
      if (navItemDashboard) navItemDashboard.classList.add("active");
    }
  } else {
    // Standard User View (/user):
    // - Hide Alert History (restricted to Admin view only)
    // - Show Emergency Contacts (restricted to User view only)
    if (navItemHistory) navItemHistory.style.display = "none";
    if (navItemContacts) navItemContacts.style.display = "flex";

    // If currently on history tab, redirect to dashboard
    if (tabHistory && tabHistory.classList.contains("active")) {
      tabHistory.classList.remove("active");
      if (tabDashboard) tabDashboard.classList.add("active");
      document.querySelectorAll(".nav-menu .nav-item").forEach(n => n.classList.remove("active"));
      if (navItemDashboard) navItemDashboard.classList.add("active");
    }
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
      if (adminHeroSub) {
        if (currentActiveSosUser) {
          adminHeroSub.innerText = `CRITICAL SOS IN PROGRESS: Alert triggered by User @${currentActiveSosUser} (Device: ${hardwareState.deviceId}). Real-time telemetry and browser GPS streaming.`;
        } else {
          adminHeroSub.innerText = "CRITICAL SOS IN PROGRESS: Real-time telemetry and browser GPS streaming.";
        }
      }
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
      if (adminSosSub) adminSosSub.innerText = currentActiveSosUser ? `Triggered by @${currentActiveSosUser}` : "SOS Button Triggered";
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
    if (adminDeviceSub) {
      adminDeviceSub.innerText = currentActiveSosUser
        ? `Node: ${hardwareState.deviceId} • @${currentActiveSosUser}`
        : `Node: ${hardwareState.deviceId}`;
    }
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

    // Clear background dynamically based on active theme
    const isLight = document.body.classList.contains("theme-light") || document.documentElement.getAttribute("data-theme") === "light";
    ctx.fillStyle = isLight ? "#f8fafc" : "#0d1422";
    ctx.fillRect(0, 0, width, height);

    // Draw horizontal grid lines
    ctx.strokeStyle = isLight ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.05)";
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
      <td><code>${item.device}</code>${item.username ? ` <span class="badge-role user-role-badge role-user" style="font-size: 10px; margin-left: 4px;">@${escapeHtml(item.username)}</span>` : ''}</td>
      <td><span class="${badgeClass}">${item.status}</span></td>
      <td>
        <button class="btn-icon" title="View details" onclick="showToast('Alert ID: ${item.id}${item.username ? ' | User: @' + item.username : ''}', 'info')">
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
// 11. NAVIGATION & TABS (COLLAPSIBLE DRAWER)
// ==========================================

function initNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  const tabPanes = document.querySelectorAll(".tab-pane");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const sidebarCloseBtn = document.getElementById("sidebarCloseBtn");

  function openSidebarDrawer() {
    if (sidebar) sidebar.classList.add("open");
    if (sidebarOverlay) sidebarOverlay.classList.add("active");
  }

  function closeSidebarDrawer() {
    if (sidebar) sidebar.classList.remove("open");
    if (sidebarOverlay) sidebarOverlay.classList.remove("active");
  }

  function toggleSidebarDrawer() {
    if (sidebar && sidebar.classList.contains("open")) {
      closeSidebarDrawer();
    } else {
      openSidebarDrawer();
    }
  }

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSidebarDrawer();
    });
  }

  if (sidebarCloseBtn) {
    sidebarCloseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeSidebarDrawer();
    });
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", () => {
      closeSidebarDrawer();
    });
  }

  // Close drawer on ESC key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeSidebarDrawer();
    }
  });

  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const targetTab = item.getAttribute("data-tab");

      // If user clicks a tab in user mode, ensure we are on user dashboard view
      if (currentRoute === "/admin" && targetTab !== "history") {
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

      closeSidebarDrawer();
    });
  });
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
// 14. EMERGENCY CONTACTS MANAGEMENT (STEP 3)
// ==========================================

let userEmergencyContacts = [];

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function loadEmergencyContactsFromBackend() {
  if (!authStorage.isAuthenticated()) return;

  try {
    const res = await authFetch(`${BACKEND_URL}/api/auth/emergency-contacts`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.contacts)) {
        userEmergencyContacts = data.contacts;
        renderEmergencyContacts();
      }
    } else if (res.status === 503) {
      showToast("Database temporarily unavailable. Emergency contacts could not be loaded.", "warning");
    }
  } catch (err) {
    console.warn("Could not load emergency contacts from backend:", err.message);
  }
}

function renderEmergencyContacts() {
  const contactsGrid = document.getElementById("contactsGrid");
  const countDisplay = document.getElementById("contactCountDisplay");
  const addBtn = document.getElementById("btnAddContactHeader");

  const count = userEmergencyContacts.length;
  if (countDisplay) countDisplay.innerText = count;

  if (addBtn) {
    if (count >= 3) {
      addBtn.disabled = true;
      addBtn.style.opacity = "0.6";
      addBtn.style.cursor = "not-allowed";
      addBtn.title = "Maximum 3 emergency contacts reached";
    } else {
      addBtn.disabled = false;
      addBtn.style.opacity = "1";
      addBtn.style.cursor = "pointer";
      addBtn.title = "Add emergency contact (up to 3)";
    }
  }

  if (!contactsGrid) return;

  if (count === 0) {
    contactsGrid.innerHTML = `
      <div class="card-generic" style="grid-column: 1 / -1; text-align: center; padding: 40px 20px;">
        <div style="font-size: 2.5rem; margin-bottom: 12px;">🛡️</div>
        <h3 style="color: #fff; margin-bottom: 6px;">No Emergency Contacts Configured</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; max-width: 440px; margin: 0 auto 20px;">
          Add up to 3 trusted contacts (e.g. parents, relatives, friends) to be alerted instantly when SOS is triggered.
        </p>
        <button class="btn-primary" onclick="showAddContactModal()" style="display: inline-flex; margin: 0 auto;">
          + Add First Contact
        </button>
      </div>
    `;
    return;
  }

  contactsGrid.innerHTML = "";

  userEmergencyContacts.forEach((contact, index) => {
    const card = document.createElement("div");
    card.className = "card-generic contact-card";

    const relLower = (contact.relationship || "").toLowerCase();
    let avatarEmoji = "👤";
    let avatarBg = "bg-blue-soft";
    if (relLower.includes("mother") || relLower.includes("mom")) {
      avatarEmoji = "👩";
      avatarBg = "bg-pink-soft";
    } else if (relLower.includes("father") || relLower.includes("dad")) {
      avatarEmoji = "👨";
      avatarBg = "bg-indigo-soft";
    } else if (relLower.includes("friend") || relLower.includes("sister") || relLower.includes("brother")) {
      avatarEmoji = "🧑";
      avatarBg = "bg-indigo-soft";
    } else if (relLower.includes("police") || relLower.includes("emergency") || relLower.includes("doctor")) {
      avatarEmoji = "🚨";
      avatarBg = "bg-red-soft";
    }

    const relLabel = contact.relationship ? escapeHtml(contact.relationship) : "Emergency Contact";

    card.innerHTML = `
      <div class="contact-header">
        <div class="contact-avatar ${avatarBg}">${avatarEmoji}</div>
        <div class="contact-meta">
          <h4 class="contact-name">${escapeHtml(contact.name)}</h4>
          <span class="contact-rel">${relLabel} • Priority ${index + 1}</span>
        </div>
      </div>
      <div class="contact-body">
        <div class="contact-info-row">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          <strong style="color: #f1f5f9;">${escapeHtml(contact.phone)}</strong>
        </div>
        <div class="contact-info-row">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>Priority Alert Ready</span>
        </div>
      </div>
      <div class="contact-footer">
        <span class="badge-status-green">Active Guardian</span>
        <div style="display: flex; align-items: center; gap: 10px;">
          <button class="contact-action-btn" onclick="showEditContactModal(${index})" style="background: none; border: none; padding: 0; cursor: pointer;">
            ✏️ Edit
          </button>
          <button class="contact-action-btn" onclick="removeEmergencyContact(${index})" style="background: none; border: none; padding: 0; cursor: pointer; color: #f87171;">
            🗑️ Remove
          </button>
        </div>
      </div>
    `;

    contactsGrid.appendChild(card);
  });
}

function showAddContactModal() {
  if (userEmergencyContacts.length >= 3) {
    showToast("Maximum of 3 emergency contacts allowed.", "warning");
    return;
  }

  const modal = document.getElementById("contactModal");
  const modalTitle = document.getElementById("contactModalTitle");
  const editIndex = document.getElementById("contactEditIndex");
  const nameInput = document.getElementById("newContactName");
  const phoneInput = document.getElementById("newContactPhone");
  const relInput = document.getElementById("newContactRelationship");

  if (modalTitle) modalTitle.innerText = "Add Emergency Contact";
  if (editIndex) editIndex.value = "-1";
  if (nameInput) nameInput.value = "";
  if (phoneInput) phoneInput.value = "";
  if (relInput) relInput.value = "";

  if (modal) modal.classList.add("active");
}

function showEditContactModal(index) {
  const contact = userEmergencyContacts[index];
  if (!contact) return;

  const modal = document.getElementById("contactModal");
  const modalTitle = document.getElementById("contactModalTitle");
  const editIndex = document.getElementById("contactEditIndex");
  const nameInput = document.getElementById("newContactName");
  const phoneInput = document.getElementById("newContactPhone");
  const relInput = document.getElementById("newContactRelationship");

  if (modalTitle) modalTitle.innerText = "Edit Emergency Contact";
  if (editIndex) editIndex.value = String(index);
  if (nameInput) nameInput.value = contact.name || "";
  if (phoneInput) phoneInput.value = contact.phone || "";
  if (relInput) relInput.value = contact.relationship || "";

  if (modal) modal.classList.add("active");
}

function closeAddContactModal() {
  const modal = document.getElementById("contactModal");
  if (modal) modal.classList.remove("active");
}

async function saveEmergencyContact() {
  const nameInput = document.getElementById("newContactName");
  const phoneInput = document.getElementById("newContactPhone");
  const relInput = document.getElementById("newContactRelationship");
  const editIndexInput = document.getElementById("contactEditIndex");
  const submitBtn = document.getElementById("btnSaveContactSubmit");

  const name = nameInput ? nameInput.value.trim() : "";
  const phone = phoneInput ? phoneInput.value.trim() : "";
  const relationship = relInput ? relInput.value.trim() : "";
  const editIndex = editIndexInput ? parseInt(editIndexInput.value, 10) : -1;

  if (!name || !phone) {
    showToast("Contact name and phone number are required.", "warning");
    return;
  }

  let updatedList = [];
  if (editIndex >= 0 && editIndex < userEmergencyContacts.length) {
    updatedList = [...userEmergencyContacts];
    updatedList[editIndex] = { name, phone, relationship };
  } else {
    if (userEmergencyContacts.length >= 3) {
      showToast("Maximum of 3 emergency contacts allowed.", "warning");
      return;
    }
    updatedList = [...userEmergencyContacts, { name, phone, relationship }];
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = "Saving to MongoDB...";
  }

  try {
    const res = await authFetch(`${BACKEND_URL}/api/auth/emergency-contacts`, {
      method: "PUT",
      body: JSON.stringify({ contacts: updatedList }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      showToast(data.message || "Failed to save emergency contact.", "danger");
      return;
    }

    userEmergencyContacts = Array.isArray(data.contacts) ? data.contacts : updatedList;
    renderEmergencyContacts();
    closeAddContactModal();
    showToast(editIndex >= 0 ? "Emergency contact updated." : "Emergency contact saved to MongoDB.", "success");
  } catch (err) {
    showToast("Network error saving contact to backend.", "danger");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = "Save Contact";
    }
  }
}

async function removeEmergencyContact(index) {
  const contact = userEmergencyContacts[index];
  if (!contact) return;

  if (!confirm(`Are you sure you want to remove "${contact.name}" from your emergency contacts?`)) {
    return;
  }

  const updatedList = userEmergencyContacts.filter((_, i) => i !== index);

  try {
    const res = await authFetch(`${BACKEND_URL}/api/auth/emergency-contacts`, {
      method: "PUT",
      body: JSON.stringify({ contacts: updatedList }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      showToast(data.message || "Failed to remove emergency contact.", "danger");
      return;
    }

    userEmergencyContacts = Array.isArray(data.contacts) ? data.contacts : updatedList;
    renderEmergencyContacts();
    showToast(`Removed "${contact.name}" from emergency contacts.`, "info");
  } catch (err) {
    showToast("Network error updating emergency contacts.", "danger");
  }
}

// ==========================================
// STEP 4B: USER <-> ESP8266 DEVICE CONNECTION
// ==========================================
let currentUserDevice = null;
let isDeviceLoading = false;
let currentActiveSosUser = null;

async function loadMyDeviceFromBackend() {
  if (!authStorage.isAuthenticated()) {
    currentUserDevice = null;
    renderMyDeviceSection();
    return;
  }

  isDeviceLoading = true;
  renderMyDeviceSection();

  try {
    const res = await authFetch(`${BACKEND_URL}/api/device/my-device`);
    if (res.status === 200) {
      const data = await res.json();
      if (data.success && data.data) {
        currentUserDevice = data.data;
        if (currentUserDevice.deviceId) {
          hardwareState.deviceId = currentUserDevice.deviceId;
          if (currentUserDevice.status) hardwareState.deviceStatus = currentUserDevice.status;
          if (currentUserDevice.safetyStatus) hardwareState.safetyStatus = currentUserDevice.safetyStatus;
        }
      } else {
        currentUserDevice = null;
      }
    } else if (res.status === 404) {
      // Clean 404: No device assigned to this user
      currentUserDevice = null;
    } else if (res.status === 401) {
      currentUserDevice = null;
    } else {
      currentUserDevice = null;
    }
  } catch (err) {
    console.warn("Could not load user device from backend:", err.message);
    currentUserDevice = null;
  } finally {
    isDeviceLoading = false;
    renderMyDeviceSection();
    updateDashboard();
  }
}

function renderMyDeviceSection() {
  const container = document.getElementById("myDeviceSection");
  if (!container) return;

  if (isDeviceLoading) {
    container.innerHTML = `
      <div class="my-device-loading">
        <span class="proto-dot status-green"></span>
        <span>Checking device connection with MongoDB...</span>
      </div>
    `;
    return;
  }

  if (currentUserDevice) {
    const devId = currentUserDevice.deviceId || "SAFEHER-001";
    const status = currentUserDevice.status || "ONLINE";
    const safety = currentUserDevice.safetyStatus || "SAFE";
    const ownerName = currentUserDevice.owner?.username || authStorage.getUser()?.username || "You";
    const isOnline = status === "ONLINE";

    container.innerHTML = `
      <div class="my-device-header">
        <div class="my-device-header-left">
          <div class="card-icon-tag bg-cyan-soft">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
          </div>
          <div>
            <h3 class="my-device-title">My Safety Device</h3>
            <span class="my-device-subtitle">${escapeHtml(currentUserDevice.deviceName || "SafeHer Wearable Band")}</span>
          </div>
        </div>
        <div class="my-device-header-right">
          <span class="badge-status-green" id="deviceConnectedBadge">
            <span class="pulse-dot" style="display: inline-block; width: 6px; height: 6px; background: var(--safe-green); border-radius: 50%; margin-right: 6px;"></span>
            Connected
          </span>
        </div>
      </div>

      <div class="my-device-body">
        <div class="my-device-info-grid">
          <div class="my-device-info-item">
            <span class="my-device-info-label">Device ID</span>
            <span class="my-device-info-val text-white font-mono" id="myDeviceIdDisplay">${escapeHtml(devId)}</span>
          </div>
          <div class="my-device-info-item">
            <span class="my-device-info-label">Connection Status</span>
            <div class="my-device-status-val">
              <span class="status-indicator ${isOnline ? 'status-green' : 'status-gray'}"></span>
              <span class="${isOnline ? 'text-green' : 'text-muted'} font-bold">${escapeHtml(status)}</span>
            </div>
          </div>
          <div class="my-device-info-item">
            <span class="my-device-info-label">Safety Status</span>
            <div class="my-device-status-val">
              <span class="status-indicator ${safety === 'EMERGENCY' ? 'status-red' : 'status-green'}"></span>
              <span class="${safety === 'EMERGENCY' ? 'text-red' : 'text-green'} font-bold">${escapeHtml(safety)}</span>
            </div>
          </div>
          <div class="my-device-info-item">
            <span class="my-device-info-label">Linked Account</span>
            <span class="my-device-info-val text-accent">@${escapeHtml(ownerName)}</span>
          </div>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="my-device-header">
        <div class="my-device-header-left">
          <div class="card-icon-tag bg-yellow-soft">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
          </div>
          <div>
            <h3 class="my-device-title">My Safety Device</h3>
            <span class="my-device-subtitle">Pair your ESP8266 Wearable Prototype</span>
          </div>
        </div>
        <div class="my-device-header-right">
          <span class="badge-status-gray" id="deviceNotConnectedBadge" style="background: rgba(239, 71, 111, 0.12); color: #f87171; border: 1px solid rgba(239, 71, 111, 0.25);">
            No device connected
          </span>
        </div>
      </div>

      <div class="my-device-body">
        <p class="my-device-prompt">
          No device connected to your account. Enter your wearable hardware ID to link your SafeHer device.
        </p>
        
        <div class="my-device-form-row">
          <div class="my-device-input-wrap">
            <label for="claimDeviceIdInput" class="my-device-input-label">Device ID</label>
            <input
              type="text"
              id="claimDeviceIdInput"
              class="form-input my-device-input"
              value="SAFEHER-001"
              placeholder="e.g. SAFEHER-001"
              autocomplete="off"
            />
          </div>
          <button class="btn-primary btn-claim-device" id="btnClaimDevice" onclick="handleClaimDevice()">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            <span>Connect Device</span>
          </button>
        </div>

        <div id="claimDeviceError" class="claim-device-error" style="display: none;"></div>
      </div>
    `;
  }
}

async function handleClaimDevice() {
  if (!authStorage.isAuthenticated()) {
    showToast("Please log in again.", "danger");
    navigateToRoute("/login");
    return;
  }

  const inputEl = document.getElementById("claimDeviceIdInput");
  const errorEl = document.getElementById("claimDeviceError");
  const btnEl = document.getElementById("btnClaimDevice");

  if (errorEl) {
    errorEl.style.display = "none";
    errorEl.innerText = "";
  }

  const deviceId = inputEl ? inputEl.value.trim() : "";
  if (!deviceId) {
    if (errorEl) {
      errorEl.innerText = "Please enter a valid Device ID.";
      errorEl.style.display = "block";
    }
    showToast("Device ID is required.", "warning");
    return;
  }

  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerHTML = `<span>Connecting...</span>`;
  }

  try {
    const res = await authFetch(`${BACKEND_URL}/api/device/claim`, {
      method: "POST",
      body: JSON.stringify({ deviceId }),
    });

    const data = await res.json();

    if (res.status === 200 && data.success) {
      showToast(data.message || `Device '${deviceId}' successfully connected!`, "success");
      currentUserDevice = data.data;
      if (data.data.deviceId) hardwareState.deviceId = data.data.deviceId;
      if (data.data.status) hardwareState.deviceStatus = data.data.status;
      if (data.data.safetyStatus) hardwareState.safetyStatus = data.data.safetyStatus;

      renderMyDeviceSection();
      updateDashboard();
    } else if (res.status === 401) {
      const msg = "Please log in again.";
      showToast(msg, "danger");
      if (errorEl) {
        errorEl.innerText = msg;
        errorEl.style.display = "block";
      }
      authStorage.clear();
      navigateToRoute("/login");
    } else if (res.status === 404) {
      const msg = "Device not found.";
      showToast(msg, "danger");
      if (errorEl) {
        errorEl.innerText = msg;
        errorEl.style.display = "block";
      }
    } else if (res.status === 409) {
      const msg = "This device is already connected to another account.";
      showToast(msg, "danger");
      if (errorEl) {
        errorEl.innerText = msg;
        errorEl.style.display = "block";
      }
    } else {
      const msg = data.message || "Failed to connect device. Please verify ID and try again.";
      showToast(msg, "danger");
      if (errorEl) {
        errorEl.innerText = msg;
        errorEl.style.display = "block";
      }
    }
  } catch (err) {
    const msg = "Network/server error connecting to SafeHer backend. Ensure backend is running.";
    showToast(msg, "danger");
    if (errorEl) {
      errorEl.innerText = msg;
      errorEl.style.display = "block";
    }
  } finally {
    if (btnEl && !currentUserDevice) {
      btnEl.disabled = false;
      btnEl.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <span>Connect Device</span>
      `;
    }
  }
}

// Global window attachments for inline HTML onclick handlers
window.triggerSOS = triggerSOS;
window.resetAlert = resetAlert;
window.simulateSensorsOnce = simulateSensorsOnce;
window.exportAlerts = exportAlerts;
window.clearHistoryConfirmation = clearHistoryConfirmation;
window.showAddContactModal = showAddContactModal;
window.showEditContactModal = showEditContactModal;
window.closeAddContactModal = closeAddContactModal;
window.saveEmergencyContact = saveEmergencyContact;
window.removeEmergencyContact = removeEmergencyContact;
window.loadEmergencyContactsFromBackend = loadEmergencyContactsFromBackend;
window.loadMyDeviceFromBackend = loadMyDeviceFromBackend;
window.renderMyDeviceSection = renderMyDeviceSection;
window.handleClaimDevice = handleClaimDevice;
window.updateSimInterval = updateSimInterval;
window.toggleDeviceOnline = toggleDeviceOnline;
window.showToast = showToast;
window.navigateToRoute = navigateToRoute;
window.startEmergencyGPS = startEmergencyGPS;
window.stopEmergencyGPS = stopEmergencyGPS;
window.switchAuthTab = switchAuthTab;
window.selectLoginRole = selectLoginRole;
window.selectRegisterRole = selectRegisterRole;
window.handleLoginSubmit = handleLoginSubmit;
window.handleRegisterSubmit = handleRegisterSubmit;
window.handleLogout = handleLogout;
window.startSosCountdown = startSosCountdown;
window.cancelEmergencyCountdown = cancelEmergencyCountdown;
window.resetSosCountdown = resetSosCountdown;
window.initTheme = initTheme;
window.applyTheme = applyTheme;
window.toggleTheme = toggleTheme;
window.authStorage = authStorage;
window.authFetch = authFetch;
