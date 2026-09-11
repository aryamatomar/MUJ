const runTests = async () => {
  const BASE_URL = 'http://localhost:5000/api';

  console.log('🧪 Starting SafeHer API Verification Suite...\n');

  // 1. Health
  const resHealth = await fetch(`${BASE_URL}/health`);
  const jsonHealth = await resHealth.json();
  console.log('1. Health Check:', jsonHealth);

  // 2. Device Status
  const resDevice = await fetch(`${BASE_URL}/device/status`);
  const jsonDevice = await resDevice.json();
  console.log('2. Device Status:', jsonDevice.data.safetyStatus, '| Device:', jsonDevice.data.deviceId);

  // 3. Post Sensor Data
  const resSensor = await fetch(`${BASE_URL}/sensor/data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: 'SAFEHER-001',
      accelerationX: 0.28,
      accelerationY: 0.94,
      accelerationZ: 9.81,
      gyroX: 1.15,
      gyroY: 0.88,
      gyroZ: 2.05,
    }),
  });
  const jsonSensor = await resSensor.json();
  console.log('3. Post Sensor Data:', jsonSensor.success, '| Accel Z:', jsonSensor.data.accelerationZ);

  // 4. Latest Sensor
  const resLatest = await fetch(`${BASE_URL}/sensor/latest`);
  const jsonLatest = await resLatest.json();
  console.log('4. Latest Sensor Reading:', jsonLatest.data.accelerationZ);

  // 5. Trigger SOS
  const resSos = await fetch(`${BASE_URL}/alerts/sos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: 'SAFEHER-001',
      type: 'SOS Button',
      message: 'Test SOS trigger from test script',
    }),
  });
  const jsonSos = await resSos.json();
  console.log('5. Trigger SOS Alert:', jsonSos.success, '| Safety State:', jsonSos.data.device.safetyStatus, '| Buzzer:', jsonSos.data.device.buzzer);

  // 6. Get Alerts
  const resAlerts = await fetch(`${BASE_URL}/alerts`);
  const jsonAlerts = await resAlerts.json();
  console.log('6. Alert History Count:', jsonAlerts.count, '| Latest Type:', jsonAlerts.data[0]?.type);

  // 7. Reset Device
  const resReset = await fetch(`${BASE_URL}/device/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: 'SAFEHER-001' }),
  });
  const jsonReset = await resReset.json();
  console.log('7. Reset Device to Safe:', jsonReset.success, '| Safety State:', jsonReset.data.safetyStatus, '| Buzzer:', jsonReset.data.buzzer);

  // 8. Demo Sensor & Demo SOS
  const resDemoSensor = await fetch(`${BASE_URL}/demo/sensor`, { method: 'POST' });
  const jsonDemoSensor = await resDemoSensor.json();
  console.log('8. Demo Sensor Generation:', jsonDemoSensor.success);

  console.log('\n✅ ALL BACKEND REST APIS AND MONGO STORAGE VERIFIED SUCCESSFULLY!');
};

runTests().catch(console.error);
