#!/usr/bin/env node

/**
 * Scenario 9: WebSocket Weight Stream Test
 *
 * Tests WebSocket connection to bridge service and validates:
 * - Connection establishment
 * - Continuous mode activation
 * - Weight update frequency (~100ms)
 * - Latency < 200ms (constitutional requirement)
 * - Message format validation
 *
 * Prerequisites:
 * - Bridge service running at ws://localhost:5000
 * - npm install ws (if not already installed)
 *
 * Usage:
 *   node scripts/test-websocket-scenario9.js
 *   node scripts/test-websocket-scenario9.js WS-002 big
 */

const WebSocket = require('ws');

// Configuration
const BRIDGE_URL = 'ws://localhost:5000';
const WORKSTATION_ID = process.argv[2] || 'WS-001';
const SCALE_TYPE = process.argv[3] || 'small'; // 'small' or 'big'
const TEST_DURATION_MS = 5000; // 5 seconds
const MAX_LATENCY_MS = 200; // Constitutional requirement

// ANSI Colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

// Test Results
const testResults = {
  connectionEstablished: false,
  continuousModeStarted: false,
  weightUpdatesReceived: 0,
  latencies: [],
  maxLatency: 0,
  avgLatency: 0,
  errors: []
};

console.log(`${BLUE}═══════════════════════════════════════════════════════════════${RESET}`);
console.log(`${BLUE}SCENARIO 9: WebSocket Weight Stream Test${RESET}`);
console.log(`${BLUE}═══════════════════════════════════════════════════════════════${RESET}\n`);

console.log(`${YELLOW}Configuration:${RESET}`);
console.log(`  Bridge URL:     ${BRIDGE_URL}`);
console.log(`  Workstation:    ${WORKSTATION_ID}`);
console.log(`  Scale Type:     ${SCALE_TYPE}`);
console.log(`  Test Duration:  ${TEST_DURATION_MS}ms`);
console.log(`  Max Latency:    ${MAX_LATENCY_MS}ms (constitutional requirement)\n`);

const wsUrl = `${BRIDGE_URL}/ws/scale/${WORKSTATION_ID}/${SCALE_TYPE}`;
console.log(`${YELLOW}▶ Connecting to: ${wsUrl}${RESET}\n`);

const ws = new WebSocket(wsUrl);

// Connection opened
ws.on('open', () => {
  console.log(`${GREEN}✓ WebSocket connection established${RESET}`);
  testResults.connectionEstablished = true;
});

// Message received
ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    const receivedAt = Date.now();

    if (message.type === 'continuousStarted') {
      console.log(`${GREEN}✓ Continuous mode started${RESET}`);
      console.log(`  Polling interval: ${message.pollingIntervalMs}ms`);
      console.log(`  Scale ID:         ${message.scaleId}`);
      console.log(`  COM Port:         ${message.comPort || 'N/A'}\n`);
      testResults.continuousModeStarted = true;
    }

    if (message.type === 'weightUpdate') {
      testResults.weightUpdatesReceived++;

      // Calculate latency
      const messageTime = new Date(message.timestamp).getTime();
      const latency = receivedAt - messageTime;
      testResults.latencies.push(latency);

      if (latency > testResults.maxLatency) {
        testResults.maxLatency = latency;
      }

      // Log first 3 updates, then every 10th
      if (testResults.weightUpdatesReceived <= 3 || testResults.weightUpdatesReceived % 10 === 0) {
        const latencyColor = latency < MAX_LATENCY_MS ? GREEN : RED;
        console.log(`  Weight Update #${testResults.weightUpdatesReceived}: ${message.weight} ${message.unit} (stable: ${message.stable}) - Latency: ${latencyColor}${latency}ms${RESET}`);
      }

      // Validate message structure
      if (!message.weight || !message.unit || !message.scaleId || !message.timestamp) {
        testResults.errors.push('Invalid message structure: missing required fields');
      }
    }

    if (message.type === 'error') {
      console.log(`${RED}✗ Error from bridge: ${message.message}${RESET}`);
      testResults.errors.push(message.message);
    }

  } catch (err) {
    console.log(`${RED}✗ Failed to parse message: ${err.message}${RESET}`);
    testResults.errors.push(`Parse error: ${err.message}`);
  }
});

// Connection error
ws.on('error', (error) => {
  console.log(`${RED}✗ WebSocket error: ${error.message}${RESET}`);
  testResults.errors.push(error.message);
});

// Connection closed
ws.on('close', (code, reason) => {
  console.log(`\n${YELLOW}Connection closed: Code ${code}, Reason: ${reason || 'N/A'}${RESET}\n`);
  printResults();
});

// Auto-close after test duration
setTimeout(() => {
  console.log(`\n${YELLOW}Test duration reached (${TEST_DURATION_MS}ms). Closing connection...${RESET}`);
  ws.close();
}, TEST_DURATION_MS);

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log(`\n\n${YELLOW}Test interrupted by user${RESET}`);
  ws.close();
  printResults();
  process.exit(0);
});

/**
 * Print test results and determine pass/fail
 */
function printResults() {
  console.log(`${BLUE}═══════════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BLUE}TEST RESULTS${RESET}`);
  console.log(`${BLUE}═══════════════════════════════════════════════════════════════${RESET}\n`);

  // Calculate average latency
  if (testResults.latencies.length > 0) {
    testResults.avgLatency = testResults.latencies.reduce((a, b) => a + b, 0) / testResults.latencies.length;
  }

  // Connection
  printResult('Connection Established', testResults.connectionEstablished);

  // Continuous Mode
  printResult('Continuous Mode Started', testResults.continuousModeStarted);

  // Weight Updates
  const expectedUpdates = Math.floor(TEST_DURATION_MS / 100); // ~1 update per 100ms
  const updatesPassed = testResults.weightUpdatesReceived >= expectedUpdates * 0.8; // Allow 20% margin
  printResult(`Weight Updates Received (${testResults.weightUpdatesReceived}/${expectedUpdates} expected)`, updatesPassed);

  // Latency
  const latencyPassed = testResults.maxLatency < MAX_LATENCY_MS;
  printResult(`Max Latency < ${MAX_LATENCY_MS}ms (${testResults.maxLatency.toFixed(2)}ms)`, latencyPassed);

  if (testResults.latencies.length > 0) {
    console.log(`  ${YELLOW}ℹ Average Latency: ${testResults.avgLatency.toFixed(2)}ms${RESET}`);
  }

  // Errors
  const noErrors = testResults.errors.length === 0;
  printResult('No Errors', noErrors);

  if (testResults.errors.length > 0) {
    console.log(`\n${RED}Errors encountered:${RESET}`);
    testResults.errors.forEach((err, idx) => {
      console.log(`  ${idx + 1}. ${err}`);
    });
  }

  // Overall Result
  const allPassed = testResults.connectionEstablished &&
                    testResults.continuousModeStarted &&
                    updatesPassed &&
                    latencyPassed &&
                    noErrors;

  console.log(`\n${BLUE}═══════════════════════════════════════════════════════════════${RESET}`);

  if (allPassed) {
    console.log(`${GREEN}✓ SCENARIO 9 PASSED: WebSocket weight stream meets all requirements${RESET}`);
    process.exit(0);
  } else {
    console.log(`${RED}✗ SCENARIO 9 FAILED: One or more requirements not met${RESET}`);
    process.exit(1);
  }
}

/**
 * Print individual result line
 */
function printResult(name, passed) {
  const icon = passed ? '✓' : '✗';
  const color = passed ? GREEN : RED;
  console.log(`${color}${icon} ${name}${RESET}`);
}
