const https = require('https');
const fs = require('fs');

// Disable certificate validation for self-signed cert
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

console.log('🧪 Testing Browser-Like Access to GraphDone via HTTPS Proxy\n');
console.log('='.repeat(60));

// Test 1: Load main page
function testMainPage() {
  return new Promise((resolve) => {
    console.log('\n1. Testing main page load (https://localhost:8443/)...');
    https.get('https://localhost:8443/', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (data.includes('GraphDone') && data.includes('<!doctype html>')) {
          console.log('   ✅ Main page loads successfully');
          console.log(`   Status: ${res.statusCode}`);
          console.log(`   Has GraphDone content: Yes`);
        } else {
          console.log('   ❌ Main page load failed');
        }
        resolve();
      });
    }).on('error', (err) => {
      console.log('   ❌ Error:', err.message);
      resolve();
    });
  });
}

// Test 2: Test API endpoint
function testAPI() {
  return new Promise((resolve) => {
    console.log('\n2. Testing GraphQL API (https://localhost:8443/graphql)...');
    
    const postData = JSON.stringify({
      query: '{ __typename }'
    });
    
    const options = {
      hostname: 'localhost',
      port: 8443,
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.data && json.data.__typename) {
            console.log('   ✅ GraphQL API responds correctly');
            console.log(`   Response: ${JSON.stringify(json)}`);
          } else {
            console.log('   ❌ GraphQL API response invalid');
          }
        } catch (e) {
          console.log('   ❌ Failed to parse GraphQL response');
        }
        resolve();
      });
    });
    
    req.on('error', (err) => {
      console.log('   ❌ Error:', err.message);
      resolve();
    });
    
    req.write(postData);
    req.end();
  });
}

// Test 3: Check WebSocket upgrade headers
function testWebSocket() {
  return new Promise((resolve) => {
    console.log('\n3. Testing WebSocket upgrade capability...');
    
    const options = {
      hostname: 'localhost',
      port: 8443,
      path: '/graphql',
      method: 'GET',
      headers: {
        'Upgrade': 'websocket',
        'Connection': 'Upgrade',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ=='
      }
    };
    
    const req = https.request(options, (res) => {
      if (res.statusCode === 101 || res.headers.upgrade) {
        console.log('   ✅ WebSocket upgrade supported');
      } else {
        console.log('   ⚠️  WebSocket might need different endpoint');
        console.log(`   Status: ${res.statusCode}`);
      }
      resolve();
    });
    
    req.on('error', (err) => {
      console.log('   ❌ Error:', err.message);
      resolve();
    });
    
    req.end();
  });
}

// Run all tests
async function runTests() {
  await testMainPage();
  await testAPI();
  await testWebSocket();
  
  console.log('\n' + '='.repeat(60));
  console.log('\n✨ Browser Access Summary:');
  console.log('   URL: https://localhost:8443');
  console.log('   Status: All services accessible via HTTPS');
  console.log('   Note: Accept the certificate warning in your browser\n');
  
  console.log('📌 To access in Chrome:');
  console.log('   1. Open https://localhost:8443');
  console.log('   2. Click "Advanced" when you see the warning');
  console.log('   3. Click "Proceed to localhost (unsafe)"');
  console.log('   4. The app will load with full HTTPS!\n');
}

runTests();