/**
 * Batch Summary Print Utility
 *
 * Generates 4×4" thermal labels for batch summaries matching the printsum.png format
 *
 * Label format:
 * - 4×4 inches (384pt × 384pt @ 96 DPI)
 * - Header: Timestamp, Product info (Item/Desc), Batch/Run numbers
 * - Production date and page numbers
 * - Table with columns: ItemNo, BIN, Lot-No, QTY UM (KG)
 * - One label per batch
 */

import type { BatchSummaryResponse, BatchSummaryDTO } from '@/types/api'

/**
 * Print batch summary labels
 *
 * Opens a new window with formatted labels and triggers browser print dialog
 * Labels are optimized for 4×4" thermal printers with proper page breaks
 *
 * @param summary - Batch summary data from API
 */
export function printBatchSummary(summary: BatchSummaryResponse): void {
  // Generate HTML for all batches
  const html = generateBatchSummaryHTML(summary)

  // Open print window
  const printWindow = window.open('', '_blank', 'width=800,height=600')

  if (!printWindow) {
    console.error('Failed to open print window - popup blocker may be enabled')
    alert('Failed to open print window. Please allow popups for this site.')
    return
  }

  // Write HTML to print window
  printWindow.document.write(html)
  printWindow.document.close()

  // Wait for content to load, then print
  printWindow.onload = () => {
    printWindow.focus()
    printWindow.print()
  }
}

/**
 * Generate complete HTML document for batch summary printing
 *
 * Includes CSS for 4×4" thermal label sizing and styling
 *
 * @param summary - Batch summary data
 * @returns Complete HTML document string
 */
function generateBatchSummaryHTML(summary: BatchSummaryResponse): string {
  const batchLabelsHTML = summary.batches.map(batch => generateBatchLabelHTML(batch)).join('\n')

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Batch Summary Print</title>
  <style>
    /* Print styles for 4×4" thermal labels */
    @page {
      size: 4in 4in;
      margin: 0.25in;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 10pt;
      line-height: 1.0;
      color: #000;
      background: #fff;
      font-weight: bold;
    }

    /* Each batch on separate page */
    .batch-label {
      width: 3.5in;
      height: 3.5in;
      page-break-after: always;
      display: flex;
      flex-direction: column;
      padding: 0.1in;
    }

    .batch-label:last-child {
      page-break-after: auto;
    }

    /* Header section */
    .header {
      padding-bottom: 0.01in;
      margin-bottom: 0.02in;
    }

    .timestamp {
      font-size: 8pt;
      font-weight: bold;
      text-align: right;
      margin-bottom: 0.01in;
    }

    .product-info {
      font-size: 9pt;
      margin-bottom: 0.01in;
    }

    .product-info strong {
      font-weight: bold;
    }

    .run-info {
      font-size: 7.5pt;
    }

    /* Items table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      flex: 1;
      margin: 0;
    }

    .items-table th,
    .items-table td {
      border: none;
      border-bottom: 1px solid #000;
      padding: 0;
      padding-left: 0.02in;
      padding-right: 0.02in;
      text-align: left;
      font-size: 7pt;
      line-height: 1.0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: bold;
    }

    .items-table thead tr {
      border-top: 1px solid #000;
    }

    .items-table th {
      background-color: #fff;
      color: #000;
      font-weight: bold;
      text-align: left;
    }

    .items-table td.qty,
    .items-table th.qty {
      text-align: right;
      font-family: 'Courier New', Courier, monospace;
      font-weight: bold;
    }

    .items-table td.um,
    .items-table th.um {
      text-align: left;
    }

    /* Column widths */
    .col-item {
      width: 18%;
    }

    .col-bin {
      width: 18%;
    }

    .col-lot {
      width: 30%;
    }

    .col-qty {
      width: 20%;
    }

    .col-um {
      width: 14%;
    }

    /* Print-specific rules */
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  ${batchLabelsHTML}
</body>
</html>
`
}

/**
 * Generate HTML for a single batch label
 *
 * Matches the printsum.png reference format with:
 * - Timestamp header
 * - Product info (Item Key / Description)
 * - Batch and Run numbers
 * - Production date and page numbers
 * - Items table with columns: ItemNo, BIN, Lot-No, QTY UM
 *
 * @param batch - Single batch data
 * @returns HTML string for one batch label
 */
function generateBatchLabelHTML(batch: BatchSummaryDTO): string {
  const now = new Date()
  const timestamp = now.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const itemsHTML = batch.items
    .map(
      item => `
    <tr>
      <td class="col-item">${escapeHtml(item.itemKey)}</td>
      <td class="col-bin">${escapeHtml(item.binNo)}</td>
      <td class="col-lot">${escapeHtml(item.lotNo)}</td>
      <td class="col-qty qty">${formatQty(item.qtyKg)}</td>
      <td class="col-um um">KG</td>
    </tr>
  `
    )
    .join('\n')

  return `
<div class="batch-label">
  <div class="header">
    <div class="timestamp">${timestamp}</div>
    <div class="product-info">
      <strong>PRODUCT:</strong>  ${escapeHtml(batch.formulaId)}    ${escapeHtml(batch.formulaDesc)}
    </div>
    <div class="run-info">
      Run #  ${batch.runNo} BATCH:    ${escapeHtml(batch.batchNo)}    ${escapeHtml(batch.productionDate)}    Page ${batch.pageNum} of ${batch.totalPages}
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th class="col-item">Item No.</th>
        <th class="col-bin">BIN</th>
        <th class="col-lot">Lot-No</th>
        <th class="col-qty qty">QTY</th>
        <th class="col-um um">UM</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHTML}
    </tbody>
  </table>
</div>
`
}

/**
 * Format quantity with 3 decimal places
 *
 * @param qty - Quantity in KG
 * @returns Formatted string with 3 decimals
 */
function formatQty(qty: number): string {
  return qty.toFixed(3)
}

/**
 * Escape HTML special characters to prevent XSS
 *
 * @param text - Text to escape
 * @returns HTML-safe string
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
