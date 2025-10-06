import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface WeightScale {
  id: string;
  name: string;
  serialNumber: string;
  comPort: string;
  status: 'connected' | 'disconnected' | 'error' | 'calibrating';
  capacity: number;
  precision: number;
  lastWeight: number;
  lastUpdated: Date;
  workstationId?: string;
  firmwareVersion?: string;
  batteryLevel?: number;
}

interface ScaleCalibration {
  scaleId: string;
  calibrationWeight: number;
  actualReading: number;
  variance: number;
  timestamp: Date;
}

@Component({
  selector: 'app-scale-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container mx-auto px-4 py-6">
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-foreground mb-2">Scale Management</h1>
        <p class="text-muted-foreground">Manage and monitor weight scales across all workstations</p>
      </div>

      <!-- Action Bar -->
      <div class="nwfth-card mb-6 p-4">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <button
              class="nwfth-button-primary"
              (click)="scanForScales()"
              [disabled]="isScanning()"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              {{ isScanning() ? 'Scanning...' : 'Scan for Scales' }}
            </button>

            <button
              class="nwfth-button-secondary"
              (click)="refreshScales()"
              [disabled]="isRefreshing()"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              {{ isRefreshing() ? 'Refreshing...' : 'Refresh All' }}
            </button>
          </div>

          <!-- Status Filter -->
          <div class="flex items-center gap-2">
            <label class="text-sm font-medium text-foreground">Filter:</label>
            <select
              class="nwfth-input w-32"
              [(ngModel)]="selectedStatusFilter"
              (ngModelChange)="updateStatusFilter($event)"
            >
              <option value="all">All Scales</option>
              <option value="connected">Connected</option>
              <option value="disconnected">Disconnected</option>
              <option value="error">Error</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Scales Overview Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
        <div class="nwfth-card p-4 text-center">
          <div class="text-2xl font-bold text-primary">{{ totalScales() }}</div>
          <div class="text-sm text-muted-foreground">Total Scales</div>
        </div>

        <div class="nwfth-card p-4 text-center">
          <div class="text-2xl font-bold text-green-600">{{ connectedScales() }}</div>
          <div class="text-sm text-muted-foreground">Connected</div>
        </div>

        <div class="nwfth-card p-4 text-center">
          <div class="text-2xl font-bold text-red-600">{{ disconnectedScales() }}</div>
          <div class="text-sm text-muted-foreground">Disconnected</div>
        </div>

        <div class="nwfth-card p-4 text-center">
          <div class="text-2xl font-bold text-yellow-600">{{ errorScales() }}</div>
          <div class="text-sm text-muted-foreground">Errors</div>
        </div>
      </div>

      <!-- Scales List -->
      <div class="nwfth-card p-6">
        <h2 class="text-lg font-semibold text-foreground mb-4">Registered Scales</h2>

        <!-- Loading State -->
        <div *ngIf="isLoading()" class="text-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p class="text-muted-foreground">Loading scales...</p>
        </div>

        <!-- Scales Table -->
        <div *ngIf="!isLoading()" class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-border">
                <th class="text-left py-3 px-4 font-medium text-foreground">Scale Details</th>
                <th class="text-left py-3 px-4 font-medium text-foreground">Connection</th>
                <th class="text-left py-3 px-4 font-medium text-foreground">Status</th>
                <th class="text-left py-3 px-4 font-medium text-foreground">Current Weight</th>
                <th class="text-left py-3 px-4 font-medium text-foreground">Last Updated</th>
                <th class="text-left py-3 px-4 font-medium text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                *ngFor="let scale of filteredScales()"
                class="border-b border-border hover:bg-muted/50 transition-colors"
              >
                <td class="py-4 px-4">
                  <div>
                    <div class="font-medium text-foreground">{{ scale.name }}</div>
                    <div class="text-sm text-muted-foreground">{{ scale.serialNumber }}</div>
                    <div class="text-xs text-muted-foreground">{{ scale.comPort }}</div>
                  </div>
                </td>

                <td class="py-4 px-4">
                  <div class="flex items-center gap-2">
                    <div [class]="getStatusIndicatorClass(scale.status)" class="w-3 h-3 rounded-full"></div>
                    <span class="text-sm">{{ getStatusDisplayName(scale.status) }}</span>
                  </div>
                  <div *ngIf="scale.workstationId" class="text-xs text-muted-foreground mt-1">
                    Station: {{ scale.workstationId }}
                  </div>
                </td>

                <td class="py-4 px-4">
                  <div class="text-sm">
                    <div>Capacity: {{ formatWeight(scale.capacity) }}</div>
                    <div>Precision: ±{{ formatWeight(scale.precision) }}</div>
                    <div *ngIf="scale.firmwareVersion" class="text-xs text-muted-foreground">
                      FW: {{ scale.firmwareVersion }}
                    </div>
                  </div>
                </td>

                <td class="py-4 px-4">
                  <div class="text-lg font-mono">{{ formatWeight(scale.lastWeight) }}</div>
                  <div *ngIf="scale.batteryLevel !== undefined" class="text-xs text-muted-foreground">
                    Battery: {{ scale.batteryLevel }}%
                  </div>
                </td>

                <td class="py-4 px-4">
                  <div class="text-sm">{{ formatDateTime(scale.lastUpdated) }}</div>
                </td>

                <td class="py-4 px-4">
                  <div class="flex flex-col gap-1">
                    <button
                      class="nwfth-button-secondary text-xs px-2 py-1"
                      (click)="testScale(scale)"
                      [disabled]="scale.status === 'error'"
                    >
                      Test
                    </button>
                    <button
                      class="nwfth-button-secondary text-xs px-2 py-1"
                      (click)="calibrateScale(scale)"
                      [disabled]="scale.status !== 'connected'"
                    >
                      Calibrate
                    </button>
                    <button
                      class="nwfth-button-secondary text-xs px-2 py-1"
                      (click)="viewDetails(scale)"
                    >
                      Details
                    </button>
                  </div>
                </td>
              </tr>

              <!-- Empty State -->
              <tr *ngIf="filteredScales().length === 0">
                <td colspan="6" class="py-8 text-center">
                  <svg class="w-12 h-12 mx-auto text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                  </svg>
                  <h3 class="text-lg font-medium text-foreground mb-2">No scales found</h3>
                  <p class="text-muted-foreground">
                    {{ selectedStatusFilter === 'all' ? 'No scales have been registered.' : 'No scales match the selected filter.' }}
                  </p>
                  <button
                    class="nwfth-button-primary mt-4"
                    (click)="scanForScales()"
                  >
                    Scan for Scales
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Scale Details Modal (placeholder) -->
      <div *ngIf="selectedScale()" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div class="nwfth-card max-w-2xl w-full max-h-96 overflow-y-auto">
          <div class="p-6">
            <div class="flex justify-between items-start mb-4">
              <h3 class="text-lg font-semibold text-foreground">Scale Details</h3>
              <button
                class="text-muted-foreground hover:text-foreground"
                (click)="closeDetails()"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="text-sm font-medium text-foreground">Name</label>
                <p class="text-base">{{ selectedScale()!.name }}</p>
              </div>
              <div>
                <label class="text-sm font-medium text-foreground">Serial Number</label>
                <p class="text-base font-mono">{{ selectedScale()!.serialNumber }}</p>
              </div>
              <div>
                <label class="text-sm font-medium text-foreground">COM Port</label>
                <p class="text-base">{{ selectedScale()!.comPort }}</p>
              </div>
              <div>
                <label class="text-sm font-medium text-foreground">Status</label>
                <p [class]="getStatusClass(selectedScale()!.status)">
                  {{ getStatusDisplayName(selectedScale()!.status) }}
                </p>
              </div>
            </div>

            <div class="mt-6 flex justify-end gap-3">
              <button class="nwfth-button-secondary" (click)="closeDetails()">
                Close
              </button>
              <button class="nwfth-button-primary" (click)="editScale(selectedScale()!)">
                Edit Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      backdrop-filter: blur(4px);
    }
  `]
})
export class ScaleManagementComponent implements OnInit {
  // Form inputs
  public selectedStatusFilter = 'all';

  // Signals for reactive state management
  private _isLoading = signal<boolean>(false);
  private _isScanning = signal<boolean>(false);
  private _isRefreshing = signal<boolean>(false);
  private _scales = signal<WeightScale[]>([]);
  private _selectedScale = signal<WeightScale | null>(null);
  private _statusFilter = signal<string>('all');

  // Public readonly signals
  public readonly isLoading = this._isLoading.asReadonly();
  public readonly isScanning = this._isScanning.asReadonly();
  public readonly isRefreshing = this._isRefreshing.asReadonly();
  public readonly scales = this._scales.asReadonly();
  public readonly selectedScale = this._selectedScale.asReadonly();

  // Computed signals
  public readonly totalScales = computed(() => this._scales().length);
  public readonly connectedScales = computed(() =>
    this._scales().filter(scale => scale.status === 'connected').length
  );
  public readonly disconnectedScales = computed(() =>
    this._scales().filter(scale => scale.status === 'disconnected').length
  );
  public readonly errorScales = computed(() =>
    this._scales().filter(scale => scale.status === 'error').length
  );

  public readonly filteredScales = computed(() => {
    const filter = this._statusFilter();
    const scales = this._scales();

    if (filter === 'all') {
      return scales;
    }
    return scales.filter(scale => scale.status === filter);
  });

  constructor() {}

  ngOnInit(): void {
    this.loadScales();
  }

  /**
   * Load scales from the backend
   */
  loadScales(): void {
    this._isLoading.set(true);

    // Mock data for now - replace with actual API call
    setTimeout(() => {
      const mockScales: WeightScale[] = [
        {
          id: '1',
          name: 'Scale WS-001',
          serialNumber: 'SCL-2024-001',
          comPort: 'COM3',
          status: 'connected',
          capacity: 50.0,
          precision: 0.01,
          lastWeight: 12.45,
          lastUpdated: new Date(),
          workstationId: 'WS-001',
          firmwareVersion: '1.2.3',
          batteryLevel: 85
        },
        {
          id: '2',
          name: 'Scale WS-002',
          serialNumber: 'SCL-2024-002',
          comPort: 'COM4',
          status: 'connected',
          capacity: 25.0,
          precision: 0.01,
          lastWeight: 0.00,
          lastUpdated: new Date(Date.now() - 30000),
          workstationId: 'WS-002',
          firmwareVersion: '1.2.3',
          batteryLevel: 92
        },
        {
          id: '3',
          name: 'Scale WS-003',
          serialNumber: 'SCL-2024-003',
          comPort: 'COM5',
          status: 'disconnected',
          capacity: 50.0,
          precision: 0.01,
          lastWeight: 0.00,
          lastUpdated: new Date(Date.now() - 300000),
          workstationId: 'WS-003'
        },
        {
          id: '4',
          name: 'Scale WS-004',
          serialNumber: 'SCL-2024-004',
          comPort: 'COM6',
          status: 'error',
          capacity: 25.0,
          precision: 0.01,
          lastWeight: 0.00,
          lastUpdated: new Date(Date.now() - 600000),
          workstationId: 'WS-004'
        }
      ];

      this._scales.set(mockScales);
      this._isLoading.set(false);
    }, 1500);
  }

  /**
   * Scan for new scales
   */
  scanForScales(): void {
    this._isScanning.set(true);

    // Mock scanning process
    setTimeout(() => {
      // Simulate finding new scales
      console.log('Scanning for scales...');
      this._isScanning.set(false);
      this.loadScales();
    }, 3000);
  }

  /**
   * Refresh all scale statuses
   */
  refreshScales(): void {
    this._isRefreshing.set(true);

    // Mock refresh process
    setTimeout(() => {
      this.loadScales();
      this._isRefreshing.set(false);
    }, 2000);
  }

  /**
   * Update status filter
   */
  updateStatusFilter(filter: string): void {
    this._statusFilter.set(filter);
  }

  /**
   * Test scale connection
   */
  testScale(scale: WeightScale): void {
    console.log(`Testing scale ${scale.name}...`);
    // Implement scale testing logic
  }

  /**
   * Calibrate scale
   */
  calibrateScale(scale: WeightScale): void {
    console.log(`Calibrating scale ${scale.name}...`);
    // Update scale status temporarily
    const scales = this._scales();
    const scaleIndex = scales.findIndex(s => s.id === scale.id);
    if (scaleIndex >= 0) {
      scales[scaleIndex].status = 'calibrating';
      this._scales.set([...scales]);

      // Simulate calibration process
      setTimeout(() => {
        scales[scaleIndex].status = 'connected';
        this._scales.set([...scales]);
      }, 5000);
    }
  }

  /**
   * View scale details
   */
  viewDetails(scale: WeightScale): void {
    this._selectedScale.set(scale);
  }

  /**
   * Close details modal
   */
  closeDetails(): void {
    this._selectedScale.set(null);
  }

  /**
   * Edit scale settings
   */
  editScale(scale: WeightScale): void {
    console.log(`Editing scale ${scale.name}...`);
    // Implement scale editing logic
    this.closeDetails();
  }

  // Helper methods
  formatWeight(weight: number | undefined | null): string {
    if (weight == null || isNaN(weight)) {
      return '0.00 kg';
    }
    return `${weight.toFixed(2)} kg`;
  }

  formatDateTime(date: Date): string {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getStatusDisplayName(status: string): string {
    const statusMap: { [key: string]: string } = {
      'connected': 'Connected',
      'disconnected': 'Disconnected',
      'error': 'Error',
      'calibrating': 'Calibrating'
    };
    return statusMap[status] || status;
  }

  getStatusIndicatorClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      'connected': 'bg-green-500',
      'disconnected': 'bg-gray-400',
      'error': 'bg-red-500',
      'calibrating': 'bg-yellow-500 animate-pulse'
    };
    return statusClasses[status] || 'bg-gray-400';
  }

  getStatusClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      'connected': 'text-green-600 font-medium',
      'disconnected': 'text-gray-600',
      'error': 'text-red-600 font-medium',
      'calibrating': 'text-yellow-600 font-medium'
    };
    return statusClasses[status] || 'text-gray-600';
  }
}