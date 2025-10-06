import { Component, EventEmitter, Input, Output, signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { PartialPickingService, BinInfo, SearchResult } from '../../../core/services/partial-picking.service';

@Component({
  selector: 'app-bin-selection-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <!-- Modal Overlay -->
    <div *ngIf="isOpen()" class="nwfth-modal-overlay" (click)="onOverlayClick($event)">
      <!-- Modal Dialog -->
      <div class="nwfth-modal-dialog" (click)="$event.stopPropagation()">

        <!-- Modal Header -->
        <div class="nwfth-modal-header">
          <h3 class="nwfth-modal-title">
            <span>🗄️</span>
            <span>Select Bin (PARTIAL Bins Only)</span>
          </h3>
          <button type="button" class="nwfth-modal-close-btn" (click)="onClose()" aria-label="Close dialog">
            ✕
          </button>
        </div>

        <!-- Item Context Info -->
        <div class="nwfth-item-context" *ngIf="itemKey()">
          <div class="nwfth-context-label">Item:</div>
          <div class="nwfth-context-value">{{ itemKey() }}</div>
          <div class="nwfth-context-info">🚨 PARTIAL bins only</div>
        </div>

        <!-- Search Section -->
        <div class="nwfth-modal-search">
          <div class="nwfth-search-input-wrapper">
            <input
              type="text"
              [formControl]="searchControl"
              placeholder="Search bins by bin number or location (min 2 characters)..."
              class="nwfth-search-input"
              autofocus
            />
            <div class="nwfth-search-icon">
              <div *ngIf="isSearching()" class="nwfth-spinner-small"></div>
              <span *ngIf="!isSearching()">🔍</span>
            </div>
          </div>
        </div>

        <!-- Results Section -->
        <div class="nwfth-modal-content">
          <!-- Loading State -->
          <div *ngIf="isSearching()" class="nwfth-loading-state">
            <div class="nwfth-loading-spinner"></div>
            <p class="nwfth-loading-text">Looking up bins (PARTIAL bins)...</p>
          </div>

          <!-- Empty State -->
          <div *ngIf="!isSearching() && searchResults().length === 0" class="nwfth-empty-state">
            <div class="nwfth-empty-icon">🗄️</div>
            <p class="nwfth-empty-text">{{ hasSearched() ? 'No bins found in PARTIAL bins' : 'Start typing to search bins' }}</p>
            <p class="nwfth-empty-hint">{{ hasSearched() ? 'Try a different search term' : 'Enter at least 2 characters to search' }}</p>
          </div>

          <!-- Results Table -->
          <div *ngIf="!isSearching() && searchResults().length > 0" class="nwfth-modal-table-container">
            <table class="nwfth-modal-table">
              <thead>
                <tr>
                  <th>Bin No</th>
                  <th>Location</th>
                  <th>Item Key</th>
                  <th style="text-align: right;">Stock On Hand</th>
                  <th class="text-center">UOM</th>
                  <th style="text-align: right;">Capacity</th>
                  <th class="text-center">Utilization</th>
                  <th class="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let bin of searchResults(); trackBy: trackByBinNo" [class.low-stock]="isLowStock(bin)">
                  <td><strong>{{ bin.BinNo }}</strong></td>
                  <td>{{ bin.Location }}</td>
                  <td>{{ bin.ItemKey }}</td>
                  <td style="text-align: right;">
                    <strong [class.nwfth-stock-low]="isLowStock(bin)">{{ formatDecimal(bin.SOH, 3) }}</strong>
                  </td>
                  <td class="text-center"><strong>{{ bin.UnitOfMeasure }}</strong></td>
                  <td style="text-align: right;">
                    {{ formatDecimal(bin.Capacity, 3) }}
                  </td>
                  <td class="text-center">
                    <span class="nwfth-utilization-badge" [class.nwfth-utilization-high]="getUtilization(bin) > 80" [class.nwfth-utilization-medium]="getUtilization(bin) > 50 && getUtilization(bin) <= 80" [class.nwfth-utilization-low]="getUtilization(bin) <= 50">
                      {{ formatDecimal(getUtilization(bin), 1) }}%
                    </span>
                  </td>
                  <td class="text-center">
                    <button type="button" (click)="onSelectBin(bin)" class="nwfth-button-select" [disabled]="!bin.SOH || bin.SOH <= 0">
                      {{ !bin.SOH || bin.SOH <= 0 ? 'Empty' : 'Select' }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="nwfth-modal-footer">
          <p class="nwfth-footer-info">
            {{ searchResults().length }} bin{{ searchResults().length !== 1 ? 's' : '' }} found (PARTIAL only)
          </p>
          <button type="button" (click)="onClose()" class="nwfth-cancel-btn">
            Cancel
          </button>
        </div>

      </div>
    </div>
  `,
  styles: [] // All styles moved to apps/frontend/src/styles/components/modals.css
})
export class BinSelectionModalComponent {
  @Input() isOpen = signal(false);
  @Input() itemKey = signal<string>('');
  @Input() initialQuery = '';
  @Output() binSelected = new EventEmitter<BinInfo>();
  @Output() modalClosed = new EventEmitter<void>();

  private partialPickingService = inject(PartialPickingService);

  // State signals
  searchResults = signal<BinInfo[]>([]);
  isSearching = signal(false);
  hasSearched = signal(false);
  errorMessage = signal<string>('');

  // Form controls
  searchControl = new FormControl('');

  constructor() {
    // Setup search with debouncing
    effect(() => {
      this.searchControl.valueChanges.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ).subscribe(query => {
        this.performSearch(query || '');
      });
    });

    // Load initial results when modal opens
    effect(() => {
      if (this.isOpen()) {
        this.loadInitialResults();
      }
    });
  }

  private loadInitialResults() {
    // Set initial query if provided
    if (this.initialQuery) {
      this.searchControl.setValue(this.initialQuery, { emitEvent: false });
    }

    // Perform search
    if (this.initialQuery && this.initialQuery.length >= 2) {
      this.performSearch(this.initialQuery);
    }
  }

  private async performSearch(query: string) {
    const currentItemKey = this.itemKey();

    if (!currentItemKey) {
      console.error('No itemKey provided for bin search');
      this.errorMessage.set('Item key is required for bin search');
      return;
    }

    if (!query || query.length < 2) {
      this.searchResults.set([]);
      this.hasSearched.set(false);
      return;
    }

    this.isSearching.set(true);
    this.errorMessage.set('');
    this.hasSearched.set(true);

    try {
      const response = await this.partialPickingService.searchBins(currentItemKey, query).toPromise();

      if (response) {
        this.searchResults.set(response.results || []);
      } else {
        this.searchResults.set([]);
      }
    } catch (error) {
      console.error('Error searching bins:', error);
      this.errorMessage.set('Error searching bins. Please try again.');
      this.searchResults.set([]);
    } finally {
      this.isSearching.set(false);
    }
  }

  onSelectBin(bin: BinInfo) {
    if (!bin.SOH || bin.SOH <= 0) {
      return; // Don't allow selection of empty bins
    }

    this.binSelected.emit(bin);
    this.onClose();
  }

  onClose() {
    this.searchControl.setValue('', { emitEvent: false });
    this.searchResults.set([]);
    this.hasSearched.set(false);
    this.modalClosed.emit();
  }

  onOverlayClick(event: MouseEvent) {
    this.onClose();
  }

  trackByBinNo(index: number, bin: BinInfo): string {
    return bin.BinNo;
  }

  isLowStock(bin: BinInfo): boolean {
    if (!bin.SOH || bin.SOH === 0) {
      return false; // Empty bins are handled separately
    }

    if (bin.Capacity === undefined) {
      return bin.SOH < 10; // Default threshold if no capacity defined
    }

    return (bin.SOH / bin.Capacity) < 0.2; // Less than 20% capacity
  }

  getUtilization(bin: BinInfo): number {
    if (bin.Capacity === undefined || bin.Capacity === 0) {
      return 0;
    }

    return (bin.SOH / bin.Capacity) * 100;
  }

  /**
   * Format decimal values safely - handles undefined, null, and string inputs
   * Matches Mobile-Rust proven pattern for numeric display
   */
  formatDecimal(value: string | number | undefined | null, decimals: number = 3): string {
    if (value == null) {
      return '0.' + '0'.repeat(decimals);
    }
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(numValue) ? '0.' + '0'.repeat(decimals) : numValue.toFixed(decimals);
  }
}
