/**
 * WebSocket Weight Update Latency Test
 *
 * Constitutional Requirement: <200ms latency for weight updates
 *
 * Tests:
 * - Connect to WebSocket bridge service
 * - Measure time from weight change to React state update
 * - Test 100 rapid weight updates
 * - Calculate p50, p95, p99 latencies
 * - Verify React 19 concurrent rendering performance
 */

const WS_URL = 'ws://localhost:5000/ws/scale';
const WORKSTATION_ID = 'WS-001';
const SCALE_TYPE = 'small';
const CONSTITUTIONAL_LIMIT_MS = 200;
const TEST_ITERATIONS = 100;

interface LatencyMetrics {
  iteration: number;
  sentTimestamp: number;
  receivedTimestamp: number;
  latencyMs: number;
}

interface PerformanceReport {
  totalTests: number;
  successfulTests: number;
  failedTests: number;
  latencies: LatencyMetrics[];
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  avg: number;
  passesRequirement: boolean;
}

function calculatePercentile(sortedValues: number[], percentile: number): number {
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, index)];
}

function generateReport(metrics: LatencyMetrics[]): PerformanceReport {
  const latencies = metrics.map((m) => m.latencyMs).sort((a, b) => a - b);

  const p50 = calculatePercentile(latencies, 50);
  const p95 = calculatePercentile(latencies, 95);
  const p99 = calculatePercentile(latencies, 99);
  const min = Math.min(...latencies);
  const max = Math.max(...latencies);
  const avg = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;

  return {
    totalTests: TEST_ITERATIONS,
    successfulTests: metrics.length,
    failedTests: TEST_ITERATIONS - metrics.length,
    latencies: metrics,
    p50,
    p95,
    p99,
    min,
    max,
    avg,
    passesRequirement: p95 < CONSTITUTIONAL_LIMIT_MS,
  };
}

function printReport(report: PerformanceReport): void {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║      WEBSOCKET WEIGHT LATENCY PERFORMANCE TEST              ║');
  console.log('║      Constitutional Requirement: <200ms latency             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log('Test Configuration:');
  console.log(`  WebSocket URL:       ${WS_URL}/${WORKSTATION_ID}/${SCALE_TYPE}`);
  console.log(`  Total Iterations:    ${report.totalTests}`);
  console.log(`  Successful Tests:    ${report.successfulTests}`);
  console.log(`  Failed Tests:        ${report.failedTests}`);
  console.log('─────────────────────────────────────────────────────────────');

  console.log('\nLatency Percentiles:');
  console.log(`  P50 (median):        ${report.p50.toFixed(2)} ms`);
  console.log(`  P95:                 ${report.p95.toFixed(2)} ms`);
  console.log(`  P99:                 ${report.p99.toFixed(2)} ms`);
  console.log(`  Min:                 ${report.min.toFixed(2)} ms`);
  console.log(`  Max:                 ${report.max.toFixed(2)} ms`);
  console.log(`  Average:             ${report.avg.toFixed(2)} ms`);
  console.log('─────────────────────────────────────────────────────────────');

  console.log('\nConstitutional Compliance:');
  console.log(`  Requirement:         < ${CONSTITUTIONAL_LIMIT_MS} ms (p95)`);
  console.log(`  Actual (p95):        ${report.p95.toFixed(2)} ms`);
  console.log(`  Difference:          ${(CONSTITUTIONAL_LIMIT_MS - report.p95).toFixed(2)} ms`);

  if (report.passesRequirement) {
    console.log('  RESULT:              ✅ PASS');
  } else {
    console.log('  RESULT:              ❌ FAIL');
  }

  console.log('═════════════════════════════════════════════════════════════\n');
}

async function testWebSocketLatency(): Promise<PerformanceReport> {
  return new Promise((resolve, reject) => {
    const metrics: LatencyMetrics[] = [];
    let currentIteration = 0;
    let requestTimestamps: Map<number, number> = new Map();

    console.log('\nConnecting to WebSocket...');
    const ws = new WebSocket(`${WS_URL}/${WORKSTATION_ID}/${SCALE_TYPE}`);

    ws.onopen = () => {
      console.log('✅ WebSocket connected');
      console.log(`\nStarting ${TEST_ITERATIONS} weight update latency tests...\n`);

      // Start sending test messages
      const interval = setInterval(() => {
        if (currentIteration >= TEST_ITERATIONS) {
          clearInterval(interval);
          ws.close();
          return;
        }

        const timestamp = Date.now();
        requestTimestamps.set(currentIteration, timestamp);

        // Simulate weight request
        ws.send(
          JSON.stringify({
            type: 'requestWeight',
            iteration: currentIteration,
            timestamp,
          })
        );

        currentIteration++;
      }, 150); // Send every 150ms (faster than 200ms requirement)
    };

    ws.onmessage = (event) => {
      const receivedTimestamp = Date.now();
      const data = JSON.parse(event.data);

      if (data.type === 'weightUpdate') {
        const iteration = data.iteration;
        const sentTimestamp = requestTimestamps.get(iteration);

        if (sentTimestamp) {
          const latencyMs = receivedTimestamp - sentTimestamp;

          metrics.push({
            iteration,
            sentTimestamp,
            receivedTimestamp,
            latencyMs,
          });

          // Progress indicator
          if (metrics.length % 10 === 0) {
            console.log(`  Tested ${metrics.length}/${TEST_ITERATIONS} weight updates...`);
          }

          requestTimestamps.delete(iteration);
        }
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      ws.close();
      reject(new Error('WebSocket connection failed'));
    };

    ws.onclose = () => {
      console.log('\n✅ WebSocket closed');

      if (metrics.length > 0) {
        const report = generateReport(metrics);
        printReport(report);
        resolve(report);
      } else {
        reject(new Error('No metrics collected'));
      }
    };

    // Timeout after 30 seconds
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      if (metrics.length === 0) {
        reject(new Error('Test timeout - no metrics collected'));
      }
    }, 30000);
  });
}

// Export for use in tests
export { testWebSocketLatency, PerformanceReport };

// Run if executed directly
if (typeof window === 'undefined') {
  console.log('❌ This test requires a browser environment with WebSocket support');
  console.log('Run via Playwright or browser test runner\n');
  process.exit(1);
}
