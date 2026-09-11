import { app, server } from './server.js';
import User from './models/User.js';
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

    console.log('\n--- 9. Regression Test: Existing Public SafeHer Endpoints ---');
    const healthRes = await getJson('/api/health');
    console.log('/api/health status:', healthRes.status, 'online:', healthRes.data.success);
    if (healthRes.status !== 200) throw new Error('/api/health broken!');

    const deviceRes = await getJson('/api/device/status');
    console.log('/api/device/status status:', deviceRes.status, 'device:', deviceRes.data.data?.deviceId);
    if (deviceRes.status !== 200) throw new Error('/api/device/status broken!');
    console.log('✅ Existing SafeHer APIs fully preserved and functional.');

    console.log('\n🎉 ALL 9 TEST CASES PASSED SUCCESSFULLY!\n');

    // Clean up test user from MongoDB
    await User.deleteOne({ username: testUser.username });
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    server.close();
    await mongoose.disconnect();
    process.exit();
  }
};

runTests();
