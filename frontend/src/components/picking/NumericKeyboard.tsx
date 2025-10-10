import { useState, useEffect } from 'react'

interface NumericKeyboardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (weight: number) => void
  currentValue?: number
  minValue: number // WeightRangeLow
  maxValue: number // WeightRangeHigh
}

export function NumericKeyboard({
  open,
  onOpenChange,
  onConfirm,
  currentValue,
  minValue,
  maxValue,
}: NumericKeyboardProps) {
  const [inputValue, setInputValue] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  // Initialize input value when modal opens
  useEffect(() => {
    if (open) {
      setInputValue(currentValue ? currentValue.toFixed(4) : '')
      setValidationError(null)
    }
  }, [open, currentValue])

  const handleNumberClick = (num: string) => {
    setValidationError(null)

    // Handle decimal point - only one allowed
    if (num === '.') {
      if (inputValue.includes('.')) return
      setInputValue(inputValue + '.')
      return
    }

    // Add number
    const newValue = inputValue + num

    // Check decimal places limit (max 4)
    if (newValue.includes('.')) {
      const decimalPart = newValue.split('.')[1]
      if (decimalPart && decimalPart.length > 4) {
        setValidationError('Maximum 4 decimal places allowed')
        return
      }
    }

    setInputValue(newValue)
  }

  const handleClear = () => {
    setInputValue('')
    setValidationError(null)
  }

  const handleBackspace = () => {
    setInputValue(inputValue.slice(0, -1))
    setValidationError(null)
  }

  const handleDelete = () => {
    setInputValue(inputValue.slice(0, -1))
    setValidationError(null)
  }

  const handleConfirm = () => {
    // Parse and validate
    const weight = parseFloat(inputValue)

    if (!inputValue || isNaN(weight)) {
      setValidationError('Invalid weight value')
      return
    }

    if (weight < minValue || weight > maxValue) {
      setValidationError(
        `Weight must be between ${minValue.toFixed(3)} - ${maxValue.toFixed(3)} KG`
      )
      return
    }

    // Valid weight - confirm and close
    onConfirm(weight)
    onOpenChange(false)
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (!open) return null

  const numberButtonClass =
    'flex h-16 items-center justify-center rounded-lg bg-gradient-to-br from-[#FFFFFF] to-[#F5F3EF] text-2xl font-bold text-text-primary shadow-button transition-smooth hover:shadow-[0_6px_12px_rgba(0,0,0,0.15)] active:scale-95 active:shadow-[0_2px_6px_rgba(0,0,0,0.1)] border-2 border-border-main'

  const actionButtonClass =
    'flex h-16 items-center justify-center rounded-lg bg-gradient-to-br text-base font-semibold uppercase tracking-wide shadow-button transition-smooth hover:shadow-[0_6px_12px_rgba(0,0,0,0.15)] active:scale-95 active:shadow-[0_2px_6px_rgba(0,0,0,0.1)] border-2'

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div
        className="modal-dialog w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyPress}
      >
        {/* Modal Header - Brown Gradient */}
        <div className="modal-header-brown">
          <h3 className="modal-title">
            <span>⌨️</span>
            <span>Enter Weight Manually</span>
          </h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={handleCancel}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Display Screen */}
        <div className="modal-content space-y-4">
          {/* Weight Display */}
          <div className="rounded-lg border-2 border-border-main bg-bg-main p-4">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-primary/60">
              Weight (KG)
            </div>
            <div
              className={`min-h-[48px] text-3xl font-bold tabular-nums transition-smooth ${
                inputValue
                  ? validationError
                    ? 'text-danger'
                    : 'text-brand-primary'
                  : 'text-text-primary/40'
              }`}
            >
              {inputValue || '0.0000'}
            </div>
            {validationError && (
              <div className="mt-2 rounded-md bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
                {validationError}
              </div>
            )}
          </div>

          {/* Weight Range Info */}
          <div className="rounded-lg bg-gradient-to-br from-[#FFF9EC] to-[#FFEDC4] p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-text-primary/70">Valid Range:</span>
              <span className="font-bold text-brand-primary">
                {minValue.toFixed(3)} - {maxValue.toFixed(3)} KG
              </span>
            </div>
          </div>

          {/* Numeric Keyboard Grid */}
          <div className="grid grid-cols-4 gap-2">
            {/* Row 1: 7 8 9 CLEAR */}
            <button
              type="button"
              onClick={() => handleNumberClick('7')}
              className={numberButtonClass}
            >
              7
            </button>
            <button
              type="button"
              onClick={() => handleNumberClick('8')}
              className={numberButtonClass}
            >
              8
            </button>
            <button
              type="button"
              onClick={() => handleNumberClick('9')}
              className={numberButtonClass}
            >
              9
            </button>
            <button
              type="button"
              onClick={handleClear}
              className={`${actionButtonClass} from-[#FFE5B4] to-[#FFD27F] text-[#8B4513] border-[#D4A574]`}
            >
              Clear
            </button>

            {/* Row 2: 4 5 6 ← */}
            <button
              type="button"
              onClick={() => handleNumberClick('4')}
              className={numberButtonClass}
            >
              4
            </button>
            <button
              type="button"
              onClick={() => handleNumberClick('5')}
              className={numberButtonClass}
            >
              5
            </button>
            <button
              type="button"
              onClick={() => handleNumberClick('6')}
              className={numberButtonClass}
            >
              6
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className={`${actionButtonClass} from-[#E0E0E0] to-[#BDBDBD] text-text-primary border-border-main`}
            >
              ←
            </button>

            {/* Row 3: 1 2 3 ENTER (spans 2 rows) */}
            <button
              type="button"
              onClick={() => handleNumberClick('1')}
              className={numberButtonClass}
            >
              1
            </button>
            <button
              type="button"
              onClick={() => handleNumberClick('2')}
              className={numberButtonClass}
            >
              2
            </button>
            <button
              type="button"
              onClick={() => handleNumberClick('3')}
              className={numberButtonClass}
            >
              3
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className={`${actionButtonClass} row-span-2 from-accent-green to-[#3F7D3E] text-white border-accent-green`}
            >
              Enter
              <br />
              (OK)
            </button>

            {/* Row 4: 0 . DEL */}
            <button
              type="button"
              onClick={() => handleNumberClick('0')}
              className={numberButtonClass}
            >
              0
            </button>
            <button
              type="button"
              onClick={() => handleNumberClick('.')}
              className={numberButtonClass}
            >
              .
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className={`${actionButtonClass} from-[#FFE5E5] to-[#FFCCCC] text-danger border-danger/30`}
            >
              Del
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <div className="modal-footer-left">
            <p className="modal-footer-info text-sm text-text-primary/60">
              Click numbers to enter weight • Press Enter to confirm
            </p>
          </div>

          <button type="button" onClick={handleCancel} className="modal-cancel-btn">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
