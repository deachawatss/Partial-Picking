import { Component, OnInit, OnDestroy, signal, computed, ViewChild, ChangeDetectionStrategy, effect, Injector, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, firstValueFrom } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth.service';
import { LoggerService } from '../../../core/services/logger.service';
import { WeightScaleService, ScaleWeight, ConnectionState, ScaleType } from '../../../core/services/weight-scale.service';
import { PartialPickingService, PartialRunDetailsResponse, SearchResult, ItemMasterInfo, LotInfo, BinInfo, PartialRunSearchResponse, BatchInfo } from '../../../core/services/partial-picking.service';
import { WeightProgressBarComponent, WeightProgressConfig } from '../../../shared/components/weight-progress-bar/weight-progress-bar.component';
import { RunSelectionModalComponent } from '../../../shared/components/run-selection-modal/run-selection-modal.component';
import { BatchSelectionModalComponent } from '../../../shared/components/batch-selection-modal/batch-selection-modal.component';
import { ItemSelectionModalComponent } from '../../../shared/components/item-selection-modal/item-selection-modal.component';
import { LotSelectionModalComponent } from '../../../shared/components/lot-selection-modal/lot-selection-modal.component';
import { BinSelectionModalComponent } from '../../../shared/components/bin-selection-modal/bin-selection-modal.component';

// Interface definitions matching the legacy system
interface BatchTicketPartial {
  item: string;
  batchNo: string;
  partial: number;
  weighted: number;
  balance: number;
  allergens?: string;
}

interface PartialPickingData {
  runNo: number | null;
  batchNo: string;
  itemKey: string;
  description: string;
  formulaId: string;
  formulaDesc: string;
  batches: number;
  recDate: string;
  lotNo: string;
  binNo: string;
  binCapacity: string;
  bagWeight: number;
  weight: number;
  weightRangeMin: number;
  weightRangeMax: number;
  totalNeeded: number;
  remainingQty: number;
  unitOfMeasure: string;
  binSOHDisplay: string;
}

@Component({
  selector: 'app-partial-picking',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, WeightProgressBarComponent, RunSelectionModalComponent, BatchSelectionModalComponent, ItemSelectionModalComponent, LotSelectionModalComponent, BinSelectionModalComponent],
  templateUrl: './partial-picking.component.html',
  styleUrls: ['./partial-picking.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PartialPickingComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  partialPickingForm: FormGroup;

  @ViewChild(WeightProgressBarComponent) progressBar!: WeightProgressBarComponent;

  // Angular 20 Signals for reactive state management
  private _isLoading = signal<boolean>(false);
  private _errorMessage = signal<string>('');
  private _partialPickingData = signal<PartialPickingData>({
    runNo: null,
    batchNo: '',
    itemKey: '',
    description: '',
    formulaId: '',
    formulaDesc: '',
    batches: 0,
    recDate: '',
    lotNo: '',
    binNo: '',
    binCapacity: '',
    bagWeight: 0,
    weight: 0,
    weightRangeMin: 0,
    weightRangeMax: 0,
    totalNeeded: 0,
    remainingQty: 0,
    unitOfMeasure: '',
    binSOHDisplay: ''
  });

  private _batchTicketPartials = signal<BatchTicketPartial[]>([]);
  private _selectedBatchIndex = signal<number | null>(null);

  // Modal state signals
  isRunModalOpen = signal(false);
  isBatchModalOpen = signal(false);
  isItemModalOpen = signal(false);
  isLotModalOpen = signal(false);
  isBinModalOpen = signal(false);

  // Item key signal for modals (writable for two-way binding)
  modalItemKey = signal<string>('');

  // Weight and scale signals
  private _currentWeight = signal<number>(0);
  private _isScaleConnected = signal<boolean>(false);
  private _isWeightStable = signal<boolean>(false);
  private _lastStableWeight = signal<number | null>(null);
  private _stableWeightTimer: ReturnType<typeof setTimeout> | null = null;
  private _selectedScaleType = signal<ScaleType>('small'); // Default to SMALL scale

  // Public readonly signals
  public readonly isLoading = this._isLoading.asReadonly();
  public readonly errorMessage = this._errorMessage.asReadonly();
  public readonly partialPickingData = this._partialPickingData.asReadonly();
  public readonly batchTicketPartials = this._batchTicketPartials.asReadonly();
  public readonly selectedBatchIndex = this._selectedBatchIndex.asReadonly();
  public readonly selectedBatch = computed(() => {
    const index = this._selectedBatchIndex();
    if (index === null) {
      return null;
    }

    const batches = this._batchTicketPartials();
    return batches[index] ?? null;
  });

  // Weight-related public signals
  public readonly currentWeight = this._currentWeight.asReadonly();
  public readonly isScaleConnected = this._isScaleConnected.asReadonly();
  public readonly isWeightStable = this._isWeightStable.asReadonly();
  public readonly selectedScaleType = this._selectedScaleType.asReadonly();

  // Validation for fetch weight button
  public readonly canFetchWeight = computed(() => {
    const weight = this._currentWeight();
    const data = this._partialPickingData();
    return weight >= data.weightRangeMin && weight <= data.weightRangeMax && weight > 0;
  });

  // Computed signals
  public readonly hasError = computed(() => this._errorMessage().length > 0);
  public readonly currentItemKey = computed(() => this._partialPickingData().itemKey);
  public readonly binSohValue = computed(() => {
    const display = (this._partialPickingData().binSOHDisplay ?? '').trim();
    if (!display) {
      return '';
    }

    const parts = display.split(/\s+/).filter(Boolean);
    return parts[0] ?? '';
  });

  public readonly binSohUnit = computed(() => {
    const data = this._partialPickingData();
    const display = (data.binSOHDisplay ?? '').trim();
    if (!display) {
      return data.unitOfMeasure || '';
    }

    const parts = display.split(/\s+/).filter(Boolean);
    if (parts.length <= 1) {
      return data.unitOfMeasure || '';
    }

    return parts.slice(1).join(' ');
  });

  // Progress bar configuration computed signal
  public readonly progressConfig = computed((): WeightProgressConfig => {
    const data = this._partialPickingData();
    return {
      itemName: data.itemKey || 'Unknown Item',
      itemDescription: data.description || '',
      targetWeight: data.bagWeight || 25,
      toleranceMin: data.weightRangeMin || 19,
      toleranceMax: data.weightRangeMax || 21,
      unit: data.unitOfMeasure || 'KG',
      showPercentage: true,
      showToleranceBands: true,
      animateProgress: true
    };
  });

  private injector = inject(Injector);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private logger: LoggerService,
    private weightScaleService: WeightScaleService,
    private partialPickingService: PartialPickingService
  ) {
    this.partialPickingForm = this.createForm();
  }

  ngOnInit(): void {
    // Initialize form with current data
    this.updateFormValues();

    // Only load data if we have a valid run number
    // Otherwise, user must select a run via the Run Selection modal
    const currentRunNo = this._partialPickingData().runNo;
    if (currentRunNo) {
      this.loadPartialPickingData();
    } else {
      this.logger.info('No run number specified - waiting for user to select a run');
    }

    // Set up WebSocket connections and weight monitoring
    this.setupWeightScaleConnection();
    this.setupWeightStabilityMonitoring();
    this.setupAutoSave();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    // Clean up any pending timers
    if (this._stableWeightTimer) {
      clearTimeout(this._stableWeightTimer);
    }
  }

  /**
   * Create reactive form matching the legacy interface
   */
  private createForm(): FormGroup {
    return this.fb.group({
      runNo: ['', Validators.required],
      batchNo: ['', Validators.required],
      itemKey: ['', Validators.required],
      unitOfMeasure: [{ value: '', disabled: true }],
      description: [''],
      lotNo: [''],
      binNo: [''],
      bagWeight: [0, [Validators.min(0)]],
      weight: [0, [Validators.min(0)]],
      weightRangeMin: [0],
      weightRangeMax: [0],
      totalNeeded: [0],
      remainingQty: [0]
    });
  }

  /**
   * Update form values from current data
   */
  private updateFormValues(): void {
    const data = this._partialPickingData();
    this.partialPickingForm.patchValue({
      runNo: data.runNo ?? '',
      batchNo: data.batchNo,
      itemKey: data.itemKey,
      unitOfMeasure: data.unitOfMeasure,
      description: data.description,
      lotNo: data.lotNo,
      binNo: data.binNo,
      bagWeight: data.bagWeight,
      weight: data.weight,
      weightRangeMin: data.weightRangeMin,
      weightRangeMax: data.weightRangeMax,
      totalNeeded: data.totalNeeded,
      remainingQty: data.remainingQty
    });
  }

  /**
   * Load partial picking data from API
   */
  private loadPartialPickingData(): void {
    const runNo = this._partialPickingData().runNo;

    if (!runNo) {
      this.logger.warn('No run number available to load partial picking data');
      return;
    }

    this._isLoading.set(true);
    this._errorMessage.set('');

    this.partialPickingService.getPartialRunDetails(runNo)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: PartialRunDetailsResponse) => {
          // Map API response to component state
          if (response.run && response.items && response.items.length > 0) {
            const firstItem = response.items[0];

            this._partialPickingData.set({
              runNo: response.run.runNo,
              batchNo: response.run.batchNo,
              itemKey: firstItem.itemKey,
              description: firstItem.description || '',
              formulaId: response.run.formulaId,
              formulaDesc: response.run.formulaDesc,
              batches: response.run.noOfBatches,
              recDate: response.run.recDate,
              lotNo: '', // TODO: Load from lot selection
              binNo: '', // TODO: Load from bin selection
              binCapacity: '',
              bagWeight: firstItem.toPickedPartialQty,
              weight: firstItem.pickedPartialQty,
              weightRangeMin: firstItem.minTolerance || 0,
              weightRangeMax: firstItem.maxTolerance || 0,
              totalNeeded: firstItem.toPickedPartialQty,
              remainingQty: firstItem.toPickedPartialQty - firstItem.pickedPartialQty,
              unitOfMeasure: firstItem.unit,
              binSOHDisplay: ''
            });

            // Map items to batch ticket partials with safe defaults
            const batchPartials = response.items.map(item => ({
              item: item.itemKey || '',
              batchNo: item.batchNo || '',
              partial: item.toPickedPartialQty ?? 0,
              weighted: item.pickedPartialQty ?? 0,
              balance: (item.toPickedPartialQty - item.pickedPartialQty),
              allergens: undefined // TODO: Get allergens from INMAST if needed
            }));

            this._batchTicketPartials.set(batchPartials);

            // TODO: Bin SOH loading if needed (binNo not in current model)
            // if (firstItem.binNo) {
            //   this.loadBinSOH(firstItem.itemKey, firstItem.binNo);
            // }

            this.syncSelectedBatch();
            this.updateFormValues();
          }

          this._isLoading.set(false);
        },
        error: (error: Error) => {
          this.logger.error('Failed to load partial picking data', error);
          this._errorMessage.set(error.message || 'Failed to load partial picking data');
          this._isLoading.set(false);
        }
      });
  }

  /**
   * Load items for specific batch (batch-by-batch workflow)
   */
  private async loadPartialPickingDataByBatch(runNo: number, batchNo: string): Promise<void> {
    this._isLoading.set(true);
    this._errorMessage.set('');

    try {
      const items = await firstValueFrom(this.partialPickingService.getPartialRunItemsByBatch(runNo, batchNo));

      if (items && items.length > 0) {
        const firstItem = items[0];

        // Update batch ticket partials with filtered items
        const batches: BatchTicketPartial[] = items.map(item => ({
          item: item.itemKey,
          batchNo: item.batchNo || batchNo,
          partial: item.toPickedPartialQty || 0,
          weighted: item.pickedPartialQty || 0,
          balance: (item.toPickedPartialQty - item.pickedPartialQty) || 0,
          allergens: undefined // TODO: Get allergens from INMAST if needed
        }));

        this._batchTicketPartials.set(batches);

        // Auto-select first item
        if (batches.length > 0) {
          this._selectedBatchIndex.set(0);
          // TODO: Load item details for tolerance/allergen info
          // this.loadItemDetails(firstItem.itemKey);
        }
      } else {
        this._batchTicketPartials.set([]);
        this._selectedBatchIndex.set(null);
      }
    } catch (error) {
      this.logger.error('Failed to load items by batch:', error);
      this._errorMessage.set('Failed to load items for this batch');
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Load bin stock on hand (SOH) for display
   */
  private loadBinSOH(itemKey: string, binNo: string): void {
    this.partialPickingService.getBinSOH(itemKey, binNo)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sohData) => {
          const currentData = this._partialPickingData();
          this._partialPickingData.set({
            ...currentData,
            binSOHDisplay: `${sohData.soh.toFixed(4)} ${sohData.uom}`
          });
        },
        error: (error) => {
          this.logger.error('Failed to load bin SOH', error);
        }
      });
  }

  /**
   * Handle search/lookup button clicks
   */
  onLookup(field: string): void {
    this.logger.debug(`Looking up ${field}...`);

    switch (field) {
      case 'runNo':
        this.searchRunNo();
        break;
      case 'batchNo':
        this.searchBatchNo();
        break;
      case 'itemKey':
        this.searchItemKey();
        break;
      case 'lotNo':
        this.searchLotNo();
        break;
      case 'binNo':
        this.searchBinNo();
        break;
      default:
        this.logger.warn(`Unknown lookup field: ${field}`);
    }
  }

  /**
   * Search and select Run No
   */
  private searchRunNo(): void {
    // Open the run selection modal
    this.isRunModalOpen.set(true);
  }

  /**
   * Handle run selection from modal
   */
  async onRunSelected(run: PartialRunSearchResponse): Promise<void> {
    this.partialPickingForm.patchValue({ runNo: run.runNo });
    this._partialPickingData.update(data => ({
      ...data,
      runNo: run.runNo,
      formulaId: run.formulaId,
      formulaDesc: run.formulaDesc,
      batches: run.noOfBatches,
      recDate: run.recDate
    }));

    // AUTO-SELECT MINIMUM BATCH
    try {
      const batchesResponse = await firstValueFrom(this.partialPickingService.getBatchesForRun(run.runNo));

      if (batchesResponse && batchesResponse.results.length > 0) {
        // Batches are already sorted ASC by backend, so first = minimum
        const minBatch = batchesResponse.results[0];

        // Auto-populate batch fields
        this.partialPickingForm.patchValue({
          batchNo: minBatch.batchNo,
          batches: minBatch.noOfBatches
        });

        this._partialPickingData.update(data => ({
          ...data,
          batchNo: minBatch.batchNo,
          batches: minBatch.noOfBatches
        }));

        // LOAD ITEMS FOR THIS BATCH ONLY
        await this.loadPartialPickingDataByBatch(run.runNo, minBatch.batchNo);
      } else {
        // Fallback: Load all items if no batches found
        this.loadPartialPickingData();
      }
    } catch (error) {
      this.logger.error('Failed to auto-select batch:', error);
      // Fallback: Load all items on error
      this.loadPartialPickingData();
    }

    this.isRunModalOpen.set(false);
  }

  /**
   * Handle run modal closed
   */
  onRunModalClosed(): void {
    this.isRunModalOpen.set(false);
  }

  /**
   * Search and select Batch No
   */
  private searchBatchNo(): void {
    // Open the batch selection modal
    this.isBatchModalOpen.set(true);
  }

  /**
   * Handle batch selection from modal
   */
  async onBatchSelected(batch: BatchInfo): Promise<void> {
    this.partialPickingForm.patchValue({ batchNo: batch.batchNo });
    this._partialPickingData.update(data => ({
      ...data,
      batchNo: batch.batchNo,
      batches: batch.noOfBatches
    }));

    // RELOAD ITEMS FOR NEW BATCH
    const runNo = this._partialPickingData().runNo;
    if (runNo) {
      await this.loadPartialPickingDataByBatch(runNo, batch.batchNo);
    }

    this.isBatchModalOpen.set(false);
  }

  /**
   * Handle batch modal closed
   */
  onBatchModalClosed(): void {
    this.isBatchModalOpen.set(false);
  }

  /**
   * Search and select Item Key
   */
  private searchItemKey(): void {
    // Open the item selection modal
    this.isItemModalOpen.set(true);
  }

  /**
   * Handle item selection from modal
   */
  onItemSelected(item: ItemMasterInfo): void {
    this.selectItem(item);
    this.isItemModalOpen.set(false);
  }

  /**
   * Handle item modal closed
   */
  onItemModalClosed(): void {
    this.isItemModalOpen.set(false);
  }

  /**
   * Select and populate item details
   */
  private selectItem(item: ItemMasterInfo): void {
    this.partialPickingForm.patchValue({
      itemKey: item.ItemKey,
      description: item.Description,
      unitOfMeasure: item.UnitOfMeasure
    });

    this._partialPickingData.update(data => ({
      ...data,
      itemKey: item.ItemKey,
      description: item.Description,
      unitOfMeasure: item.UnitOfMeasure,
      weightRangeMin: item.ToleranceMin || 0,
      weightRangeMax: item.ToleranceMax || 0
    }));

    this.updateFormValues();
  }

  /**
   * Search and select Lot No
   */
  private searchLotNo(): void {
    const itemKey = this.partialPickingForm.get('itemKey')?.value;

    if (!itemKey) {
      this._errorMessage.set('Please select an item first');
      return;
    }

    // Sync modal item key and open the lot selection modal
    this.modalItemKey.set(itemKey);
    this.isLotModalOpen.set(true);
  }

  /**
   * Handle lot selection from modal
   */
  onLotSelected(lot: LotInfo): void {
    this.selectLot(lot);
    this.isLotModalOpen.set(false);
  }

  /**
   * Handle lot modal closed
   */
  onLotModalClosed(): void {
    this.isLotModalOpen.set(false);
  }

  /**
   * Select and populate lot details
   */
  private selectLot(lot: LotInfo): void {
    this.partialPickingForm.patchValue({
      lotNo: lot.LotNo,
      binNo: lot.BinNo || ''
    });

    this._partialPickingData.update(data => ({
      ...data,
      lotNo: lot.LotNo,
      binNo: lot.BinNo || ''
    }));

    // Load bin SOH if bin is available
    if (lot.BinNo) {
      this.loadBinSOH(lot.ItemKey, lot.BinNo);
    }

    this.updateFormValues();
  }

  /**
   * Search and select Bin No
   */
  private searchBinNo(): void {
    const itemKey = this.partialPickingForm.get('itemKey')?.value;

    if (!itemKey) {
      this._errorMessage.set('Please select an item first');
      return;
    }

    // Sync modal item key and open the bin selection modal
    this.modalItemKey.set(itemKey);
    this.isBinModalOpen.set(true);
  }

  /**
   * Handle bin selection from modal
   */
  onBinSelected(bin: BinInfo): void {
    this.selectBin(bin);
    this.isBinModalOpen.set(false);
  }

  /**
   * Handle bin modal closed
   */
  onBinModalClosed(): void {
    this.isBinModalOpen.set(false);
  }

  /**
   * Select and populate bin details
   */
  private selectBin(bin: BinInfo): void {
    this.partialPickingForm.patchValue({
      binNo: bin.BinNo
    });

    this._partialPickingData.update(data => ({
      ...data,
      binNo: bin.BinNo,
      binSOHDisplay: `${bin.SOH.toFixed(4)} ${bin.UnitOfMeasure}`
    }));

    this.updateFormValues();
  }

  /**
   * Handle calculator button click for bag weight
   */
  onCalculateBagWeight(): void {
    this.logger.debug('Opening bag weight calculator...');
    // In real implementation, this would open calculator dialog
  }

  /**
   * Set up WebSocket connection to weight scale service
   */
  private setupWeightScaleConnection(): void {
    // Monitor WebSocket connection health
    toObservable(this.weightScaleService.connectionState, { injector: this.injector })
      .pipe(takeUntil(this.destroy$))
      .subscribe((state: ConnectionState) => {
        this.logger.debug('[PartialPicking] connection state', state);
        if (state !== ConnectionState.CONNECTED) {
          this._isScaleConnected.set(false);
        }
      });

    // Track reported scale status so we only flip to connected when the bridge confirms it
    toObservable(this.weightScaleService.scaleStatus, { injector: this.injector })
      .pipe(takeUntil(this.destroy$))
      .subscribe(statuses => {
        this.logger.debug('[PartialPicking] scale statuses', statuses);
        const anyConnected = statuses.some(status => status.connected);
        this._isScaleConnected.set(anyConnected);
      });

    // Subscribe to real-time weight updates using toObservable
    toObservable(this.weightScaleService.currentWeight, { injector: this.injector })
      .pipe(takeUntil(this.destroy$))
      .subscribe((weightData: ScaleWeight | null) => {
        if (weightData) {
          this.handleWeightUpdate(weightData);
        }
      });
  }

  /**
   * Handle incoming weight updates from WebSocket
   */
  private handleWeightUpdate(weightData: ScaleWeight): void {
    const newWeight = Number(weightData.weight.toFixed(4));

    // Update current weight signal
    this._currentWeight.set(newWeight);
    this._isWeightStable.set(weightData.stable);

    // Update form field
    this.partialPickingForm.patchValue({ weight: newWeight }, { emitEvent: false });

    // Update partial picking data
    const currentData = this._partialPickingData();
    this._partialPickingData.set({
      ...currentData,
      weight: newWeight
    });

    this.logger.debug(`Weight update: ${newWeight} ${weightData.unit} (stable: ${weightData.stable})`);
  }

  /**
   * Set up weight stability monitoring with debouncing
   */
  private setupWeightStabilityMonitoring(): void {
    toObservable(this.currentWeight, { injector: this.injector })
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged(),
        debounceTime(100) // Wait for 100ms of no changes - optimized for real-time response
      )
      .subscribe((weight: number) => {
        this.checkWeightStability(weight);
      });
  }

  /**
   * Check if weight is stable and in acceptable range
   */
  private checkWeightStability(weight: number): void {
    const config = this.progressConfig();
    const isInRange = weight >= config.toleranceMin && weight <= config.toleranceMax;

    if (this._stableWeightTimer) {
      clearTimeout(this._stableWeightTimer);
    }

    if (isInRange && weight > 0) {
      // Start stability timer
      this._stableWeightTimer = setTimeout(() => {
        if (this.isWeightStable() && this.isWeightInRange()) {
          this._lastStableWeight.set(weight);
          this.logger.info(`Weight stabilized at: ${weight} ${config.unit}`);
        }
      }, 2000); // 2 seconds of stability required
    }
  }

  /**
   * Set up auto-save functionality when weight is stable and in range
   */
  private setupAutoSave(): void {
    toObservable(this._lastStableWeight, { injector: this.injector })
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged()
      )
      .subscribe((stableWeight: number | null) => {
        if (stableWeight !== null) {
          this.autoSaveWeight(stableWeight);
        }
      });
  }

  /**
   * Auto-save weight when it's stable and in acceptable range
   */
  private autoSaveWeight(weight: number): void {
    if (!this.isWeightInRange()) return;

    this.logger.info(`Auto-saving stable weight: ${weight}`);

    // Trigger success animation
    if (this.progressBar) {
      this.progressBar.triggerSuccessAnimation();
    }

    // Save the weight (in real implementation, this would call API)
    this.onSave();

    // Play success sound (if available)
    this.playSuccessSound();
  }

  /**
   * Play success sound when weight is captured
   */
  private playSuccessSound(): void {
    // In a real implementation, you might play a sound
    try {
      const audio = new Audio('assets/sounds/success.mp3');
      audio.volume = 0.3;
      audio.play().catch(e => this.logger.debug('Could not play success sound', e));
    } catch (e) {
      this.logger.debug('Success sound not available');
    }
  }

  /**
   * Handle Fetch Weight button click (capture current stable weight)
   */
  onFetchWeight(): void {
    if (!this.canFetchWeight()) {
      this.logger.warn('Cannot fetch weight: not in tolerance range');
      return;
    }

    this.logger.debug('Capturing current weight...');
    const currentWeight = this._currentWeight();

    // Capture the current weight and trigger save
    this.logger.info(`Weight captured: ${currentWeight} KG`);

    // Trigger success animation
    if (this.progressBar) {
      this.progressBar.triggerSuccessAnimation();
    }

    // Save the weight (in real implementation, this would call API)
    this.onSave();

    // Play success sound (if available)
    this.playSuccessSound();
  }

  /**
   * Handle action button clicks
   */
  onAddLot(): void {
    this.logger.debug('Add Lot clicked');
    // In real implementation, this would open lot selection dialog
  }

  onViewLots(): void {
    this.logger.debug('View Lots clicked');
    // In real implementation, this would show lots management interface
  }

  onPrint(): void {
    this.logger.debug('Print clicked');
    // In real implementation, this would generate and print labels
  }

  onSave(): void {
    if (!this.partialPickingForm.valid) {
      alert('Please fill in all required fields');
      return;
    }

    const data = this._partialPickingData();
    const weight = this._currentWeight();

    if (weight <= 0) {
      alert('No weight captured. Please capture weight before saving.');
      return;
    }

    if (!this.isWeightInRange()) {
      alert('Weight is out of tolerance range. Please adjust before saving.');
      return;
    }

    const selectedBatch = this.selectedBatch();
    if (!selectedBatch) {
      alert('No batch selected');
      return;
    }

    this._isLoading.set(true);
    this._errorMessage.set('');

    // Assuming LineId is the index in the batch table (in real implementation, this comes from API)
    const lineId = this._selectedBatchIndex() ?? 0;

    // Guard against null runNo
    if (!data.runNo) {
      this._errorMessage.set('No run selected. Please select a run first.');
      this._isLoading.set(false);
      return;
    }

    this.partialPickingService.savePickedWeight(
      data.runNo.toString(),
      lineId,
      weight,
      data.lotNo,
      data.binNo
    )
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: () => {
        this._isLoading.set(false);
        this.logger.info('Data saved successfully');

        // Reload data to get updated quantities
        this.loadPartialPickingData();

        // Show success message
        alert('Weight saved successfully');
      },
      error: (error: Error) => {
        this._isLoading.set(false);
        this._errorMessage.set(`Save failed: ${error.message}`);
        alert(`Failed to save: ${error.message}`);
      }
    });
  }

  onExit(): void {
    // Logout and show confirmation dialog
    if (confirm('Are you sure you want to logout? Any unsaved changes will be lost.')) {
      this.authService.logout();
    }
  }

  /**
   * Handle table row selection
   */
  onSelectBatchRow(index: number): void {
    const batches = this._batchTicketPartials();
    const selected = batches[index];

    if (!selected) {
      return;
    }

    this._selectedBatchIndex.set(index);
    this._partialPickingData.update(data => ({
      ...data,
      itemKey: selected.item ?? '',
      batchNo: selected.batchNo ?? '',
      bagWeight: selected.partial ?? 0,
      weight: selected.weighted ?? 0,
      remainingQty: selected.balance ?? 0
    }));

    this.updateFormValues();
  }

  isBatchRowSelected(index: number): boolean {
    return this._selectedBatchIndex() === index;
  }

  /**
   * Get current user display name
   */
  getCurrentUser(): string {
    return this.authService.userDisplayName() || 'Unknown User';
  }

  /**
   * Format number for display with null/undefined safety
   */
  formatNumber(value: number | undefined | null): string {
    // Guard against null/undefined values
    if (value === null || value === undefined || isNaN(value)) {
      return '0.0000';
    }
    return value.toFixed(4);
  }

  /**
   * Check if current weight is within acceptable range
   */
  isWeightInRange(): boolean {
    const currentWeight = this._currentWeight();
    const config = this.progressConfig();
    return currentWeight >= config.toleranceMin && currentWeight <= config.toleranceMax && currentWeight > 0;
  }

  /**
   * Check if weight is in range (using form value for backward compatibility)
   */
  isFormWeightInRange(): boolean {
    const data = this._partialPickingData();
    const weight = this.partialPickingForm.get('weight')?.value || 0;
    return weight >= data.weightRangeMin && weight <= data.weightRangeMax;
  }

  /**
   * Get weight status class for styling (backward compatibility)
   */
  getWeightStatusClass(): string {
    if (this.isFormWeightInRange()) {
      return 'weight-in-range';
    }
    return 'weight-out-of-range';
  }

  /**
   * Get scale connection status for display
   */
  getConnectionStatusText(): string {
    const isConnected = this._isScaleConnected();
    const connectionState = this.weightScaleService.connectionState();

    if (isConnected) {
      return 'Scale Connected';
    } else {
      switch (connectionState) {
        case 'connecting':
          return 'Connecting to Scale...';
        case 'reconnecting':
          return 'Reconnecting...';
        case 'error':
          return 'Scale Connection Error';
        default:
          return 'Scale Disconnected';
      }
    }
  }

  /**
   * Manual reconnect to scale
   */
  onReconnectScale(): void {
    this.logger.info('Manual scale reconnection requested');
    this.weightScaleService.reconnect();
  }

  /**
   * Switch between SMALL and BIG scales
   */
  onSwitchScale(scaleType: ScaleType): void {
    this.logger.info(`Switching to ${scaleType.toUpperCase()} scale`);
    this._selectedScaleType.set(scaleType);
    this.weightScaleService.switchScale(scaleType);
  }

  /**
   * Tare the scale
   */
  onTareScale(): void {
    this.logger.debug('Taring scale...');
    this.weightScaleService.tare();
  }

  /**
   * Calibrate the scale
   */
  onCalibrateScale(): void {
    this.logger.debug('Calibrating scale...');
    this.weightScaleService.calibrate();
  }

  /**
   * Get current weight for display
   */
  getCurrentWeightDisplay(): string {
    const weight = this._currentWeight();
    return weight > 0 ? weight.toFixed(4) : '0.0000';
  }

  /**
   * Get weight status message for user guidance
   */
  getWeightStatusMessage(): string {
    if (!this._isScaleConnected()) {
      return 'Scale not connected. Check hardware connection.';
    }

    const weight = this._currentWeight();
    const config = this.progressConfig();

    if (weight === 0) {
      return 'Place item on scale to begin weighing.';
    }

    if (weight < config.toleranceMin) {
      const needed = config.toleranceMin - weight;
      return `Add ${needed.toFixed(3)} ${config.unit} more material.`;
    }

    if (weight > config.toleranceMax) {
      const excess = weight - config.toleranceMax;
      return `Remove ${excess.toFixed(3)} ${config.unit} excess material.`;
    }

    if (this._isWeightStable()) {
      return 'Weight captured successfully!';
    } else {
      return 'Weight in range - waiting for stability...';
    }
  }

  /**
   * Get current production date in DD/MM/YYYY format
   */
  getCurrentProductionDate(): string {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private syncSelectedBatch(): void {
    const batches = this._batchTicketPartials();

    if (batches.length === 0) {
      this._selectedBatchIndex.set(null);
      return;
    }

    const currentData = this._partialPickingData();
    const matchedIndex = batches.findIndex(batch => batch.item === currentData.itemKey && batch.batchNo === currentData.batchNo);
    const resolvedIndex = matchedIndex >= 0 ? matchedIndex : 0;
    const resolvedBatch = batches[resolvedIndex];

    // Guard against undefined batch
    if (!resolvedBatch) {
      this._selectedBatchIndex.set(null);
      return;
    }

    this._selectedBatchIndex.set(resolvedIndex);
    this._partialPickingData.update(data => ({
      ...data,
      itemKey: resolvedBatch.item ?? '',
      batchNo: resolvedBatch.batchNo ?? '',
      bagWeight: resolvedBatch.partial ?? 0,
      weight: resolvedBatch.weighted ?? 0,
      remainingQty: resolvedBatch.balance ?? 0
    }));
  }
}
