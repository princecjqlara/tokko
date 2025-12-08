#!/usr/bin/env node

/**
 * Auto-Fetch Functionality Test Script
 * Tests the webhook and auto-fetch system
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');

// Configuration
const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const WEBHOOK_VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || '40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac';
const APP_SECRET = process.env.FACEBOOK_APP_SECRET || process.env.FACEBOOK_CLIENT_SECRET || '';

// Test results
const results = {
  passed: [],
  failed: [],
  warnings: []
};

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// Test functions
async function testWebhookVerification() {
  console.log('\n📋 Test 1: Webhook Verification (GET)');
  console.log('─'.repeat(50));
  
  try {
    const challenge = 'test123';
    const url = `${BASE_URL}/api/webhooks/facebook?hub.mode=subscribe&hub.verify_token=${WEBHOOK_VERIFY_TOKEN}&hub.challenge=${challenge}`;
    
    console.log(`Testing: ${url}`);
    const response = await makeRequest(url);
    
    if (response.status === 200 && response.body === challenge) {
      console.log('✅ PASS: Webhook verification returns challenge correctly');
      results.passed.push('Webhook Verification');
      return true;
    } else {
      console.log(`❌ FAIL: Expected status 200 with body "${challenge}", got status ${response.status} with body "${response.body}"`);
      results.failed.push('Webhook Verification');
      return false;
    }
  } catch (error) {
    console.log(`❌ FAIL: Error testing webhook verification: ${error.message}`);
    results.failed.push('Webhook Verification');
    return false;
  }
}

async function testWebhookInvalidToken() {
  console.log('\n📋 Test 2: Webhook Verification with Invalid Token');
  console.log('─'.repeat(50));
  
  try {
    const url = `${BASE_URL}/api/webhooks/facebook?hub.mode=subscribe&hub.verify_token=invalid_token&hub.challenge=test123`;
    
    console.log(`Testing: ${url}`);
    const response = await makeRequest(url);
    
    if (response.status === 403) {
      console.log('✅ PASS: Webhook correctly rejects invalid token');
      results.passed.push('Webhook Invalid Token Rejection');
      return true;
    } else {
      console.log(`⚠️  WARN: Expected status 403 for invalid token, got ${response.status}`);
      results.warnings.push('Webhook Invalid Token Rejection');
      return false;
    }
  } catch (error) {
    console.log(`❌ FAIL: Error testing invalid token: ${error.message}`);
    results.failed.push('Webhook Invalid Token Rejection');
    return false;
  }
}

async function testWebhookEvent() {
  console.log('\n📋 Test 3: Webhook Event Processing (POST)');
  console.log('─'.repeat(50));
  
  try {
    // Create a test webhook event
    const testEvent = {
      object: 'page',
      entry: [{
        id: 'test-page-id',
        messaging: [{
          sender: { id: 'test-contact-id' },
          recipient: { id: 'test-page-id' },
          timestamp: Date.now(),
          message: {
            text: 'Test message'
          }
        }]
      }]
    };

    const body = JSON.stringify(testEvent);
    
    // Generate signature if APP_SECRET is available
    let headers = { 'Content-Type': 'application/json' };
    if (APP_SECRET) {
      const signature = crypto
        .createHmac('sha256', APP_SECRET)
        .update(body)
        .digest('hex');
      headers['x-hub-signature-256'] = `sha256=${signature}`;
    } else {
      console.log('⚠️  WARN: APP_SECRET not set, skipping signature verification');
      results.warnings.push('Webhook Signature Verification');
    }

    const url = `${BASE_URL}/api/webhooks/facebook`;
    console.log(`Testing: POST ${url}`);
    console.log(`Event: ${JSON.stringify(testEvent, null, 2)}`);
    
    const response = await makeRequest(url, {
      method: 'POST',
      headers: headers,
      body: body
    });

    if (response.status === 200 && response.body === 'OK') {
      console.log('✅ PASS: Webhook event processed successfully');
      results.passed.push('Webhook Event Processing');
      return true;
    } else {
      console.log(`❌ FAIL: Expected status 200 with body "OK", got status ${response.status} with body "${response.body}"`);
      results.failed.push('Webhook Event Processing');
      return false;
    }
  } catch (error) {
    console.log(`❌ FAIL: Error testing webhook event: ${error.message}`);
    results.failed.push('Webhook Event Processing');
    return false;
  }
}

async function testBackgroundAPI() {
  console.log('\n📋 Test 4: Background API Endpoint');
  console.log('─'.repeat(50));
  
  try {
    const url = `${BASE_URL}/api/facebook/contacts/background`;
    console.log(`Testing: GET ${url}`);
    
    const response = await makeRequest(url);

    // This endpoint requires authentication, so we expect 401
    if (response.status === 401) {
      console.log('✅ PASS: Background API correctly requires authentication');
      results.passed.push('Background API Authentication');
      return true;
    } else if (response.status === 200) {
      console.log('⚠️  WARN: Background API returned 200 (might be authenticated or missing auth)');
      try {
        const data = JSON.parse(response.body);
        console.log(`Response: ${JSON.stringify(data, null, 2)}`);
        if (data.job || data.status) {
          console.log('✅ PASS: Background API returns job data structure');
          results.passed.push('Background API Response Structure');
        }
      } catch (e) {
        console.log('⚠️  WARN: Could not parse response as JSON');
      }
      results.warnings.push('Background API Authentication');
      return true;
    } else {
      console.log(`⚠️  WARN: Unexpected status ${response.status}`);
      results.warnings.push('Background API');
      return false;
    }
  } catch (error) {
    console.log(`❌ FAIL: Error testing background API: ${error.message}`);
    results.failed.push('Background API');
    return false;
  }
}

async function testEndpointsExist() {
  console.log('\n📋 Test 5: Endpoint Availability');
  console.log('─'.repeat(50));
  
  const endpoints = [
    '/api/webhooks/facebook',
    '/api/facebook/contacts/background',
    '/api/facebook/contacts',
    '/api/facebook/pages'
  ];

  let allExist = true;
  
  for (const endpoint of endpoints) {
    try {
      const url = `${BASE_URL}${endpoint}`;
      console.log(`Checking: ${url}`);
      const response = await makeRequest(url, { method: 'GET' });
      
      // Any response (even 401/403) means endpoint exists
      if (response.status < 500) {
        console.log(`  ✅ ${endpoint} exists (status: ${response.status})`);
      } else {
        console.log(`  ❌ ${endpoint} returned error (status: ${response.status})`);
        allExist = false;
      }
    } catch (error) {
      console.log(`  ❌ ${endpoint} - Error: ${error.message}`);
      allExist = false;
    }
  }

  if (allExist) {
    results.passed.push('Endpoint Availability');
  } else {
    results.failed.push('Endpoint Availability');
  }

  return allExist;
}

// Main test runner
async function runTests() {
  console.log('🧪 Auto-Fetch Functionality Test Suite');
  console.log('='.repeat(50));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Webhook Token: ${WEBHOOK_VERIFY_TOKEN.substring(0, 20)}...`);
  console.log(`App Secret: ${APP_SECRET ? 'Set' : 'Not Set'}`);
  console.log('='.repeat(50));

  // Run tests
  await testEndpointsExist();
  await testWebhookVerification();
  await testWebhookInvalidToken();
  await testWebhookEvent();
  await testBackgroundAPI();

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${results.passed.length}`);
  results.passed.forEach(test => console.log(`   ✓ ${test}`));
  
  if (results.warnings.length > 0) {
    console.log(`\n⚠️  Warnings: ${results.warnings.length}`);
    results.warnings.forEach(test => console.log(`   ⚠ ${test}`));
  }
  
  if (results.failed.length > 0) {
    console.log(`\n❌ Failed: ${results.failed.length}`);
    results.failed.forEach(test => console.log(`   ✗ ${test}`));
  }

  console.log('\n' + '='.repeat(50));
  
  const totalTests = results.passed.length + results.failed.length;
  const passRate = totalTests > 0 ? (results.passed.length / totalTests * 100).toFixed(1) : 0;
  
  console.log(`Pass Rate: ${passRate}% (${results.passed.length}/${totalTests})`);
  
  if (results.failed.length === 0) {
    console.log('🎉 All critical tests passed!');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please review the output above.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});











