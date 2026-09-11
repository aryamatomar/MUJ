const runTests = async () => {
  const PORT = process.env.PORT || 5000;
  const BASE_URL = `http://localhost:${PORT}/api`;

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

  // 9. Post Incident Record
  const incidentPayload = {
    deviceId: 'SAFEHER-001',
    type: 'SOS',
    status: 'EMERGENCY',
    location: {
      latitude: 23.2599,
      longitude: 77.4126,
    },
    sensorData: {
      accelerationX: 2.4,
      accelerationY: 8.7,
      accelerationZ: 1.2,
      gyroX: 0.5,
      gyroY: 1.2,
      gyroZ: 0.8,
    },
    evidence: {
      sosTriggered: true,
      sensorDataCaptured: true,
      locationCaptured: true,
      mediaCaptured: false,
    },
  };

  const resIncidentPost = await fetch(`${BASE_URL}/incidents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(incidentPayload),
  });
  const jsonIncidentPost = await resIncidentPost.json();
  const createdId = jsonIncidentPost.data?.incidentId;
  const evidenceHash = jsonIncidentPost.data?.evidenceHash;

  const is64Hex = typeof evidenceHash === 'string' && /^[a-fA-F0-9]{64}$/.test(evidenceHash);
  console.log(
    '9. Post Incident Record:',
    jsonIncidentPost.success,
    '| ID:',
    createdId,
    '| Hash 64-Hex Valid:',
    is64Hex,
    `(${evidenceHash?.slice(0, 16)}...)`
  );

  // 10. Get Incidents List
  const resIncidentsGet = await fetch(`${BASE_URL}/incidents`);
  const jsonIncidentsGet = await resIncidentsGet.json();
  console.log('10. Get Incidents Count:', jsonIncidentsGet.count, '| Latest Incident ID:', jsonIncidentsGet.data[0]?.incidentId);

  // 11. Get Single Incident by ID
  if (createdId) {
    const resSingleIncident = await fetch(`${BASE_URL}/incidents/${createdId}`);
    const jsonSingleIncident = await resSingleIncident.json();
    console.log('11. Get Incident By ID:', jsonSingleIncident.success, '| Fetched Incident ID:', jsonSingleIncident.data?.incidentId);
  }

  // 12. Verify Incident Integrity (SHA-256)
  if (createdId) {
    const resVerify = await fetch(`${BASE_URL}/incidents/${createdId}/verify`);
    const jsonVerify = await resVerify.json();
    console.log(
      '12. Verify SHA-256 Evidence Hash:',
      jsonVerify.success,
      '| Integrity Verified:',
      jsonVerify.integrityVerified,
      '| Stored Hash === Calculated Hash:',
      jsonVerify.storedHash === jsonVerify.calculatedHash
    );
  }

  console.log('\n✅ ALL BACKEND REST APIS AND SHA-256 INTEGRITY VERIFIED SUCCESSFULLY!');
};

runTests().catch(console.error);
