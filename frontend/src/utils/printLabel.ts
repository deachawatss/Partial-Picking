import { QRCodeCanvas } from 'qrcode.react'
import { createRoot } from 'react-dom/client'

export interface LabelData {
  itemKey: string
  qtyReceived: number
  batchNo: string
  lotNo: string
  picker: string
  date: string // DD/MM/YYYY format
  time: string // HH:MM:SSAM/PM format
}

/**
 * Print individual item label with QR code (4×4" format)
 * Data format: ITEMKEY--QTY (e.g., "INSAPP01--7.01")
 */
export async function printLabel(label: LabelData): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Create QR code data: ITEMKEY--QTY
      const qrCodeData = `${label.itemKey}--${label.qtyReceived.toFixed(2)}`

      // Create hidden iframe for printing
      const printFrame = document.createElement('iframe')
      printFrame.style.position = 'fixed'
      printFrame.style.right = '0'
      printFrame.style.bottom = '0'
      printFrame.style.width = '0'
      printFrame.style.height = '0'
      printFrame.style.border = '0'
      document.body.appendChild(printFrame)

      const frameDoc = printFrame.contentWindow?.document
      if (!frameDoc) {
        throw new Error('Failed to access iframe document')
      }

      // Generate HTML with QR code
      const html = generateLabelHTML(label, qrCodeData)
      frameDoc.open()
      frameDoc.write(html)
      frameDoc.close()

      // Wait for content to load, then render QR code
      setTimeout(() => {
        const qrContainer = frameDoc.getElementById('qr-code-container')
        if (qrContainer) {
          // Render QR code using React
          const root = createRoot(qrContainer)
          root.render(
            QRCodeCanvas({
              value: qrCodeData,
              size: 150,
              level: 'M', // Medium error correction (15% recovery)
              marginSize: 4, // Quiet zone
              imageSettings: undefined,
            })
          )

          // Wait for QR code to render, then print
          setTimeout(() => {
            printFrame.contentWindow?.print()

            // Cleanup after print dialog closes
            setTimeout(() => {
              root.unmount()
              document.body.removeChild(printFrame)
              resolve()
            }, 1000)
          }, 500)
        } else {
          throw new Error('QR code container not found')
        }
      }, 100)
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Print multiple labels sequentially
 */
export async function printLabels(labels: LabelData[]): Promise<void> {
  for (const label of labels) {
    await printLabel(label)
    // Short delay between prints to avoid dialog overlap
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
}

/**
 * Generate HTML label template with QR code placeholder
 */
function generateLabelHTML(label: LabelData, qrCodeData: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Pick Label - ${label.itemKey}</title>
  <style>
    @media print {
      @page {
        size: 4in 4in;
        margin: 0;
      }

      body {
        margin: 0;
        padding: 0;
      }
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      width: 4in;
      height: 4in;
      font-family: Arial, sans-serif;
      padding: 0.3in;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: white;
    }

    .label-header {
      text-align: center;
      font-size: 14px;
      font-weight: bold;
      border-bottom: 2px solid #333;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }

    .label-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .field-row {
      display: flex;
      align-items: baseline;
      font-size: 11px;
    }

    .field-label {
      font-weight: bold;
      min-width: 60px;
    }

    .field-value {
      flex: 1;
    }

    .item-key {
      font-size: 24px;
      font-weight: bold;
      text-align: center;
      margin-bottom: 8px;
    }

    .qty-display {
      font-size: 28px;
      font-weight: bold;
      text-align: center;
      color: #2563eb;
      margin-bottom: 12px;
    }

    .qr-code-section {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 12px 0;
      padding: 8px;
      border: 1px dashed #999;
    }

    #qr-code-container {
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .batch-no {
      color: #2563eb;
      font-weight: bold;
    }

    .footer {
      font-size: 10px;
      color: #666;
      text-align: center;
      border-top: 1px solid #ddd;
      padding-top: 6px;
    }
  </style>
</head>
<body>
  <div class="label-header">
    PARTIAL PICK LABEL
  </div>

  <div class="label-content">
    <div class="item-key">${label.itemKey}</div>

    <div class="qty-display">${label.qtyReceived.toFixed(2)} KG</div>

    <div class="field-row">
      <span class="field-label">Batch No:</span>
      <span class="field-value batch-no">${label.batchNo}</span>
    </div>

    <div class="field-row">
      <span class="field-label">Lot No:</span>
      <span class="field-value">${label.lotNo}</span>
    </div>

    <div class="field-row">
      <span class="field-label">Picker:</span>
      <span class="field-value">${label.picker}</span>
    </div>

    <div class="field-row">
      <span class="field-label">Date:</span>
      <span class="field-value">${label.date} ${label.time}</span>
    </div>

    <div class="qr-code-section">
      <div id="qr-code-container">
        <!-- QR Code will be rendered here by React -->
      </div>
    </div>
  </div>

  <div class="footer">
    QR Data: ${qrCodeData}
  </div>
</body>
</html>
`
}
