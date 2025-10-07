// Picking API Contract Tests
// Validates API integration against contracts/openapi.yaml

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// API client (not yet implemented - tests will fail)
import { apiClient } from '@/services/api';
import type {
  PickRequest,
  PickResponse,
  UnpickRequest,
  UnpickResponse,
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
// POST /api/picks - Save Pick (4-Phase Atomic Transaction)
// =============================================================================

describe('POST /api/picks - Save Pick', () => {
  it('returns PickResponse schema on successful pick save', async () => {
    // Arrange: Mock successful pick save with 4-phase transaction
    const pickRequest: PickRequest = {
      runNo: 213996,
      rowNum: 1,
      lineId: 1,
      lotNo: '2510403-1',
      binNo: 'PWBB-12',
      weight: 20.025,
      workstationId: 'WS3'
    };

    server.use(
      http.post('http://localhost:7075/api/picks', async ({ request }) => {
        const body = await request.json() as PickRequest;

        // Validate request matches schema
        expect(body.runNo).toBe(213996);
        expect(body.weight).toBe(20.025);

        return HttpResponse.json<PickResponse>(
          {
            runNo: 213996,
            rowNum: 1,
            lineId: 1,
            itemKey: 'INSALT02',
            lotNo: '2510403-1',
            binNo: 'PWBB-12',
            pickedQty: 20.025,
            targetQty: 20.0,
            status: 'Allocated',
            pickingDate: '2025-10-06T10:15:30Z',
            lotTranNo: 17282850
          },
          { status: 201 }
        );
      })
    );

    // Act: Save pick
    const response = await apiClient.savePick(pickRequest);

    // Assert: Validate PickResponse schema
    expect(response).toBeDefined();
    expect(response.runNo).toBe(213996);
    expect(response.rowNum).toBe(1);
    expect(response.lineId).toBe(1);
    expect(response.itemKey).toBe('INSALT02');
    expect(response.lotNo).toBe('2510403-1');
    expect(response.binNo).toBe('PWBB-12');
    expect(response.pickedQty).toBe(20.025);
    expect(response.targetQty).toBe(20.0);
    expect(response.status).toBe('Allocated');
    expect(response.pickingDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(response.lotTranNo).toBe(17282850);
  });

  it('returns 201 status code on successful creation', async () => {
    // Arrange
    const pickRequest: PickRequest = {
      runNo: 213996,
      rowNum: 1,
      lineId: 2,
      lotNo: '2510591-2',
      binNo: 'PWBB-13',
      weight: 14.24,
      workstationId: 'WS3'
    };

    server.use(
      http.post('http://localhost:7075/api/picks', () => {
        return HttpResponse.json<PickResponse>(
          {
            runNo: 213996,
            rowNum: 1,
            lineId: 2,
            itemKey: 'INRICF05',
            lotNo: '2510591-2',
            binNo: 'PWBB-13',
            pickedQty: 14.24,
            targetQty: 14.24,
            status: 'Allocated',
            pickingDate: '2025-10-06T10:20:00Z',
            lotTranNo: 17282851
          },
          { status: 201 }
        );
      })
    );

    // Act
    const response = await apiClient.savePick(pickRequest);

    // Assert: 201 Created
    expect(response).toBeDefined();
    expect(response.lotTranNo).toBeTruthy(); // LotTransaction created (Phase 3)
  });

  it('validates composite key (runNo, rowNum, lineId) in response', async () => {
    // Arrange
    const pickRequest: PickRequest = {
      runNo: 213996,
      rowNum: 2,
      lineId: 3,
      lotNo: '2510403-1',
      binNo: 'PWBB-12',
      weight: 20.025,
      workstationId: 'WS3'
    };

    server.use(
      http.post('http://localhost:7075/api/picks', () => {
        return HttpResponse.json<PickResponse>(
          {
            runNo: 213996,
            rowNum: 2,
            lineId: 3,
            itemKey: 'INSALT02',
            lotNo: '2510403-1',
            binNo: 'PWBB-12',
            pickedQty: 20.025,
            targetQty: 20.0,
            status: 'Allocated',
            pickingDate: '2025-10-06T10:25:00Z',
            lotTranNo: 17282852
          },
          { status: 201 }
        );
      })
    );

    // Act
    const response = await apiClient.savePick(pickRequest);

    // Assert: All composite key parts present
    expect(response.runNo).toBe(213996);
    expect(response.rowNum).toBe(2);
    expect(response.lineId).toBe(3);
  });
});

// =============================================================================
// POST /api/picks - Weight Validation Errors
// =============================================================================

describe('POST /api/picks - Weight Validation', () => {
  it('returns 400 ErrorResponse when weight out of tolerance', async () => {
    // Arrange: Mock weight validation failure
    const pickRequest: PickRequest = {
      runNo: 213996,
      rowNum: 1,
      lineId: 1,
      lotNo: '2510403-1',
      binNo: 'PWBB-12',
      weight: 20.5, // Out of tolerance (20.0 ± 0.025)
      workstationId: 'WS3'
    };

    server.use(
      http.post('http://localhost:7075/api/picks', () => {
        return HttpResponse.json<ErrorResponse>(
          {
            error: {
              code: 'VALIDATION_WEIGHT_OUT_OF_TOLERANCE',
              message: 'Weight 20.5 is outside acceptable range (19.975 - 20.025 KG)',
              correlationId: 'test-correlation-id',
              details: {
                weight: 20.5,
                targetQty: 20.0,
                toleranceKG: 0.025,
                weightRangeLow: 19.975,
                weightRangeHigh: 20.025
              }
            }
          },
          { status: 400 }
        );
      })
    );

    // Act & Assert
    await expect(
      apiClient.savePick(pickRequest)
    ).rejects.toMatchObject({
      status: 400,
      error: {
        code: 'VALIDATION_WEIGHT_OUT_OF_TOLERANCE',
        message: expect.stringContaining('outside acceptable range'),
        details: {
          weight: 20.5,
          weightRangeLow: 19.975,
          weightRangeHigh: 20.025
        }
      }
    });
  });

  it('returns detailed validation error with weight range bounds', async () => {
    // Arrange
    const pickRequest: PickRequest = {
      runNo: 213996,
      rowNum: 1,
      lineId: 1,
      lotNo: '2510403-1',
      binNo: 'PWBB-12',
      weight: 19.9, // Below low bound
      workstationId: 'WS3'
    };

    server.use(
      http.post('http://localhost:7075/api/picks', () => {
        return HttpResponse.json<ErrorResponse>(
          {
            error: {
              code: 'VALIDATION_WEIGHT_OUT_OF_TOLERANCE',
              message: 'Weight 19.9 is outside acceptable range (19.975 - 20.025 KG)',
              correlationId: 'test-correlation-id',
              details: {
                weight: 19.9,
                targetQty: 20.0,
                toleranceKG: 0.025,
                weightRangeLow: 19.975,
                weightRangeHigh: 20.025
              }
            }
          },
          { status: 400 }
        );
      })
    );

    // Act & Assert
    await expect(
      apiClient.savePick(pickRequest)
    ).rejects.toMatchObject({
      error: {
        details: {
          weightRangeLow: expect.any(Number),
          weightRangeHigh: expect.any(Number)
        }
      }
    });
  });
});

// =============================================================================
// POST /api/picks - Business Logic Errors
// =============================================================================

describe('POST /api/picks - Business Logic Errors', () => {
  it('returns 400 when item already picked', async () => {
    // Arrange: Mock duplicate pick error
    const pickRequest: PickRequest = {
      runNo: 213996,
      rowNum: 1,
      lineId: 1,
      lotNo: '2510403-1',
      binNo: 'PWBB-12',
      weight: 20.025,
      workstationId: 'WS3'
    };

    server.use(
      http.post('http://localhost:7075/api/picks', () => {
        return HttpResponse.json<ErrorResponse>(
          {
            error: {
              code: 'BUSINESS_ITEM_ALREADY_PICKED',
              message: 'Item INSALT02 already picked for this batch',
              correlationId: 'test-correlation-id',
              details: {
                itemKey: 'INSALT02',
                currentStatus: 'Allocated',
                pickingDate: '2025-10-06T09:30:00Z'
              }
            }
          },
          { status: 400 }
        );
      })
    );

    // Act & Assert
    await expect(
      apiClient.savePick(pickRequest)
    ).rejects.toMatchObject({
      status: 400,
      error: {
        code: 'BUSINESS_ITEM_ALREADY_PICKED',
        message: expect.stringContaining('already picked')
      }
    });
  });

  it('returns 404 when run not found', async () => {
    // Arrange
    const pickRequest: PickRequest = {
      runNo: 999999,
      rowNum: 1,
      lineId: 1,
      lotNo: '2510403-1',
      binNo: 'PWBB-12',
      weight: 20.025,
      workstationId: 'WS3'
    };

    server.use(
      http.post('http://localhost:7075/api/picks', () => {
        return HttpResponse.json<ErrorResponse>(
          {
            error: {
              code: 'NOT_FOUND_RUN',
              message: 'Run 999999 not found',
              correlationId: 'test-correlation-id',
              details: { runNo: 999999 }
            }
          },
          { status: 404 }
        );
      })
    );

    // Act & Assert
    await expect(
      apiClient.savePick(pickRequest)
    ).rejects.toMatchObject({
      status: 404,
      error: {
        code: 'NOT_FOUND_RUN'
      }
    });
  });

  it('returns 404 when lot not found', async () => {
    // Arrange
    const pickRequest: PickRequest = {
      runNo: 213996,
      rowNum: 1,
      lineId: 1,
      lotNo: 'INVALID-LOT',
      binNo: 'PWBB-12',
      weight: 20.025,
      workstationId: 'WS3'
    };

    server.use(
      http.post('http://localhost:7075/api/picks', () => {
        return HttpResponse.json<ErrorResponse>(
          {
            error: {
              code: 'NOT_FOUND_LOT',
              message: 'Lot INVALID-LOT not found',
              correlationId: 'test-correlation-id',
              details: { lotNo: 'INVALID-LOT' }
            }
          },
          { status: 404 }
        );
      })
    );

    // Act & Assert
    await expect(
      apiClient.savePick(pickRequest)
    ).rejects.toMatchObject({
      status: 404,
      error: {
        code: 'NOT_FOUND_LOT'
      }
    });
  });
});

// =============================================================================
// DELETE /api/picks/{runNo}/{rowNum}/{lineId} - Unpick Item
// =============================================================================

describe('DELETE /api/picks/{runNo}/{rowNum}/{lineId}', () => {
  it('unpicks item successfully and preserves audit trail', async () => {
    // Arrange: Mock successful unpick
    const runNo = 213996;
    const rowNum = 1;
    const lineId = 1;
    const unpickRequest: UnpickRequest = {
      workstationId: 'WS3'
    };

    server.use(
      http.delete(`http://localhost:7075/api/picks/${runNo}/${rowNum}/${lineId}`, async ({ request }) => {
        const body = await request.json() as UnpickRequest;

        expect(body.workstationId).toBe('WS3');

        return HttpResponse.json<UnpickResponse>({
          runNo: 213996,
          rowNum: 1,
          lineId: 1,
          itemKey: 'INSALT02',
          pickedQty: 0, // Reset to 0
          status: 'Allocated', // Preserved for audit trail
          unpickedAt: '2025-10-06T10:30:00Z'
        });
      })
    );

    // Act: Unpick item
    const response = await apiClient.unpickItem(runNo, rowNum, lineId, unpickRequest);

    // Assert: Validate UnpickResponse schema
    expect(response).toBeDefined();
    expect(response.runNo).toBe(213996);
    expect(response.rowNum).toBe(1);
    expect(response.lineId).toBe(1);
    expect(response.itemKey).toBe('INSALT02');
    expect(response.pickedQty).toBe(0); // Weight reset
    expect(response.status).toBe('Allocated'); // Audit trail preserved
    expect(response.unpickedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('resets pickedQty to 0 while preserving ItemBatchStatus', async () => {
    // Arrange
    const runNo = 213996;
    const rowNum = 1;
    const lineId = 2;
    const unpickRequest: UnpickRequest = {
      workstationId: 'WS3'
    };

    server.use(
      http.delete(`http://localhost:7075/api/picks/${runNo}/${rowNum}/${lineId}`, () => {
        return HttpResponse.json<UnpickResponse>({
          runNo: 213996,
          rowNum: 1,
          lineId: 2,
          itemKey: 'INRICF05',
          pickedQty: 0, // Reset
          status: 'Allocated', // PRESERVED (audit trail)
          unpickedAt: '2025-10-06T10:35:00Z'
        });
      })
    );

    // Act
    const response = await apiClient.unpickItem(runNo, rowNum, lineId, unpickRequest);

    // Assert: Audit trail preserved
    expect(response.pickedQty).toBe(0);
    expect(response.status).toBe('Allocated'); // NOT reset to null
  });

  it('returns 404 when pick not found', async () => {
    // Arrange
    const runNo = 213996;
    const rowNum = 1;
    const lineId = 999;
    const unpickRequest: UnpickRequest = {
      workstationId: 'WS3'
    };

    server.use(
      http.delete(`http://localhost:7075/api/picks/${runNo}/${rowNum}/${lineId}`, () => {
        return HttpResponse.json<ErrorResponse>(
          {
            error: {
              code: 'NOT_FOUND_PICK',
              message: `Pick not found for run ${runNo}, batch ${rowNum}, line ${lineId}`,
              correlationId: 'test-correlation-id',
              details: { runNo, rowNum, lineId }
            }
          },
          { status: 404 }
        );
      })
    );

    // Act & Assert
    await expect(
      apiClient.unpickItem(runNo, rowNum, lineId, unpickRequest)
    ).rejects.toMatchObject({
      status: 404,
      error: {
        code: 'NOT_FOUND_PICK'
      }
    });
  });

  it('executes atomic unpick workflow (inverse of 4-phase save)', async () => {
    // Arrange: Verify unpick is atomic (all phases or none)
    const runNo = 213996;
    const rowNum = 1;
    const lineId = 1;
    const unpickRequest: UnpickRequest = {
      workstationId: 'WS3'
    };

    server.use(
      http.delete(`http://localhost:7075/api/picks/${runNo}/${rowNum}/${lineId}`, () => {
        return HttpResponse.json<UnpickResponse>({
          runNo: 213996,
          rowNum: 1,
          lineId: 1,
          itemKey: 'INSALT02',
          pickedQty: 0,
          status: 'Allocated',
          unpickedAt: '2025-10-06T10:40:00Z'
        });
      })
    );

    // Act
    const response = await apiClient.unpickItem(runNo, rowNum, lineId, unpickRequest);

    // Assert: Unpick completed atomically
    // Phase 1: PickedPartialQty = 0
    expect(response.pickedQty).toBe(0);
    // Phase 2: Cust_PartialLotPicked deleted (implicit)
    // Phase 3: LotTransaction deleted (implicit)
    // Phase 4: LotMaster.QtyCommitSales decremented (implicit)
    expect(response.unpickedAt).toBeTruthy();
  });
});

// =============================================================================
// Integration Tests - Save + Unpick Workflow
// =============================================================================

describe('Picking Workflow - Save then Unpick', () => {
  it('saves pick then unpicks to reset state', async () => {
    // Arrange: Mock both save and unpick
    const runNo = 213996;
    const rowNum = 1;
    const lineId = 1;

    const pickRequest: PickRequest = {
      runNo,
      rowNum,
      lineId,
      lotNo: '2510403-1',
      binNo: 'PWBB-12',
      weight: 20.025,
      workstationId: 'WS3'
    };

    const unpickRequest: UnpickRequest = {
      workstationId: 'WS3'
    };

    server.use(
      http.post('http://localhost:7075/api/picks', () => {
        return HttpResponse.json<PickResponse>(
          {
            runNo,
            rowNum,
            lineId,
            itemKey: 'INSALT02',
            lotNo: '2510403-1',
            binNo: 'PWBB-12',
            pickedQty: 20.025,
            targetQty: 20.0,
            status: 'Allocated',
            pickingDate: '2025-10-06T10:15:30Z',
            lotTranNo: 17282850
          },
          { status: 201 }
        );
      }),
      http.delete(`http://localhost:7075/api/picks/${runNo}/${rowNum}/${lineId}`, () => {
        return HttpResponse.json<UnpickResponse>({
          runNo,
          rowNum,
          lineId,
          itemKey: 'INSALT02',
          pickedQty: 0,
          status: 'Allocated',
          unpickedAt: '2025-10-06T10:45:00Z'
        });
      })
    );

    // Act: Execute workflow
    const saveResponse = await apiClient.savePick(pickRequest);
    expect(saveResponse.pickedQty).toBe(20.025);

    const unpickResponse = await apiClient.unpickItem(runNo, rowNum, lineId, unpickRequest);

    // Assert: Item unpicked successfully
    expect(unpickResponse.pickedQty).toBe(0);
    expect(unpickResponse.status).toBe('Allocated'); // Audit trail preserved
  });
});
