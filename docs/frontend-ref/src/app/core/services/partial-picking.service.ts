import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message: string;
}

// Partial Run models matching backend API (camelCase from Rust)
export interface PartialRun {
  runNo: number;
  rowNum: number;
  batchNo: string;
  formulaId: string;
  formulaDesc: string;
  noOfBatches: number;
  status: string | null; // Can be null from database
  recDate: string;
  modifiedDate?: string;
}

// Backend PartialRunSearchResponse (flattened PartialRun + item counts)
export interface PartialRunSearchResponse extends PartialRun {
  totalItems: number;
  completedItems: number;
}

export interface PartialPickedItem {
  runNo: number;
  rowNum: number;
  lineId: number;
  itemKey: string;
  batchNo?: string;
  description?: string;
  location: string;
  unit: string;
  standardQty: number;
  packSize: number;
  toPickedPartialQty: number;
  pickedPartialQty: number;
  minTolerance?: number;
  maxTolerance?: number;
  completionStatus: string;
}

export interface PartialRunDetailsResponse {
  run: PartialRun;
  items: PartialPickedItem[];
  totalItems: number;
  completedItems: number;
}

// Item master lookup
export interface ItemMasterInfo {
  ItemKey: string;
  Description: string;
  UnitOfMeasure: string;
  ToleranceMin?: number; // USER8
  ToleranceMax?: number; // USER9
  StandardQty?: number;
  PackSize?: string;
  Allergens?: string;
}

// Lot lookup
export interface LotInfo {
  LotNo: string;
  ItemKey: string;
  ExpiryDate?: string;
  AvailableQty: number;
  Location: string;
  BinNo?: string;
  Status: string;
}

// Bin lookup
export interface BinInfo {
  BinNo: string;
  Location: string;
  ItemKey: string;
  SOH: number;
  UnitOfMeasure: string;
  Capacity?: number;
}

// Batch lookup
export interface BatchInfo {
  batchNo: string;
  noOfBatches: number;
}

// Search results
export interface SearchResult<T> {
  results: T[];
  totalCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class PartialPickingService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = `${environment.apiUrl}/partial-picking`;

  /**
   * Get partial run details with all picked items
   */
  getPartialRunDetails(runNo: number): Observable<PartialRunDetailsResponse> {
    return this.http.get<ApiResponse<PartialRunDetailsResponse>>(`${this.apiBaseUrl}/runs/${runNo}`)
      .pipe(
        map(response => {
          if (!response.success || !response.data) {
            throw new Error(response.message || 'Failed to fetch partial run details');
          }
          return response.data;
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Search for runs by run number or status with pagination
   * @param query - Search query (run number, formula ID, or description)
   * @param status - Optional status filter (NEW, PRINT, etc.)
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 50, max: 100)
   */
  searchRuns(query: string, status?: string, page: number = 1, limit: number = 50): Observable<SearchResult<PartialRunSearchResponse>> {
    let params = new HttpParams();
    if (query) {
      params = params.set('query', query);
    }
    if (status) {
      params = params.set('status', status);
    }
    // Add pagination parameters (Mobile-Rust pattern)
    params = params.set('page', page.toString());
    params = params.set('limit', Math.min(limit, 100).toString()); // Max 100 items

    return this.http.get<ApiResponse<SearchResult<PartialRunSearchResponse>>>(`${this.apiBaseUrl}/runs/search`, { params })
      .pipe(
        map(response => {
          if (!response.success || !response.data) {
            throw new Error(response.message || 'Failed to search runs');
          }
          return response.data;
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Search for items in INMAST table
   */
  searchItems(query: string): Observable<SearchResult<ItemMasterInfo>> {
    const params = new HttpParams().set('query', query);

    return this.http.get<ApiResponse<SearchResult<ItemMasterInfo>>>(`${this.apiBaseUrl}/items/search`, { params })
      .pipe(
        map(response => {
          if (!response.success || !response.data) {
            throw new Error(response.message || 'Failed to search items');
          }
          return response.data;
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Get item master details including tolerances
   */
  getItemDetails(itemKey: string): Observable<ItemMasterInfo> {
    return this.http.get<ApiResponse<ItemMasterInfo>>(`${this.apiBaseUrl}/items/${itemKey}`)
      .pipe(
        map(response => {
          if (!response.success || !response.data) {
            throw new Error(response.message || 'Failed to fetch item details');
          }
          return response.data;
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Search for lots by item key
   */
  searchLots(itemKey: string, query?: string): Observable<SearchResult<LotInfo>> {
    let params = new HttpParams().set('itemKey', itemKey);
    if (query) {
      params = params.set('query', query);
    }

    return this.http.get<ApiResponse<SearchResult<LotInfo>>>(`${this.apiBaseUrl}/lots/search`, { params })
      .pipe(
        map(response => {
          if (!response.success || !response.data) {
            throw new Error(response.message || 'Failed to search lots');
          }
          return response.data;
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Search for bins by item key
   */
  searchBins(itemKey: string, query?: string): Observable<SearchResult<BinInfo>> {
    let params = new HttpParams().set('itemKey', itemKey);
    if (query) {
      params = params.set('query', query);
    }

    return this.http.get<ApiResponse<SearchResult<BinInfo>>>(`${this.apiBaseUrl}/bins/search`, { params })
      .pipe(
        map(response => {
          if (!response.success || !response.data) {
            throw new Error(response.message || 'Failed to search bins');
          }
          return response.data;
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Get batches for a specific run
   * @param runNo - The run number to fetch batches for
   * @param query - Optional search query to filter batches
   */
  getBatchesForRun(runNo: number, query?: string): Observable<SearchResult<BatchInfo>> {
    let params = new HttpParams();
    if (query) {
      params = params.set('query', query);
    }

    return this.http.get<ApiResponse<SearchResult<BatchInfo>>>(`${this.apiBaseUrl}/runs/${runNo}/batches`, { params })
      .pipe(
        map(response => {
          if (!response.success || !response.data) {
            throw new Error(response.message || 'Failed to fetch batches');
          }
          return response.data;
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Get items for specific batch (batch-by-batch workflow)
   */
  getPartialRunItemsByBatch(runNo: number, batchNo: string): Observable<PartialPickedItem[]> {
    const params = new HttpParams().set('batchNo', batchNo);

    return this.http.get<ApiResponse<PartialPickedItem[]>>(
      `${this.apiBaseUrl}/runs/${runNo}/items/by-batch`,
      { params }
    ).pipe(
      map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Failed to fetch items by batch');
        }
        return response.data;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Search for batches (legacy - use getBatchesForRun instead)
   * @deprecated Use getBatchesForRun for context-specific batch search
   */
  searchBatches(query: string): Observable<SearchResult<string>> {
    const params = new HttpParams().set('query', query);

    return this.http.get<ApiResponse<SearchResult<string>>>(`${this.apiBaseUrl}/batches/search`, { params })
      .pipe(
        map(response => {
          if (!response.success || !response.data) {
            throw new Error(response.message || 'Failed to search batches');
          }
          return response.data;
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Save picked weight for an item
   */
  savePickedWeight(runNo: string, lineId: number, weight: number, lotNo: string, binNo: string): Observable<void> {
    const payload = {
      runNo,
      lineId,
      weight,
      lotNo,
      binNo
    };

    return this.http.post<ApiResponse<void>>(`${this.apiBaseUrl}/items/pick`, payload)
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message || 'Failed to save picked weight');
          }
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Get bin stock on hand (SOH) for an item
   */
  getBinSOH(itemKey: string, binNo: string): Observable<{ soh: number; uom: string }> {
    const params = new HttpParams()
      .set('itemKey', itemKey)
      .set('binNo', binNo);

    return this.http.get<ApiResponse<{ soh: number; uom: string }>>(`${this.apiBaseUrl}/bins/soh`, { params })
      .pipe(
        map(response => {
          if (!response.success || !response.data) {
            throw new Error(response.message || 'Failed to fetch bin SOH');
          }
          return response.data;
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Error handler for HTTP requests
   */
  private handleError(error: any): Observable<never> {
    console.error('PartialPickingService error:', error);
    const errorMessage = error?.error?.message || error?.message || 'An unexpected error occurred';
    return throwError(() => new Error(errorMessage));
  }
}
