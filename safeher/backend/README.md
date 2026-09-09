# 🛡️ SafeHer — Women Safety IoT Backend API & Real-time Server

This backend powers the **SafeHer Women Safety Monitoring System**, accepting telemetry from an ESP32 wearable device, logging events to MongoDB, and broadcasting live sensor readings and SOS panic alerts to the dashboard via Socket.IO.

---

## 🚀 Quick Start

### 1. Prerequisites
* **Node.js**: v18+ or v20+
* **MongoDB**: Local Community Server (`mongodb://127.0.0.1:27017/safeher`) OR **MongoDB Atlas** cloud cluster URI.

### 2. Install Dependencies
```bash
cd backend
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default `.env` configuration:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/safeher
CLIENT_URL=http://localhost:5173
DEVICE_ID=SAFEHER-001
NODE_ENV=development
```

### 4. Start MongoDB Locally (Optional / Recommended)
* If MongoDB is installed locally on Windows:
  ```powershell
  net start MongoDB
  ```
  *(Or launch `mongod` from terminal)*
* **Atlas Alternative**: Replace `MONGODB_URI` in `.env` with your MongoDB Atlas connection string:
  ```env
  MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/safeher?retryWrites=true&w=majority
  ```
* *Note: If MongoDB is offline, the backend will automatically run in in-memory fallback mode so tests and dashboard simulations never fail.*

### 5. Start the Backend Server
```bash
# Development mode with nodemon auto-restart
npm run dev

# Or production start
npm start
```
Server will start on: **`http://localhost:5000`**

---

## 📡 REST API Documentation

### 1. Health Check
* **GET** `/api/health`
* **Response**:
```json
{
  "success": true,
  "message": "SafeHer backend is running",
  "database": "connected",
  "socket": "ready",
  "timestamp": "2026-09-09T16:00:00.000Z"
}
```

---

### 2. Device Endpoints

#### A. Get Current Device Status
* **GET** `/api/device/status?deviceId=SAFEHER-001`
* **Response**:
```json
{
  "success": true,
  "data": {
    "deviceId": "SAFEHER-001",
    "deviceName": "SafeHer Band",
    "status": "ONLINE",
    "safetyStatus": "SAFE",
    "sosButton": "INACTIVE",
    "buzzer": "OFF",
    "rgbLed": "GREEN",
    "batteryLevel": 92,
    "wifiSignal": -55,
    "lastSeen": "2026-09-09T16:00:00.000Z"
  }
}
```

#### B. Register or Update Device
* **POST** `/api/device/register`
* **Body**:
```json
{
  "deviceId": "SAFEHER-001",
  "deviceName": "SafeHer Band v1",
  "batteryLevel": 95,
  "wifiSignal": -48,
  "status": "ONLINE"
}
```

#### C. Reset Device to Safe State
* **POST** `/api/device/reset`
* **Body**:
```json
{
  "deviceId": "SAFEHER-001"
}
```
* **Response**:
```json
{
  "success": true,
  "message": "Device alert state reset to SAFE successfully.",
  "data": {
    "deviceId": "SAFEHER-001",
    "safetyStatus": "SAFE",
    "sosButton": "INACTIVE",
    "buzzer": "OFF",
    "rgbLed": "GREEN"
  }
}
```

---

### 3. MPU6050 Sensor Telemetry Endpoints

#### A. Post Live Sensor Telemetry (From ESP32 or Simulation)
* **POST** `/api/sensor/data`
* **Body**:
```json
{
  "deviceId": "SAFEHER-001",
  "accelerationX": 0.24,
  "accelerationY": 0.91,
  "accelerationZ": 9.72,
  "gyroX": 1.20,
  "gyroY": 0.85,
  "gyroZ": 2.10
}
```
* **Response**:
```json
{
  "success": true,
  "data": {
    "deviceId": "SAFEHER-001",
    "accelerationX": 0.24,
    "accelerationY": 0.91,
    "accelerationZ": 9.72,
    "gyroX": 1.2,
    "gyroY": 0.85,
    "gyroZ": 2.1,
    "timestamp": "2026-09-09T16:05:00.000Z"
  }
}
```

#### B. Get Latest Sensor Reading
* **GET** `/api/sensor/latest?deviceId=SAFEHER-001`

#### C. Get Sensor History
* **GET** `/api/sensor/history?deviceId=SAFEHER-001&limit=50`

---

### 4. Alert & SOS Endpoints

#### A. Trigger Emergency SOS
* **POST** `/api/alerts/sos`
* **Body**:
```json
{
  "deviceId": "SAFEHER-001",
  "type": "SOS Button",
  "severity": "CRITICAL",
  "message": "Emergency SOS triggered by wearer.",
  "triggeredBy": "Physical Tactile Button GPIO 4"
}
```
* **Action**:
  * Updates MongoDB Device: `safetyStatus: "EMERGENCY"`, `sosButton: "ACTIVE"`, `buzzer: "ON"`, `rgbLed: "RED"`.
  * Logs an `Alert` record.
  * Emits `sosAlert` and `deviceStatus` via Socket.IO.

#### B. Get Alert History Log
* **GET** `/api/alerts?deviceId=SAFEHER-001&limit=50`

#### C. Resolve Alert
* **POST** `/api/alerts/:id/resolve`

---

### 5. Demo Simulation Endpoints

* **POST** `/api/demo/sensor`
  * Generates a sample MPU6050 packet and broadcasts to all connected dashboards via Socket.IO.
* **POST** `/api/demo/sos`
  * Simulates a full emergency SOS trigger flow without needing physical hardware connected.

---

## 🔌 Socket.IO Real-time Events

| Event Name | Direction | Payload Description |
| :--- | :--- | :--- |
| `deviceStatus` | Server → Client | Full updated `Device` object (Online, Safe, LED, Buzzer, etc.) |
| `sensorData` | Server → Client | Live `{ accelerationX, accelerationY, accelerationZ, gyroX, gyroY, gyroZ, timestamp }` |
| `sosAlert` | Server → Client | `{ alert: AlertDoc, device: DeviceDoc }` broadcasted during panic |
| `alertResolved`| Server → Client | `{ deviceId, message, timestamp, device }` on reset |

---

## 🛠️ ESP32 Hardware Integration Blueprint (Phase 2)

When wiring the real ESP32:
1. **MPU6050** on I2C pins (`SDA = GPIO 21`, `SCL = GPIO 22`).
2. **SOS Button** on `GPIO 4` (Interrupt on Falling Edge).
3. **Buzzer** on `GPIO 5` and **RGB LED** on `GPIO 16, 17, 18`.
4. In Arduino C++ code:
   * Periodically send MPU6050 readings:
     ```cpp
     HTTPClient http;
     http.begin("http://<YOUR_BACKEND_IP>:5000/api/sensor/data");
     http.addHeader("Content-Type", "application/json");
     String payload = "{\"deviceId\":\"SAFEHER-001\",\"accelerationX\":" + String(ax) + ",\"accelerationY\":" + String(ay) + ",\"accelerationZ\":" + String(az) + ",\"gyroX\":" + String(gx) + ",\"gyroY\":" + String(gy) + ",\"gyroZ\":" + String(gz) + "}";
     http.POST(payload);
     http.end();
     ```
   * On Button Press ISR:
     ```cpp
     http.begin("http://<YOUR_BACKEND_IP>:5000/api/alerts/sos");
     http.POST("{\"deviceId\":\"SAFEHER-001\",\"type\":\"SOS Button\"}");
     ```
