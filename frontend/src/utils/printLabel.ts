import React from 'react'
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
      const html = generateLabelHTML(label)
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
            React.createElement(QRCodeCanvas, {
              value: qrCodeData,
              size: 150,
              level: 'M', // Medium error correction (15% recovery)
              marginSize: 4, // Quiet zone
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
 * Format matches reference: Print-individual.png
 */
function generateLabelHTML(label: LabelData): string {
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
      padding: 0.25in;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: white;
    }

    .label-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }

    .item-key {
      font-size: 32px;
      font-weight: bold;
      text-align: center;
      margin-top: 8px;
    }

    .qty-display {
      font-size: 28px;
      font-weight: bold;
      text-align: center;
      margin-bottom: 4px;
    }

    .batch-no {
      font-size: 32px;
      font-weight: bold;
      text-align: center;
    }

    .lot-no {
      font-size: 16px;
      text-align: left;
      margin-bottom: 4px;
      width: 100%;
    }

    .picker-datetime {
      font-size: 11px;
      text-align: left;
      margin-bottom: 8px;
      width: 100%;
    }

    .qr-code-section {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 8px 0;
    }

    #qr-code-container {
      display: flex;
      justify-content: center;
      align-items: center;
    }
  </style>
</head>
<body>
  <div class="label-content">
    <div class="item-key">${label.itemKey}</div>
    <div class="qty-display">${label.qtyReceived.toFixed(2)} KG</div>
    <div class="batch-no">${label.batchNo}</div>
    <div class="lot-no">${label.lotNo}</div>
    <div class="picker-datetime">${label.picker} ${label.date} ${label.time}</div>

    <div class="qr-code-section">
      <div id="qr-code-container">
        <!-- QR Code will be rendered here by React -->
      </div>
    </div>
  </div>
</body>
</html>
`
}
