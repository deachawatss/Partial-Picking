import { Component, EventEmitter, Input, Output, signal, effect, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

import { PartialPickingService, PartialRunSearchResponse, SearchResult } from '../../../core/services/partial-picking.service';

@Component({
  selector: 'app-run-selection-modal',
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
            <span>Select Run Number</span>
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
              placeholder="Search runs by run number, formula ID, or formula description..."
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
            <p class="nwfth-loading-text">Loading available runs...</p>
          </div>

          <!-- Empty State -->
          <div *ngIf="!isSearching() && searchResults().length === 0" class="nwfth-empty-state">
            <div class="nwfth-empty-icon">📋</div>
            <p class="nwfth-empty-text">{{ hasSearched() ? 'No runs found' : 'Start typing to search runs' }}</p>
            <p class="nwfth-empty-hint">{{ hasSearched() ? 'Try a different search term' : 'Enter run number, formula ID, or formula description' }}</p>
          </div>

          <!-- Results Table -->
          <div *ngIf="!isSearching() && searchResults().length > 0" class="nwfth-modal-table-container">
            <table class="nwfth-modal-table">
              <thead>
                <tr>
                  <th>Run No</th>
                  <th>Formula ID</th>
                  <th>Formula Desc</th>
                  <th class="text-center">Status</th>
                  <th class="text-center">Batch Count</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let run of searchResults(); trackBy: trackByRunNo" (click)="onSelectRun(run)">
                  <td><strong>{{ run.runNo }}</strong></td>
                  <td>{{ run.formulaId }}</td>
                  <td [title]="run.formulaDesc">{{ run.formulaDesc }}</td>
                  <td class="text-center">
                    <span [ngClass]="getStatusClass(run.status)" class="nwfth-status-badge">
                      {{ run.status }}
                    </span>
                  </td>
                  <td class="text-center">{{ run.noOfBatches }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Modal Footer with Smart Pagination -->
        <div *ngIf="totalCount() > 0" class="nwfth-modal-footer">
          <div class="nwfth-footer-left">
            <p class="nwfth-footer-info">
              Showing {{ ((currentPage() - 1) * pageSize()) + 1 }} to
              {{ Math.min(currentPage() * pageSize(), totalCount()) }} of {{ totalCount() }} results
            </p>
          </div>

          <!-- Smart Numbered Pagination Controls -->
          <div *ngIf="totalPages > 1" class="nwfth-pagination-controls">
            <button
              type="button"
              (click)="goToPage(currentPage() - 1)"
              [disabled]="currentPage() <= 1"
              class="nwfth-pagination-button"
              aria-label="Previous page">
              ‹ Prev
            </button>

            <div class="nwfth-pagination-pages">
              <button
                *ngFor="let page of getVisiblePages()"
                type="button"
                (click)="goToPage(page)"
                [class.nwfth-pagination-button-active]="page === currentPage()"
                class="nwfth-pagination-button"
                [attr.aria-current]="page === currentPage() ? 'page' : null"
                [attr.aria-label]="'Page ' + page">
                {{ page }}
              </button>
            </div>

            <button
              type="button"
              (click)="goToPage(currentPage() + 1)"
              [disabled]="currentPage() >= totalPages"
              class="nwfth-pagination-button"
              aria-label="Next page">
              Next ›
            </button>
          </div>

          <button type="button" (click)="onClose()" class="nwfth-cancel-btn">
            Cancel
          </button>
        </div>

      </div>
    </div>
  `,
  styles: [] // All styles moved to apps/frontend/src/styles/components/modals.css
})
export class RunSelectionModalComponent implements OnInit, OnDestroy {
  @Input() isOpen = signal(false);
  @Input() initialQuery = '';
  @Input() statusFilter = '';  // Empty = show all (NEW + PRINT)
  @Output() runSelected = new EventEmitter<PartialRunSearchResponse>();
  @Output() modalClosed = new EventEmitter<void>();

  private partialPickingService = inject(PartialPickingService);
  private destroy$ = new Subject<void>(); // For subscription cleanup
  private lastSearchQuery = ''; // Track last query to detect changes

  // State signals
  searchResults = signal<PartialRunSearchResponse[]>([]);
  isSearching = signal(false);
  hasSearched = signal(false);
  errorMessage = signal<string>('');

  // Pagination signals (Mobile-Rust pattern)
  currentPage = signal(1);
  pageSize = signal(10);  // Show 10 runs per page
  totalCount = signal(0);
  hasMore = signal(false);

  // Form controls
  searchControl = new FormControl('');

  // Math reference for template calculations
  Math = Math;

  constructor() {
    // Load initial results when modal opens (with signal writes disabled to prevent infinite loop)
    effect(() => {
      if (this.isOpen()) {
        // Use setTimeout to break out of the effect's signal tracking context
        // This prevents signal writes in performSearch() from retriggering the effect
        setTimeout(() => this.loadInitialResults(), 0);
      }
    }, { allowSignalWrites: false });
  }

  ngOnInit() {
    // Setup search with debouncing and proper cleanup
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      const normalizedQuery = query || '';

      // Only reset to page 1 if the query actually changed (not just pagination)
      if (normalizedQuery !== this.lastSearchQuery) {
        this.currentPage.set(1);
        this.lastSearchQuery = normalizedQuery;
      }

      this.performSearch(normalizedQuery);
    });
  }

  ngOnDestroy() {
    // Clean up all subscriptions
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadInitialResults() {
    // Set initial query if provided
    if (this.initialQuery) {
      this.searchControl.setValue(this.initialQuery, { emitEvent: false });
    }

    // Perform search
    this.performSearch(this.initialQuery || '');
  }

  private performSearch(query: string) {
    // Prevent concurrent searches
    if (this.isSearching()) {
      return;
    }

    this.isSearching.set(true);
    this.errorMessage.set('');
    this.hasSearched.set(true);

    this.partialPickingService.searchRuns(
      query,
      this.statusFilter,
      this.currentPage(),
      this.pageSize()
    ).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        if (response) {
          this.searchResults.set(response.results || []);
          this.totalCount.set(response.totalCount || 0);
          // Check if there are more pages
          this.hasMore.set((this.currentPage() * this.pageSize()) < this.totalCount());
        } else {
          this.searchResults.set([]);
          this.totalCount.set(0);
          this.hasMore.set(false);
        }
        this.isSearching.set(false);
      },
      error: (error) => {
        console.error('Error searching runs:', error);
        this.errorMessage.set('Error searching runs. Please try again.');
        this.searchResults.set([]);
        this.totalCount.set(0);
        this.hasMore.set(false);
        this.isSearching.set(false);
      }
    });
  }

  onSelectRun(run: PartialRunSearchResponse) {
    this.runSelected.emit(run);
    this.onClose();
  }

  onClose() {
    this.searchControl.setValue('', { emitEvent: false });
    this.searchResults.set([]);
    this.hasSearched.set(false);
    this.currentPage.set(1); // Reset pagination on close
    this.totalCount.set(0);
    this.hasMore.set(false);
    this.modalClosed.emit();
  }

  onOverlayClick(event: MouseEvent) {
    this.onClose();
  }

  trackByRunNo(index: number, run: PartialRunSearchResponse): number {
    return run.runNo;
  }

  // Smart numbered pagination methods
  getVisiblePages(): number[] {
    const current = this.currentPage();
    const total = this.totalPages;
    const pages: number[] = [];

    if (total <= 7) {
      // Show all pages if 7 or fewer: [1] [2] [3] [4] [5] [6] [7]
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      // Smart ellipsis for large page counts
      if (current <= 4) {
        // Near start: [1] [2] [3] [4] [5] ... [20]
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push(total);
      } else if (current >= total - 3) {
        // Near end: [1] ... [16] [17] [18] [19] [20]
        pages.push(1);
        for (let i = total - 4; i <= total; i++) pages.push(i);
      } else {
        // Middle: [1] ... [8] [9] [10] ... [20]
        pages.push(1);
        for (let i = current - 1; i <= current + 1; i++) pages.push(i);
        pages.push(total);
      }
    }
    return pages;
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage()) {
      this.currentPage.set(page);
      this.performSearch(this.searchControl.value || '');
    }
  }

  // Legacy methods for backward compatibility (redirects to goToPage)
  nextPage() {
    this.goToPage(this.currentPage() + 1);
  }

  previousPage() {
    this.goToPage(this.currentPage() - 1);
  }

  // Computed total pages
  get totalPages(): number {
    return Math.ceil(this.totalCount() / this.pageSize());
  }

  getStatusClass(status: string | null | undefined): string {
    // Guard against null/undefined status
    if (!status) return 'nwfth-status-default';

    const normalized = status.toUpperCase().replace(/\s+/g, '-');

    if (normalized === 'NEW') return 'nwfth-status-new';
    if (normalized.includes('PROGRESS') || normalized.includes('PENDING') || normalized === 'PRINT') return 'nwfth-status-in-progress';
    if (normalized === 'COMPLETED' || normalized === 'PICKED') return 'nwfth-status-completed';

    return 'nwfth-status-default';
  }

  /**
   * Get today's date formatted for display
   * Returns date in format: Oct 03, 2025
   */
  getTodayDate(): string {
    const today = new Date();
    return today.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    });
  }
}
