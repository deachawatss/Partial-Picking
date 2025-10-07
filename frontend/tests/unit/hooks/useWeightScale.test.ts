/**
 * useWeightScale Hook Tests
 *
 * T018 (Contract Tests): WebSocket protocol compliance
 * T073: Hook implementation tests
 *
 * Tests:
 * - WebSocket connection to bridge service
 * - Weight update message handling
 * - React 19 concurrent rendering (useTransition)
 * - Auto-reconnection with exponential backoff
 * - Online/offline state management
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWeightScale } from '@/hooks/useWeightScale';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: string): void {
    // Mock send implementation
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }

  // Helper method to simulate receiving a message
  simulateMessage(data: object): void {
    if (this.onmessage) {
      const event = new MessageEvent('message', {
        data: JSON.stringify(data),
      });
      this.onmessage(event);
    }
  }

  // Helper method to simulate error
  simulateError(): void {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

describe('useWeightScale', () => {
  let originalWebSocket: typeof WebSocket;
  let mockWebSocketInstance: MockWebSocket | null = null;

  beforeEach(() => {
    // Save original WebSocket
    originalWebSocket = global.WebSocket as unknown as typeof WebSocket;

    // Replace with mock
    global.WebSocket = vi.fn((url: string) => {
      mockWebSocketInstance = new MockWebSocket(url);
      return mockWebSocketInstance as unknown as WebSocket;
    }) as unknown as typeof WebSocket;

    // Mock environment variables
    vi.stubEnv('VITE_BRIDGE_WS_URL', 'ws://localhost:5000');

    // Mock timers for testing reconnection delays
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Restore original WebSocket
    global.WebSocket = originalWebSocket;

    // Clear all timers
    vi.clearAllTimers();
    vi.useRealTimers();

    // Reset mocks
    vi.unstubAllEnvs();
    mockWebSocketInstance = null;
  });

  describe('Connection', () => {
    it('T073: should connect to bridge service on mount', async () => {
      const { result } = renderHook(() => useWeightScale('small'));

      // Initially offline
      expect(result.current.online).toBe(false);

      // Wait for connection
      await waitFor(() => {
        expect(result.current.online).toBe(true);
      });

      // Verify WebSocket URL
      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:5000/ws/scale/small');
    });

    it('T073: should connect to big scale when scaleType is "big"', async () => {
      const { result } = renderHook(() => useWeightScale('big'));

      await waitFor(() => {
        expect(result.current.online).toBe(true);
      });

      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:5000/ws/scale/big');
    });

    it('T073: should clean up WebSocket on unmount', async () => {
      const { unmount } = renderHook(() => useWeightScale('small'));

      await waitFor(() => {
        expect(mockWebSocketInstance?.readyState).toBe(MockWebSocket.OPEN);
      });

      const closeSpy = vi.spyOn(mockWebSocketInstance!, 'close');

      unmount();

      expect(closeSpy).toHaveBeenCalled();
    });
  });

  describe('Weight Updates (T018 Contract Tests)', () => {
    it('T018: should handle weightUpdate message from bridge service', async () => {
      const { result } = renderHook(() => useWeightScale('small'));

      // Wait for connection
      await waitFor(() => {
        expect(result.current.online).toBe(true);
      });

      // Simulate weight update message
      mockWebSocketInstance!.simulateMessage({
        type: 'weightUpdate',
        weight: 20.025,
        unit: 'KG',
        stable: true,
        scaleId: 'SCALE-SMALL-01',
        scaleType: 'SMALL',
        timestamp: new Date().toISOString(),
      });

      // Weight should be updated
      await waitFor(() => {
        expect(result.current.weight).toBe(20.025);
        expect(result.current.stable).toBe(true);
      });
    });

    it('T018: should update stable flag when weight stabilizes', async () => {
      const { result } = renderHook(() => useWeightScale('small'));

      await waitFor(() => {
        expect(result.current.online).toBe(true);
      });

      // Unstable weight
      mockWebSocketInstance!.simulateMessage({
        type: 'weightUpdate',
        weight: 15.5,
        unit: 'KG',
        stable: false,
        scaleId: 'SCALE-SMALL-01',
        scaleType: 'SMALL',
        timestamp: new Date().toISOString(),
      });

      await waitFor(() => {
        expect(result.current.weight).toBe(15.5);
        expect(result.current.stable).toBe(false);
      });

      // Stable weight
      mockWebSocketInstance!.simulateMessage({
        type: 'weightUpdate',
        weight: 15.5,
        unit: 'KG',
        stable: true,
        scaleId: 'SCALE-SMALL-01',
        scaleType: 'SMALL',
        timestamp: new Date().toISOString(),
      });

      await waitFor(() => {
        expect(result.current.stable).toBe(true);
      });
    });

    it('T073: should use React 19 useTransition for non-blocking updates', async () => {
      const { result } = renderHook(() => useWeightScale('small'));

      await waitFor(() => {
        expect(result.current.online).toBe(true);
      });

      // isPending should be available (React 19 useTransition)
      expect(result.current).toHaveProperty('isPending');
      expect(typeof result.current.isPending).toBe('boolean');
    });
  });

  describe('Scale Status Messages (T018 Contract Tests)', () => {
    it('T018: should handle scaleOffline message', async () => {
      const { result } = renderHook(() => useWeightScale('small'));

      await waitFor(() => {
        expect(result.current.online).toBe(true);
      });

      // Simulate scale offline
      mockWebSocketInstance!.simulateMessage({
        type: 'scaleOffline',
        scaleId: 'SCALE-SMALL-01',
        reason: 'COM port not responding',
        timestamp: new Date().toISOString(),
      });

      await waitFor(() => {
        expect(result.current.online).toBe(false);
        expect(result.current.error).toContain('COM port not responding');
      });
    });

    it('T018: should handle scaleOnline message', async () => {
      const { result } = renderHook(() => useWeightScale('small'));

      await waitFor(() => {
        expect(result.current.online).toBe(true);
      });

      // Set offline first
      mockWebSocketInstance!.simulateMessage({
        type: 'scaleOffline',
        scaleId: 'SCALE-SMALL-01',
        reason: 'Test offline',
        timestamp: new Date().toISOString(),
      });

      await waitFor(() => {
        expect(result.current.online).toBe(false);
      });

      // Simulate scale online
      mockWebSocketInstance!.simulateMessage({
        type: 'scaleOnline',
        scaleId: 'SCALE-SMALL-01',
        comPort: 'COM3',
        timestamp: new Date().toISOString(),
      });

      await waitFor(() => {
        expect(result.current.online).toBe(true);
        expect(result.current.error).toBe(null);
      });
    });

    it('T018: should handle error message from bridge service', async () => {
      const { result } = renderHook(() => useWeightScale('small'));

      await waitFor(() => {
        expect(result.current.online).toBe(true);
      });

      // Simulate error message
      mockWebSocketInstance!.simulateMessage({
        type: 'error',
        code: 'HARDWARE_SCALE_READ_FAILED',
        message: 'Failed to read weight from COM3',
        scaleId: 'SCALE-SMALL-01',
        timestamp: new Date().toISOString(),
      });

      await waitFor(() => {
        expect(result.current.error).toContain('HARDWARE_SCALE_READ_FAILED');
        expect(result.current.error).toContain('Failed to read weight from COM3');
      });
    });
  });

  describe('Auto-Reconnection (T073)', () => {
    it('T073: should auto-reconnect with exponential backoff on disconnect', async () => {
      const { result } = renderHook(() => useWeightScale('small', { autoReconnect: true }));

      await waitFor(() => {
        expect(result.current.online).toBe(true);
      });

      // Simulate disconnect
      mockWebSocketInstance!.close();

      await waitFor(() => {
        expect(result.current.online).toBe(false);
      });

      // Fast-forward 1 second (first reconnect attempt)
      vi.advanceTimersByTime(1000);

      // Should attempt reconnection
      await waitFor(() => {
        expect(global.WebSocket).toHaveBeenCalledTimes(2);
      });
    });

    it('T073: should stop reconnecting after max attempts', async () => {
      const { result } = renderHook(() =>
        useWeightScale('small', { autoReconnect: true, maxReconnectAttempts: 3 })
      );

      await waitFor(() => {
        expect(result.current.online).toBe(true);
      });

      // Simulate disconnect and prevent reconnection
      const originalWebSocketMock = global.WebSocket;
      global.WebSocket = vi.fn(() => {
        const ws = new MockWebSocket('ws://localhost:5000/ws/scale/small');
        // Immediately trigger close to simulate failed connection
        setTimeout(() => ws.close(), 10);
        return ws as unknown as WebSocket;
      }) as unknown as typeof WebSocket;

      mockWebSocketInstance!.close();

      // Attempt 1: 1s delay
      vi.advanceTimersByTime(1000);
      await waitFor(() => {}, { timeout: 100 });

      // Attempt 2: 2s delay
      vi.advanceTimersByTime(2000);
      await waitFor(() => {}, { timeout: 100 });

      // Attempt 3: 4s delay
      vi.advanceTimersByTime(4000);
      await waitFor(() => {}, { timeout: 100 });

      // Should stop after max attempts
      await waitFor(() => {
        expect(result.current.error).toContain('Max reconnection attempts');
      });

      // Restore original mock
      global.WebSocket = originalWebSocketMock;
    });

    it('T073: should allow manual reconnect', async () => {
      const { result } = renderHook(() => useWeightScale('small'));

      await waitFor(() => {
        expect(result.current.online).toBe(true);
      });

      // Simulate disconnect
      mockWebSocketInstance!.close();

      await waitFor(() => {
        expect(result.current.online).toBe(false);
      });

      // Manual reconnect
      result.current.reconnect();

      await waitFor(() => {
        expect(global.WebSocket).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Error Handling', () => {
    it('T073: should handle WebSocket connection errors', async () => {
      const { result } = renderHook(() => useWeightScale('small'));

      // Simulate connection error
      if (mockWebSocketInstance) {
        mockWebSocketInstance.simulateError();
      }

      await waitFor(() => {
        expect(result.current.online).toBe(false);
        expect(result.current.error).toBeTruthy();
      });
    });

    it('T073: should clear error when clearError is called', async () => {
      const { result } = renderHook(() => useWeightScale('small'));

      await waitFor(() => {
        expect(result.current.online).toBe(true);
      });

      // Set error
      mockWebSocketInstance!.simulateMessage({
        type: 'error',
        code: 'TEST_ERROR',
        message: 'Test error message',
        timestamp: new Date().toISOString(),
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // Clear error
      result.current.clearError();

      await waitFor(() => {
        expect(result.current.error).toBe(null);
      });
    });
  });

  describe('Performance (Constitutional Requirement)', () => {
    it('T073: should process weight updates with <200ms latency', async () => {
      const { result } = renderHook(() => useWeightScale('small'));

      await waitFor(() => {
        expect(result.current.online).toBe(true);
      });

      // Simulate weight update with timestamp
      const sendTime = new Date();
      mockWebSocketInstance!.simulateMessage({
        type: 'weightUpdate',
        weight: 25.5,
        unit: 'KG',
        stable: true,
        scaleId: 'SCALE-SMALL-01',
        scaleType: 'SMALL',
        timestamp: sendTime.toISOString(),
      });

      const startTime = Date.now();

      // Wait for weight to update
      await waitFor(() => {
        expect(result.current.weight).toBe(25.5);
      });

      const latency = Date.now() - startTime;

      // Should be under 200ms (constitutional requirement)
      // Note: In tests this will be very fast, but validates the pattern
      expect(latency).toBeLessThan(200);
    });
  });
});
