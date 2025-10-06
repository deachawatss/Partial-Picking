import { Component, EventEmitter, Input, Output, signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { PartialPickingService, LotInfo, SearchResult } from '../../../core/services/partial-picking.service';

@Component({
  selector: 'app-lot-selection-modal',
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
            <span>📦</span>
            <span>Select Lot (FEFO - First Expiry First Out)</span>
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
              placeholder="Search lots by lot number (min 2 characters)..."
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
            <p class="nwfth-loading-text">Looking up lots (PARTIAL bins)...</p>
          </div>

          <!-- Empty State -->
          <div *ngIf="!isSearching() && searchResults().length === 0" class="nwfth-empty-state">
            <div class="nwfth-empty-icon">📦</div>
            <p class="nwfth-empty-text">{{ hasSearched() ? 'No lots found in PARTIAL bins' : 'Start typing to search lots' }}</p>
            <p class="nwfth-empty-hint">{{ hasSearched() ? 'Try a different search term' : 'Enter at least 2 characters to search' }}</p>
          </div>

          <!-- Results Table -->
          <div *ngIf="!isSearching() && searchResults().length > 0" class="nwfth-modal-table-container">
            <table class="nwfth-modal-table">
              <thead>
                <tr>
                  <th>Lot No</th>
                  <th>Bin No</th>
                  <th>Location</th>
                  <th class="text-center">Expiry Date</th>
                  <th style="text-align: right;">Available Qty</th>
                  <th class="text-center">Status</th>
                  <th class="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let lot of searchResults(); trackBy: trackByLotNo" [class.expired]="isExpired(lot)">
                  <td><strong>{{ lot.LotNo }}</strong></td>
                  <td>{{ lot.BinNo || 'N/A' }}</td>
                  <td>{{ lot.Location }}</td>
                  <td class="text-center">
                    <span [class.nwfth-expiry-warning]="isNearExpiry(lot)" [class.nwfth-expiry-expired]="isExpired(lot)">
                      {{ lot.ExpiryDate ? (lot.ExpiryDate | date:'dd/MM/yyyy') : 'N/A' }}
                    </span>
                  </td>
                  <td style="text-align: right;">
                    <strong>{{ formatDecimal(lot.AvailableQty, 3) }}</strong>
                  </td>
                  <td class="text-center">
                    <span [class.nwfth-status-pass]="lot.Status === 'P'" [class.nwfth-status-blocked]="lot.Status === 'B'" [class.nwfth-status-cleared]="lot.Status === 'C'">
                      {{ getLotStatusLabel(lot.Status) }}
                    </span>
                  </td>
                  <td class="text-center">
                    <button type="button" (click)="onSelectLot(lot)" class="nwfth-button-select" [disabled]="isExpired(lot) || lot.Status === 'B'">
                      {{ isExpired(lot) ? 'Expired' : lot.Status === 'B' ? 'Blocked' : 'Select' }}
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
            {{ searchResults().length }} lot{{ searchResults().length !== 1 ? 's' : '' }} found (FEFO ordered)
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
export class LotSelectionModalComponent {
  @Input() isOpen = signal(false);
  @Input() itemKey = signal<string>('');
  @Input() initialQuery = '';
  @Output() lotSelected = new EventEmitter<LotInfo>();
  @Output() modalClosed = new EventEmitter<void>();

  private partialPickingService = inject(PartialPickingService);

  // State signals
  searchResults = signal<LotInfo[]>([]);
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
      console.error('No itemKey provided for lot search');
      this.errorMessage.set('Item key is required for lot search');
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
      const response = await this.partialPickingService.searchLots(currentItemKey, query).toPromise();

      if (response) {
        this.searchResults.set(response.results || []);
      } else {
        this.searchResults.set([]);
      }
    } catch (error) {
      console.error('Error searching lots:', error);
      this.errorMessage.set('Error searching lots. Please try again.');
      this.searchResults.set([]);
    } finally {
      this.isSearching.set(false);
    }
  }

  onSelectLot(lot: LotInfo) {
    if (this.isExpired(lot) || lot.Status === 'B') {
      return; // Don't allow selection of expired or blocked lots
    }

    this.lotSelected.emit(lot);
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

  trackByLotNo(index: number, lot: LotInfo): string {
    return lot.LotNo;
  }

  isExpired(lot: LotInfo): boolean {
    if (!lot.ExpiryDate) {
      return false;
    }

    const expiryDate = new Date(lot.ExpiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return expiryDate < today;
  }

  isNearExpiry(lot: LotInfo): boolean {
    if (!lot.ExpiryDate || this.isExpired(lot)) {
      return false;
    }

    const expiryDate = new Date(lot.ExpiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return daysUntilExpiry <= 30; // Warning for lots expiring within 30 days
  }

  getLotStatusLabel(status: string): string {
    switch (status) {
      case 'P':
        return 'Pass';
      case 'B':
        return 'Blocked';
      case 'C':
        return 'Cleared';
      default:
        return status;
    }
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
