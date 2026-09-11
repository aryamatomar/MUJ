import { app, server } from './server.js';
import User from './models/User.js';
import Device from './models/Device.js';
import Alert from './models/Alert.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const PORT = process.env.PORT || 5000;

const runTests = async () => {
  // Wait brief moment for server to initialize
  await new Promise((resolve) => setTimeout(resolve, 1500));
  console.log(`🧪 Running auth test suite against http://localhost:${PORT}`);

  const testUser = {
    name: 'MongoDB Verified User',
    username: 'mongo_user_' + Date.now(),
    email: `mongo_user_${Date.now()}@example.com`,
    password: 'securePassword123!',
  };

  let token = null;

  try {
    const postJson = async (path, body, headers = {}) => {
      const res = await fetch(`http://localhost:${PORT}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      return { status: res.status, data };
    };

    const getJson = async (path, headers = {}) => {
      const res = await fetch(`http://localhost:${PORT}${path}`, {
        method: 'GET',
        headers: { ...headers },
      });
      const data = await res.json();
      return { status: res.status, data };
    };

    const putJson = async (path, body, headers = {}) => {
      const res = await fetch(`http://localhost:${PORT}${path}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      return { status: res.status, data };
    };

    console.log('\n--- 1. Testing Registration (MongoDB Persistence & Role USER) ---');
    const regRes = await postJson('/api/auth/register', testUser);
    console.log('Register status:', regRes.status);
    if (regRes.status !== 201 || !regRes.data.user || regRes.data.user.role !== 'USER') {
      throw new Error(`Registration failed! Response: ${JSON.stringify(regRes.data)}`);
    }
    if (regRes.data.user.passwordHash || regRes.data.user.password) {
      throw new Error('CRITICAL SECURITY FLAW: password exposed in registration response!');
    }

    // Direct MongoDB verification
    const dbRecord = await User.findOne({ username: testUser.username });
    if (!dbRecord) {
      throw new Error('CRITICAL FLAW: User was not saved in MongoDB!');
    }
    if (!dbRecord.passwordHash.startsWith('$2') || dbRecord.passwordHash === testUser.password) {
      throw new Error('CRITICAL FLAW: Password is not properly hashed with bcrypt in MongoDB!');
    }
    const isBcryptValid = await bcrypt.compare(testUser.password, dbRecord.passwordHash);
    if (!isBcryptValid) {
      throw new Error('CRITICAL FLAW: Bcrypt comparison failed against MongoDB stored hash!');
    }
    console.log('✅ User successfully saved in MongoDB with valid bcrypt hash. Role is strictly USER.');

    console.log('\n--- 2. Testing Duplicate Username Rejection ---');
    const dupUserRes = await postJson('/api/auth/register', {
      name: 'Another Person',
      username: testUser.username,
      email: 'different_' + Date.now() + '@example.com',
      password: 'password123',
    });
    console.log('Duplicate username status:', dupUserRes.status);
    if (dupUserRes.status !== 400) throw new Error('Duplicate username was not rejected!');
    console.log('✅ Duplicate username correctly rejected with HTTP 400.');

    console.log('\n--- 3. Testing Duplicate Email Rejection ---');
    const dupEmailRes = await postJson('/api/auth/register', {
      name: 'Another Person',
      username: 'diffuser_' + Date.now(),
      email: testUser.email,
      password: 'password123',
    });
    console.log('Duplicate email status:', dupEmailRes.status);
    if (dupEmailRes.status !== 400) throw new Error('Duplicate email was not rejected!');
    console.log('✅ Duplicate email correctly rejected with HTTP 400.');

    console.log('\n--- 4. Testing Invalid Email Format ---');
    const invalidEmailRes = await postJson('/api/auth/register', {
      name: 'Invalid Email Person',
      username: 'invalid_' + Date.now(),
      email: 'not-an-email-at-all',
      password: 'password123',
    });
    console.log('Invalid email status:', invalidEmailRes.status);
    if (invalidEmailRes.status !== 400) throw new Error('Invalid email was not rejected with 400!');
    console.log('✅ Invalid email format correctly rejected with HTTP 400.');

    console.log('\n--- 4b. Testing Admin Registration without Secret Key (Forbidden 403) ---');
    const adminNoKeyRes = await postJson('/api/auth/register', {
      name: 'Unauthorized Admin',
      username: 'fake_admin_' + Date.now(),
      email: `fake_admin_${Date.now()}@example.com`,
      password: 'password123',
      role: 'admin',
    });
    console.log('Admin without key status:', adminNoKeyRes.status);
    if (adminNoKeyRes.status !== 403) throw new Error('Admin registration without secret key was not rejected with 403!');
    console.log('✅ Admin registration without secret key correctly rejected with HTTP 403.');

    console.log('\n--- 4c. Testing Admin Registration with Invalid Secret Key (Forbidden 403) ---');
    const adminBadKeyRes = await postJson('/api/auth/register', {
      name: 'Unauthorized Admin',
      username: 'fake_admin2_' + Date.now(),
      email: `fake_admin2_${Date.now()}@example.com`,
      password: 'password123',
      role: 'admin',
      adminSecret: 'wrong_secret_passcode',
    });
    console.log('Admin with bad key status:', adminBadKeyRes.status);
    if (adminBadKeyRes.status !== 403) throw new Error('Admin registration with wrong key was not rejected with 403!');
    console.log('✅ Admin registration with invalid key correctly rejected with HTTP 403.');

    console.log('\n--- 4d. Testing Admin Registration with Valid Secret Key (Created 201 & Role ADMIN) ---');
    const validAdminUser = {
      name: 'Verified Admin Operator',
      username: 'valid_admin_' + Date.now(),
      email: `valid_admin_${Date.now()}@example.com`,
      password: 'adminPassword123!',
      role: 'admin',
      adminSecret: 'SAFEHER_ADMIN_2026',
    };
    const adminValidRes = await postJson('/api/auth/register', validAdminUser);
    console.log('Admin valid registration status:', adminValidRes.status, 'role:', adminValidRes.data.user?.role);
    if (adminValidRes.status !== 201 || adminValidRes.data.user?.role !== 'ADMIN') {
      throw new Error(`Admin registration with valid key failed! Got: ${JSON.stringify(adminValidRes.data)}`);
    }
    const adminDbRecord = await User.findOne({ username: validAdminUser.username });
    if (!adminDbRecord || adminDbRecord.role !== 'ADMIN') {
      throw new Error('Admin role not saved as ADMIN in MongoDB!');
    }
    console.log('✅ Admin account successfully created in MongoDB with role strictly ADMIN.');

    console.log('\n--- 5. Testing Login with Correct Password ---');
    const loginRes = await postJson('/api/auth/login', {
      username: testUser.username,
      password: testUser.password,
    });
    console.log('Login status:', loginRes.status);
    console.log('JWT Token present:', !!loginRes.data.token);
    console.log('User Role:', loginRes.data.user?.role);
    if (loginRes.status !== 200 || !loginRes.data.token) {
      throw new Error(`Login failed! Response: ${JSON.stringify(loginRes.data)}`);
    }
    if (loginRes.data.user.passwordHash || loginRes.data.user.password) {
      throw new Error('CRITICAL SECURITY FLAW: password exposed in login response!');
    }
    token = loginRes.data.token;
    console.log('✅ Login succeeded with signed JWT and safe user object.');

    console.log('\n--- 6. Testing Login with Incorrect Password ---');
    const badLoginRes = await postJson('/api/auth/login', {
      username: testUser.username,
      password: 'WrongPassword999!',
    });
    console.log('Bad login status:', badLoginRes.status);
    if (badLoginRes.status !== 401) throw new Error('Incorrect password was not rejected with 401!');
    console.log('✅ Incorrect password correctly rejected with HTTP 401.');

    console.log('\n--- 7. Testing GET /api/auth/me with Valid Token (Direct MongoDB lookup) ---');
    const meRes = await getJson('/api/auth/me', {
      Authorization: `Bearer ${token}`,
    });
    console.log('/me status:', meRes.status);
    console.log('/me username:', meRes.data.user?.username);
    if (meRes.status !== 200 || meRes.data.user?.username !== testUser.username) {
      throw new Error('/api/auth/me failed to return user from MongoDB!');
    }
    console.log('✅ /api/auth/me successfully retrieved user directly from MongoDB.');

    console.log('\n--- 8. Testing GET /api/auth/me without Token ---');
    const noTokenRes = await getJson('/api/auth/me');
    console.log('/me without token status:', noTokenRes.status);
    if (noTokenRes.status !== 401) throw new Error('/api/auth/me allowed unauthenticated request!');
    console.log('✅ /api/auth/me correctly rejected unauthenticated request with HTTP 401.');

    // =========================================================================
    // STEP 3: EMERGENCY CONTACT MANAGEMENT TESTS (A through J)
    // =========================================================================

    console.log('\n--- 9. Test A: Authenticated User Can Save 1 Emergency Contact (PUT 200) ---');
    const singleContact = {
      name: 'Mom',
      phone: '+919876543210',
      relationship: 'Mother',
    };
    const putOneRes = await putJson(
      '/api/auth/emergency-contacts',
      { contacts: [singleContact] },
      { Authorization: `Bearer ${token}` }
    );
    console.log('PUT 1 contact status:', putOneRes.status);
    if (putOneRes.status !== 200 || !putOneRes.data.success) {
      throw new Error(`Failed to save emergency contact! Response: ${JSON.stringify(putOneRes.data)}`);
    }
    if (!Array.isArray(putOneRes.data.contacts) || putOneRes.data.contacts.length !== 1) {
      throw new Error('Response contacts array does not contain exactly 1 contact!');
    }
    console.log('✅ Test A Passed: User saved 1 emergency contact with HTTP 200.');

    console.log('\n--- 10. Test B: Emergency Contact Actually Persisted in MongoDB ---');
    const directDbUser = await User.findById(dbRecord._id);
    if (!directDbUser) throw new Error('User record missing in MongoDB!');
    if (!directDbUser.emergencyContacts || directDbUser.emergencyContacts.length !== 1) {
      throw new Error(`MongoDB emergencyContacts length mismatch! Expected 1, found: ${directDbUser.emergencyContacts?.length}`);
    }
    const savedContact = directDbUser.emergencyContacts[0];
    if (savedContact.name !== singleContact.name || savedContact.phone !== singleContact.phone || savedContact.relationship !== singleContact.relationship) {
      throw new Error(`MongoDB stored contact values mismatch! Got: ${JSON.stringify(savedContact)}`);
    }
    console.log('✅ Test B Passed: Contact verified directly inside MongoDB document via User.findById().');

    console.log('\n--- 11. Test C: GET Emergency Contacts with Valid JWT (200) ---');
    const getContactsRes = await getJson('/api/auth/emergency-contacts', {
      Authorization: `Bearer ${token}`,
    });
    console.log('GET emergency-contacts status:', getContactsRes.status);
    if (getContactsRes.status !== 200 || !getContactsRes.data.success) {
      throw new Error(`GET /api/auth/emergency-contacts failed! Response: ${JSON.stringify(getContactsRes.data)}`);
    }
    console.log('✅ Test C Passed: GET /api/auth/emergency-contacts returned HTTP 200.');

    console.log('\n--- 12. Test D: Emergency Contacts Returned Match MongoDB Data ---');
    const returnedContacts = getContactsRes.data.contacts;
    if (!Array.isArray(returnedContacts) || returnedContacts.length !== 1) {
      throw new Error('GET emergency-contacts returned invalid contacts array');
    }
    if (
      returnedContacts[0].name !== savedContact.name ||
      returnedContacts[0].phone !== savedContact.phone ||
      returnedContacts[0].relationship !== savedContact.relationship
    ) {
      throw new Error('GET contacts data does not match MongoDB persisted data!');
    }
    console.log('✅ Test D Passed: Contacts returned from API strictly match MongoDB document data.');

    console.log('\n--- 13. Test E: User Can Save Multiple Contacts Up to 3 (PUT 200) ---');
    const threeContacts = [
      { name: 'Mom', phone: '+919876543210', relationship: 'Mother' },
      { name: 'Sneha', phone: '+919123456789', relationship: 'Friend' },
      { name: 'Dr. Sharma', phone: '+919988776655', relationship: 'Doctor' },
    ];
    const putThreeRes = await putJson(
      '/api/auth/emergency-contacts',
      { contacts: threeContacts },
      { Authorization: `Bearer ${token}` }
    );
    console.log('PUT 3 contacts status:', putThreeRes.status);
    if (putThreeRes.status !== 200 || putThreeRes.data.contacts?.length !== 3) {
      throw new Error(`Failed to save 3 emergency contacts! Response: ${JSON.stringify(putThreeRes.data)}`);
    }
    const dbThreeUser = await User.findById(dbRecord._id);
    if (dbThreeUser.emergencyContacts.length !== 3) {
      throw new Error('MongoDB does not contain 3 emergency contacts after update!');
    }
    console.log('✅ Test E Passed: Saved maximum of 3 emergency contacts with direct MongoDB confirmation.');

    console.log('\n--- 14. Test F: Attempt to Save More Than 3 Contacts (Rejected with 400) ---');
    const fourContacts = [
      ...threeContacts,
      { name: 'Neighbor', phone: '+919000000000', relationship: 'Neighbor' },
    ];
    const putFourRes = await putJson(
      '/api/auth/emergency-contacts',
      { contacts: fourContacts },
      { Authorization: `Bearer ${token}` }
    );
    console.log('PUT 4 contacts status:', putFourRes.status);
    if (putFourRes.status !== 400) {
      throw new Error(`Expected HTTP 400 for >3 contacts, but got: ${putFourRes.status}`);
    }
    console.log('✅ Test F Passed: Attempt to save >3 contacts correctly rejected with HTTP 400.');

    console.log('\n--- 15. Test G: Request Without JWT (Rejected with 401) ---');
    const putNoAuthRes = await putJson('/api/auth/emergency-contacts', { contacts: [] });
    console.log('PUT without JWT status:', putNoAuthRes.status);
    if (putNoAuthRes.status !== 401) {
      throw new Error(`Expected HTTP 401 for PUT without token, got: ${putNoAuthRes.status}`);
    }
    const getNoAuthRes = await getJson('/api/auth/emergency-contacts');
    console.log('GET without JWT status:', getNoAuthRes.status);
    if (getNoAuthRes.status !== 401) {
      throw new Error(`Expected HTTP 401 for GET without token, got: ${getNoAuthRes.status}`);
    }
    console.log('✅ Test G Passed: Unauthenticated requests correctly rejected with HTTP 401.');

    console.log('\n--- 16. Test H: Invalid Contact Data (Rejected with 400) ---');
    // Non-array
    const nonArrayRes = await putJson(
      '/api/auth/emergency-contacts',
      { contacts: 'not-an-array' },
      { Authorization: `Bearer ${token}` }
    );
    if (nonArrayRes.status !== 400) throw new Error('Non-array contacts was not rejected with 400!');

    // Missing phone
    const missingPhoneRes = await putJson(
      '/api/auth/emergency-contacts',
      { contacts: [{ name: 'Test Contact' }] },
      { Authorization: `Bearer ${token}` }
    );
    if (missingPhoneRes.status !== 400) throw new Error('Contact with missing phone was not rejected with 400!');

    // Missing name
    const missingNameRes = await putJson(
      '/api/auth/emergency-contacts',
      { contacts: [{ phone: '+919999999999' }] },
      { Authorization: `Bearer ${token}` }
    );
    if (missingNameRes.status !== 400) throw new Error('Contact with missing name was not rejected with 400!');

    // Blank strings
    const blankStringsRes = await putJson(
      '/api/auth/emergency-contacts',
      { contacts: [{ name: '   ', phone: '   ' }] },
      { Authorization: `Bearer ${token}` }
    );
    if (blankStringsRes.status !== 400) throw new Error('Contact with blank name/phone was not rejected with 400!');
    console.log('✅ Test H Passed: All malformed contact payloads rejected with HTTP 400.');

    console.log('\n--- 17. Test I: PasswordHash is NEVER Returned ---');
    if (putThreeRes.data.user?.passwordHash || putThreeRes.data.passwordHash) {
      throw new Error('SECURITY VIOLATION: passwordHash exposed in PUT emergency-contacts response!');
    }
    if (getContactsRes.data.user?.passwordHash || getContactsRes.data.passwordHash) {
      throw new Error('SECURITY VIOLATION: passwordHash exposed in GET emergency-contacts response!');
    }
    for (const c of getContactsRes.data.contacts) {
      if (c.passwordHash || c.password) {
        throw new Error('SECURITY VIOLATION: password field in contact subdocument!');
      }
    }
    console.log('✅ Test I Passed: passwordHash is never exposed in any contact response.');

    console.log('\n--- 18. Test J: Regression Test: Existing Public SafeHer Endpoints ---');
    const healthRes = await getJson('/api/health');
    console.log('/api/health status:', healthRes.status, 'online:', healthRes.data.success);
    if (healthRes.status !== 200) throw new Error('/api/health broken!');

    const deviceRes = await getJson('/api/device/status');
    console.log('/api/device/status status:', deviceRes.status, 'device:', deviceRes.data.data?.deviceId);
    if (deviceRes.status !== 200) throw new Error('/api/device/status broken!');
    console.log('✅ Test J Passed: Existing SafeHer APIs fully preserved and functional.');

    // =========================================================================
    // STEP 4A: USER <-> ESP8266 DEVICE ASSOCIATION TESTS (K through R)
    // =========================================================================

    console.log('\n--- 19. Setting up device SAFEHER-001 in unassigned state ---');
    await Device.findOneAndUpdate(
      { deviceId: 'SAFEHER-001' },
      { $set: { userId: null, safetyStatus: 'SAFE' } },
      { upsert: true, new: true }
    );
    console.log('✅ SAFEHER-001 verified and set to unassigned (userId: null).');

    console.log('\n--- 20. Test K: Unauthenticated Claim Request (Rejected with 401) ---');
    const claimNoAuthRes = await postJson('/api/device/claim', { deviceId: 'SAFEHER-001' });
    console.log('Claim without JWT status:', claimNoAuthRes.status);
    if (claimNoAuthRes.status !== 401) {
      throw new Error(`Expected HTTP 401 for unauthenticated claim, got: ${claimNoAuthRes.status}`);
    }
    console.log('✅ Test K Passed: Unauthenticated claim request correctly rejected with HTTP 401.');

    console.log('\n--- 21. Test L: Claim Non-Existent Device (Returns 404) ---');
    const claimNotFoundRes = await postJson(
      '/api/device/claim',
      { deviceId: 'SAFEHER-NONEXISTENT-999' },
      { Authorization: `Bearer ${token}` }
    );
    console.log('Claim non-existent device status:', claimNotFoundRes.status);
    if (claimNotFoundRes.status !== 404) {
      throw new Error(`Expected HTTP 404 for non-existent device, got: ${claimNotFoundRes.status}`);
    }
    console.log('✅ Test L Passed: Non-existent device claim correctly rejected with HTTP 404.');

    console.log('\n--- 22. Test M: USER Can Claim an Unassigned Device (POST 200) ---');
    const claimRes = await postJson(
      '/api/device/claim',
      { deviceId: 'SAFEHER-001' },
      { Authorization: `Bearer ${token}` }
    );
    console.log('Claim unassigned device status:', claimRes.status);
    if (claimRes.status !== 200 || !claimRes.data.success) {
      throw new Error(`Failed to claim device! Response: ${JSON.stringify(claimRes.data)}`);
    }
    if (claimRes.data.data.deviceId !== 'SAFEHER-001') {
      throw new Error(`Unexpected deviceId in claim response: ${claimRes.data.data.deviceId}`);
    }
    if (!claimRes.data.data.owner || claimRes.data.data.owner.username !== testUser.username) {
      throw new Error('Claim response missing valid owner info matching logged-in user!');
    }
    if (claimRes.data.data.owner.passwordHash || claimRes.data.data.owner.password) {
      throw new Error('SECURITY VIOLATION: password exposed in device claim response!');
    }

    // Direct MongoDB verification
    const dbDeviceClaimed = await Device.findOne({ deviceId: 'SAFEHER-001' });
    if (!dbDeviceClaimed || !dbDeviceClaimed.userId || dbDeviceClaimed.userId.toString() !== dbRecord._id.toString()) {
      throw new Error('Direct MongoDB check failed: Device.userId does not match User ObjectId!');
    }
    console.log('✅ Test M Passed: USER successfully claimed device; verified directly in MongoDB.');

    console.log('\n--- 23. Test N: USER Can Retrieve Their Own Device (GET /api/device/my-device -> 200) ---');
    const myDeviceRes = await getJson('/api/device/my-device', {
      Authorization: `Bearer ${token}`,
    });
    console.log('GET my-device status:', myDeviceRes.status);
    if (myDeviceRes.status !== 200 || !myDeviceRes.data.success) {
      throw new Error(`GET /api/device/my-device failed! Response: ${JSON.stringify(myDeviceRes.data)}`);
    }
    if (myDeviceRes.data.data.deviceId !== 'SAFEHER-001') {
      throw new Error(`Expected SAFEHER-001, got: ${myDeviceRes.data.data.deviceId}`);
    }
    if (myDeviceRes.data.data.owner?.username !== testUser.username) {
      throw new Error(`Owner username mismatch in my-device response: ${myDeviceRes.data.data.owner?.username}`);
    }
    if (myDeviceRes.data.data.owner?.passwordHash || myDeviceRes.data.data.passwordHash) {
      throw new Error('SECURITY VIOLATION: passwordHash exposed in my-device response!');
    }
    console.log('✅ Test N Passed: USER retrieved their own device with complete owner details and no password exposure.');

    console.log('\n--- 24. Test O: USER B (Without Device) Cannot Retrieve Device (GET 404) ---');
    const userBData = {
      name: 'Second SafeHer User',
      username: 'user_b_' + Date.now(),
      email: `user_b_${Date.now()}@example.com`,
      password: 'userBPassword123!',
    };
    const regUserBRes = await postJson('/api/auth/register', userBData);
    if (regUserBRes.status !== 201) throw new Error('Registration failed for User B');

    const loginBRes = await postJson('/api/auth/login', {
      username: userBData.username,
      password: userBData.password,
    });
    const tokenB = loginBRes.data.token;

    const userBDeviceRes = await getJson('/api/device/my-device', {
      Authorization: `Bearer ${tokenB}`,
    });
    console.log('User B GET my-device status:', userBDeviceRes.status);
    if (userBDeviceRes.status !== 404) {
      throw new Error(`Expected HTTP 404 for User B with no device, got: ${userBDeviceRes.status}`);
    }
    console.log('✅ Test O Passed: User without an assigned device receives clear 404 response; cannot access another user device.');

    console.log('\n--- 25. Test P: Another USER Cannot Claim an Already-Owned Device (409 Conflict) ---');
    const claimConflictRes = await postJson(
      '/api/device/claim',
      { deviceId: 'SAFEHER-001' },
      { Authorization: `Bearer ${tokenB}` }
    );
    console.log('User B claiming already-owned device status:', claimConflictRes.status);
    if (claimConflictRes.status !== 409) {
      throw new Error(`Expected HTTP 409 Conflict when User B claims owned device, got: ${claimConflictRes.status}`);
    }
    console.log('✅ Test P Passed: Attempt by User B to claim User A\'s device correctly rejected with HTTP 409 Conflict.');

    console.log('\n--- 26. Test Q: SOS Flow Identifies Associated User From MongoDB (POST /api/alerts/sos) ---');
    const sosRes = await postJson('/api/alerts/sos', {
      deviceId: 'SAFEHER-001',
      type: 'SOS Button',
      message: 'Emergency SOS test with owner attribution verification',
      // Intentionally supply a fake userId in the body; backend MUST resolve strictly from MongoDB Device record
      userId: '60c72b2f9b1d8b0015f8b999',
    });
    console.log('SOS trigger status:', sosRes.status);
    if (sosRes.status !== 201) throw new Error(`SOS trigger failed! Got status: ${sosRes.status}`);

    const latestAlert = await Alert.findOne({ deviceId: 'SAFEHER-001' }).sort({ timestamp: -1 });
    if (!latestAlert) throw new Error('Generated Alert document not found in MongoDB!');
    if (!latestAlert.userId || latestAlert.userId.toString() !== dbRecord._id.toString()) {
      throw new Error(`Alert userId mismatch! Expected ${dbRecord._id}, got: ${latestAlert.userId}`);
    }
    if (latestAlert.username !== testUser.username) {
      throw new Error(`Alert username mismatch! Expected ${testUser.username}, got: ${latestAlert.username}`);
    }
    console.log('✅ Test Q Passed: SOS alert automatically resolved device owner from MongoDB (ignoring any client spoofing).');

    console.log('\n--- 27. Test R: Admin Functionality & Alert History Verification ---');
    const adminLoginRes = await postJson('/api/auth/login', {
      username: validAdminUser.username,
      password: validAdminUser.password,
      role: 'admin',
    });
    if (adminLoginRes.status !== 200 || !adminLoginRes.data.token) {
      throw new Error('Admin login failed during regression verification');
    }
    const adminToken = adminLoginRes.data.token;

    const adminAlertsRes = await getJson('/api/alerts?deviceId=SAFEHER-001', {
      Authorization: `Bearer ${adminToken}`,
    });
    console.log('Admin alerts fetch status:', adminAlertsRes.status);
    if (adminAlertsRes.status !== 200 || !Array.isArray(adminAlertsRes.data.data)) {
      throw new Error('Admin alerts query failed');
    }
    const verifiedAlert = adminAlertsRes.data.data[0];
    if (!verifiedAlert || verifiedAlert.username !== testUser.username) {
      throw new Error('Admin alert does not contain owner username attribution');
    }
    console.log(`✅ Test R Passed: Admin verified alert history with owner attribution: ${verifiedAlert.username}`);

    // Reset device state back to SAFE and unassigned
    await postJson('/api/device/reset', { deviceId: 'SAFEHER-001' });
    await Device.updateOne({ deviceId: 'SAFEHER-001' }, { $set: { userId: null } });

    console.log('\n🎉 ALL STEP 2, STEP 3, AND STEP 4A TESTS PASSED SUCCESSFULLY!\n');

    // Clean up test users from MongoDB
    await User.deleteMany({ username: { $in: [testUser.username, validAdminUser.username, userBData.username] } });
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    if (server && server.listening) {
      server.close();
    }
    await mongoose.disconnect();
    process.exit();
  }
};

runTests();
