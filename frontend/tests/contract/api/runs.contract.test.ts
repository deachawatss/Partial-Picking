// Runs API Contract Tests
// Validates API integration against contracts/openapi.yaml

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// API client (not yet implemented - tests will fail)
import { apiClient } from '@/services/api';
import type {
  RunDetailsResponse,
  BatchItemsResponse,
  ErrorResponse
} from '@/types/api';

// =============================================================================
// MSW Mock Server Setup
// =============================================================================

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// =============================================================================
// GET /api/runs/{runNo} - Run Details with Auto-Population
// =============================================================================

describe('GET /api/runs/{runNo}', () => {
  it('returns RunDetailsResponse schema with correct auto-populated fields', async () => {
    // Arrange: Mock successful run retrieval
    const runNo = 6000037;

    server.use(
      http.get(`http://localhost:7075/api/runs/${runNo}`, () => {
        return HttpResponse.json<RunDetailsResponse>({
          runNo: 6000037,
          fgItemKey: 'TSM2285A',
          fgDescription: 'Marinade, Savory',
          batches: [1, 2],
          productionDate: '2025-10-06',
          status: 'NEW',
          noOfBatches: 2
        });
      })
    );

    // Act: Fetch run details
    const response = await apiClient.getRunDetails(runNo);

    // Assert: Validate RunDetailsResponse schema
    expect(response).toBeDefined();
    expect(response.runNo).toBe(6000037);
    expect(response.fgItemKey).toBe('TSM2285A');
    expect(response.fgDescription).toBeTruthy();
    expect(response.batches).toHaveLength(2);
    expect(response.batches).toEqual([1, 2]);
    expect(response.productionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(response.status).toBe('NEW');
    expect(response.noOfBatches).toBe(2);
  });

  it('returns 404 ErrorResponse when run not found', async () => {
    // Arrange: Mock not found response
    const runNo = 999999;

    server.use(
      http.get(`http://localhost:7075/api/runs/${runNo}`, () => {
        return HttpResponse.json<ErrorResponse>(
          {
            error: {
              code: 'NOT_FOUND_RUN',
              message: `Run ${runNo} not found`,
              correlationId: 'test-correlation-id',
              details: { runNo }
            }
          },
          { status: 404 }
        );
      })
    );

    // Act & Assert: Expect 404 error
    await expect(
      apiClient.getRunDetails(runNo)
    ).rejects.toMatchObject({
      status: 404,
      error: {
        code: 'NOT_FOUND_RUN',
        message: expect.stringContaining('not found')
      }
    });
  });

  it('auto-populates FG item key from FormulaId', async () => {
    // Arrange
    const runNo = 213972;

    server.use(
      http.get(`http://localhost:7075/api/runs/${runNo}`, () => {
        return HttpResponse.json<RunDetailsResponse>({
          runNo: 213972,
          fgItemKey: 'TSM2285A', // From FormulaId in database
          fgDescription: 'Marinade, Savory',
          batches: [1],
          productionDate: '2025-10-06',
          status: 'NEW',
          noOfBatches: 1
        });
      })
    );

    // Act
    const response = await apiClient.getRunDetails(runNo);

    // Assert: Verify FormulaId → fgItemKey mapping
    expect(response.fgItemKey).toBeTruthy();
    expect(response.fgItemKey).toMatch(/^[A-Z0-9]+$/); // Item key format
  });

  it('returns all batch numbers for multi-batch run', async () => {
    // Arrange
    const runNo = 213935;

    server.use(
      http.get(`http://localhost:7075/api/runs/${runNo}`, () => {
        return HttpResponse.json<RunDetailsResponse>({
          runNo: 213935,
          fgItemKey: 'TSM2285A',
          fgDescription: 'Marinade, Savory',
          batches: [1, 2, 3], // Multiple batches
          productionDate: '2025-10-06',
          status: 'NEW',
          noOfBatches: 3
        });
      })
    );

    // Act
    const response = await apiClient.getRunDetails(runNo);

    // Assert: Verify batches array matches noOfBatches
    expect(response.batches).toHaveLength(3);
    expect(response.noOfBatches).toBe(3);
    expect(response.batches).toEqual([1, 2, 3]);
  });
});

// =============================================================================
// GET /api/runs/{runNo}/batches/{rowNum}/items - Batch Items with Weight Ranges
// =============================================================================

describe('GET /api/runs/{runNo}/batches/{rowNum}/items', () => {
  it('returns BatchItemsResponse schema with calculated weight ranges', async () => {
    // Arrange: Mock batch items retrieval
    const runNo = 6000037;
    const rowNum = 1;

    server.use(
      http.get(`http://localhost:7075/api/runs/${runNo}/batches/${rowNum}/items`, () => {
        return HttpResponse.json<BatchItemsResponse>({
          items: [
            {
              itemKey: 'INRICF05',
              description: 'Rice Flour (RF-0010)',
              totalNeeded: 14.24,
              pickedQty: 0,
              remainingQty: 14.24,
              weightRangeLow: 14.215,
              weightRangeHigh: 14.265,
              toleranceKG: 0.025,
              allergen: '',
              status: null
            },
            {
              itemKey: 'INSALT02',
              description: 'Salt Medium without anticaking',
              totalNeeded: 20.0,
              pickedQty: 20.025,
              remainingQty: 0,
              weightRangeLow: 19.975,
              weightRangeHigh: 20.025,
              toleranceKG: 0.025,
              allergen: '',
              status: 'Allocated'
            }
          ]
        });
      })
    );

    // Act: Fetch batch items
    const response = await apiClient.getBatchItems(runNo, rowNum);

    // Assert: Validate BatchItemsResponse schema
    expect(response).toBeDefined();
    expect(response.items).toHaveLength(2);

    const firstItem = response.items[0];
    expect(firstItem.itemKey).toBe('INRICF05');
    expect(firstItem.totalNeeded).toBe(14.24);
    expect(firstItem.remainingQty).toBe(14.24);
    expect(firstItem.weightRangeLow).toBe(14.215);
    expect(firstItem.weightRangeHigh).toBe(14.265);
    expect(firstItem.toleranceKG).toBe(0.025);

    const secondItem = response.items[1];
    expect(secondItem.status).toBe('Allocated');
    expect(secondItem.pickedQty).toBe(20.025);
  });

  it('calculates weight range low = totalNeeded - toleranceKG', async () => {
    // Arrange
    const runNo = 213972;
    const rowNum = 1;
    const totalNeeded = 20.0;
    const tolerance = 0.025;

    server.use(
      http.get(`http://localhost:7075/api/runs/${runNo}/batches/${rowNum}/items`, () => {
        return HttpResponse.json<BatchItemsResponse>({
          items: [
            {
              itemKey: 'INSALT02',
              description: 'Salt Medium',
              totalNeeded: totalNeeded,
              pickedQty: 0,
              remainingQty: totalNeeded,
              weightRangeLow: totalNeeded - tolerance, // 19.975
              weightRangeHigh: totalNeeded + tolerance, // 20.025
              toleranceKG: tolerance,
              allergen: '',
              status: null
            }
          ]
        });
      })
    );

    // Act
    const response = await apiClient.getBatchItems(runNo, rowNum);

    // Assert: Verify weight range calculation
    const item = response.items[0];
    expect(item.weightRangeLow).toBe(totalNeeded - tolerance);
    expect(item.weightRangeLow).toBe(19.975);
  });

  it('calculates weight range high = totalNeeded + toleranceKG', async () => {
    // Arrange
    const runNo = 213972;
    const rowNum = 1;
    const totalNeeded = 20.0;
    const tolerance = 0.025;

    server.use(
      http.get(`http://localhost:7075/api/runs/${runNo}/batches/${rowNum}/items`, () => {
        return HttpResponse.json<BatchItemsResponse>({
          items: [
            {
              itemKey: 'INSALT02',
              description: 'Salt Medium',
              totalNeeded: totalNeeded,
              pickedQty: 0,
              remainingQty: totalNeeded,
              weightRangeLow: totalNeeded - tolerance,
              weightRangeHigh: totalNeeded + tolerance, // 20.025
              toleranceKG: tolerance,
              allergen: '',
              status: null
            }
          ]
        });
      })
    );

    // Act
    const response = await apiClient.getBatchItems(runNo, rowNum);

    // Assert: Verify weight range calculation
    const item = response.items[0];
    expect(item.weightRangeHigh).toBe(totalNeeded + tolerance);
    expect(item.weightRangeHigh).toBe(20.025);
  });

  it('calculates remaining quantity = totalNeeded - pickedQty', async () => {
    // Arrange
    const runNo = 213972;
    const rowNum = 1;

    server.use(
      http.get(`http://localhost:7075/api/runs/${runNo}/batches/${rowNum}/items`, () => {
        return HttpResponse.json<BatchItemsResponse>({
          items: [
            {
              itemKey: 'INSALT02',
              description: 'Salt Medium',
              totalNeeded: 20.0,
              pickedQty: 15.5,
              remainingQty: 4.5, // 20.0 - 15.5
              weightRangeLow: 19.975,
              weightRangeHigh: 20.025,
              toleranceKG: 0.025,
              allergen: '',
              status: null
            }
          ]
        });
      })
    );

    // Act
    const response = await apiClient.getBatchItems(runNo, rowNum);

    // Assert: Verify remaining quantity calculation
    const item = response.items[0];
    expect(item.remainingQty).toBe(item.totalNeeded - item.pickedQty);
    expect(item.remainingQty).toBe(4.5);
  });

  it('returns empty items array for batch with no items', async () => {
    // Arrange
    const runNo = 213972;
    const rowNum = 999;

    server.use(
      http.get(`http://localhost:7075/api/runs/${runNo}/batches/${rowNum}/items`, () => {
        return HttpResponse.json<BatchItemsResponse>({
          items: []
        });
      })
    );

    // Act
    const response = await apiClient.getBatchItems(runNo, rowNum);

    // Assert: Empty items array
    expect(response.items).toHaveLength(0);
  });

  it('returns 404 when batch not found', async () => {
    // Arrange
    const runNo = 213972;
    const rowNum = 999;

    server.use(
      http.get(`http://localhost:7075/api/runs/${runNo}/batches/${rowNum}/items`, () => {
        return HttpResponse.json<ErrorResponse>(
          {
            error: {
              code: 'NOT_FOUND_BATCH',
              message: `Batch ${rowNum} not found for run ${runNo}`,
              correlationId: 'test-correlation-id',
              details: { runNo, rowNum }
            }
          },
          { status: 404 }
        );
      })
    );

    // Act & Assert
    await expect(
      apiClient.getBatchItems(runNo, rowNum)
    ).rejects.toMatchObject({
      status: 404,
      error: {
        code: 'NOT_FOUND_BATCH'
      }
    });
  });
});

// =============================================================================
// Integration Tests - Run + Batch Items Workflow
// =============================================================================

describe('Run Details + Batch Items Workflow', () => {
  it('fetches run details then batch items in sequence', async () => {
    // Arrange: Mock both endpoints
    const runNo = 213972;

    server.use(
      http.get(`http://localhost:7075/api/runs/${runNo}`, () => {
        return HttpResponse.json<RunDetailsResponse>({
          runNo: 213972,
          fgItemKey: 'TSM2285A',
          fgDescription: 'Marinade, Savory',
          batches: [1, 2],
          productionDate: '2025-10-06',
          status: 'NEW',
          noOfBatches: 2
        });
      }),
      http.get(`http://localhost:7075/api/runs/${runNo}/batches/1/items`, () => {
        return HttpResponse.json<BatchItemsResponse>({
          items: [
            {
              itemKey: 'INSALT02',
              description: 'Salt Medium',
              totalNeeded: 20.0,
              pickedQty: 0,
              remainingQty: 20.0,
              weightRangeLow: 19.975,
              weightRangeHigh: 20.025,
              toleranceKG: 0.025,
              allergen: '',
              status: null
            }
          ]
        });
      })
    );

    // Act: Execute workflow
    const runDetails = await apiClient.getRunDetails(runNo);
    const batchItems = await apiClient.getBatchItems(runNo, runDetails.batches[0]);

    // Assert: Workflow completed successfully
    expect(runDetails.runNo).toBe(213972);
    expect(runDetails.batches).toContain(1);
    expect(batchItems.items).toHaveLength(1);
    expect(batchItems.items[0].itemKey).toBe('INSALT02');
  });
});
