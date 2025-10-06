import { Component, EventEmitter, Input, Output, signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PartialPickingService, SearchResult, BatchInfo } from '../../../core/services/partial-picking.service';

@Component({
  selector: 'app-batch-selection-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Modal Overlay -->
    <div *ngIf="isOpen()" class="nwfth-modal-overlay" (click)="onOverlayClick($event)">
      <!-- Modal Dialog -->
      <div class="nwfth-modal-dialog" (click)="$event.stopPropagation()">

        <!-- Modal Header -->
        <div class="nwfth-modal-header">
          <h3 class="nwfth-modal-title">
            <span>📦</span>
            <span>Select Batch Number</span>
          </h3>
          <button type="button" class="nwfth-modal-close-btn" (click)="onClose()" aria-label="Close dialog">
            ✕
          </button>
        </div>

        <!-- Results Section -->
        <div class="nwfth-modal-content">
          <!-- Loading State -->
          <div *ngIf="isSearching()" class="nwfth-loading-state">
            <div class="nwfth-loading-spinner"></div>
            <p class="nwfth-loading-text">Looking up batches...</p>
          </div>

          <!-- Empty State -->
          <div *ngIf="!isSearching() && searchResults().length === 0" class="nwfth-empty-state">
            <div class="nwfth-empty-icon">📦</div>
            <p class="nwfth-empty-text">No batches found for this run</p>
            <p class="nwfth-empty-hint">This run does not have any associated batches</p>
          </div>

          <!-- Results Table -->
          <div *ngIf="!isSearching() && searchResults().length > 0" class="nwfth-modal-table-container">
            <table class="nwfth-modal-table">
              <thead>
                <tr>
                  <th>Batch No</th>
                  <th>No Of Batches</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  *ngFor="let batch of searchResults(); trackBy: trackByBatch"
                  (click)="onSelectBatch(batch)">
                  <td><strong>{{ batch.batchNo }}</strong></td>
                  <td>{{ batch.noOfBatches }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="nwfth-modal-footer">
          <p class="nwfth-footer-info">
            {{ searchResults().length }} batch{{ searchResults().length !== 1 ? 'es' : '' }} found
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
export class BatchSelectionModalComponent {
  @Input() isOpen = signal(false);
  @Input() runNo: number | null = null; // Required: RunNo context for batch search
  @Output() batchSelected = new EventEmitter<BatchInfo>();
  @Output() modalClosed = new EventEmitter<void>();

  private partialPickingService = inject(PartialPickingService);

  // State signals
  searchResults = signal<BatchInfo[]>([]);
  isSearching = signal(false);
  errorMessage = signal<string>('');

  constructor() {
    // Load batches when modal opens
    effect(() => {
      if (this.isOpen()) {
        this.loadBatches();
      }
    });
  }

  private loadBatches() {
    this.performSearch();
  }

  private async performSearch() {
    // Validate RunNo is provided
    if (!this.runNo) {
      console.error('RunNo is required for batch search');
      this.errorMessage.set('RunNo is required to load batches');
      return;
    }

    this.isSearching.set(true);
    this.errorMessage.set('');

    try {
      const response = await this.partialPickingService.getBatchesForRun(this.runNo).toPromise();

      if (response) {
        this.searchResults.set(response.results || []);
      } else {
        this.searchResults.set([]);
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
      this.errorMessage.set('Error fetching batches. Please try again.');
      this.searchResults.set([]);
    } finally {
      this.isSearching.set(false);
    }
  }

  onSelectBatch(batch: BatchInfo) {
    this.batchSelected.emit(batch);
    this.onClose();
  }

  onClose() {
    this.searchResults.set([]);
    this.modalClosed.emit();
  }

  onOverlayClick(event: MouseEvent) {
    this.onClose();
  }

  trackByBatch(index: number, batch: BatchInfo): string {
    return batch.batchNo;
  }
}
