import { Component, EventEmitter, Input, Output, signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { PartialPickingService, ItemMasterInfo, SearchResult } from '../../../core/services/partial-picking.service';

@Component({
  selector: 'app-item-selection-modal',
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
            <span>🔍</span>
            <span>Select Item</span>
          </h3>
          <button type="button" class="nwfth-modal-close-btn" (click)="onClose()" aria-label="Close dialog">
            ✕
          </button>
        </div>

        <!-- Search Section -->
        <div class="nwfth-modal-search">
          <div class="nwfth-search-input-wrapper">
            <input
              type="text"
              [formControl]="searchControl"
              placeholder="Search items by item key or description (min 2 characters)..."
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
            <p class="nwfth-loading-text">Looking up items...</p>
          </div>

          <!-- Empty State -->
          <div *ngIf="!isSearching() && searchResults().length === 0" class="nwfth-empty-state">
            <div class="nwfth-empty-icon">📦</div>
            <p class="nwfth-empty-text">{{ hasSearched() ? 'No items found' : 'Start typing to search items' }}</p>
            <p class="nwfth-empty-hint">{{ hasSearched() ? 'Try a different search term' : 'Enter at least 2 characters to search' }}</p>
          </div>

          <!-- Results Table -->
          <div *ngIf="!isSearching() && searchResults().length > 0" class="nwfth-modal-table-container">
            <table class="nwfth-modal-table">
              <thead>
                <tr>
                  <th>Item Key</th>
                  <th>Description</th>
                  <th class="text-center">UOM</th>
                  <th style="text-align: right;">Tol. Min</th>
                  <th style="text-align: right;">Tol. Max</th>
                  <th class="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of searchResults(); trackBy: trackByItemKey">
                  <td><strong>{{ item.ItemKey }}</strong></td>
                  <td [title]="item.Description">{{ item.Description }}</td>
                  <td class="text-center"><strong>{{ item.UnitOfMeasure }}</strong></td>
                  <td style="text-align: right;">
                    {{ item.ToleranceMin !== undefined ? item.ToleranceMin.toFixed(3) : 'N/A' }}
                  </td>
                  <td style="text-align: right;">
                    {{ item.ToleranceMax !== undefined ? item.ToleranceMax.toFixed(3) : 'N/A' }}
                  </td>
                  <td class="text-center">
                    <button type="button" (click)="onSelectItem(item)" class="nwfth-button-select">
                      Select
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
            {{ searchResults().length }} item{{ searchResults().length !== 1 ? 's' : '' }} found
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
export class ItemSelectionModalComponent {
  @Input() isOpen = signal(false);
  @Input() initialQuery = '';
  @Output() itemSelected = new EventEmitter<ItemMasterInfo>();
  @Output() modalClosed = new EventEmitter<void>();

  private partialPickingService = inject(PartialPickingService);

  // State signals
  searchResults = signal<ItemMasterInfo[]>([]);
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
    if (!query || query.length < 2) {
      this.searchResults.set([]);
      this.hasSearched.set(false);
      return;
    }

    this.isSearching.set(true);
    this.errorMessage.set('');
    this.hasSearched.set(true);

    try {
      const response = await this.partialPickingService.searchItems(query).toPromise();

      if (response) {
        this.searchResults.set(response.results || []);
      } else {
        this.searchResults.set([]);
      }
    } catch (error) {
      console.error('Error searching items:', error);
      this.errorMessage.set('Error searching items. Please try again.');
      this.searchResults.set([]);
    } finally {
      this.isSearching.set(false);
    }
  }

  onSelectItem(item: ItemMasterInfo) {
    this.itemSelected.emit(item);
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

  trackByItemKey(index: number, item: ItemMasterInfo): string {
    return item.ItemKey;
  }
}
