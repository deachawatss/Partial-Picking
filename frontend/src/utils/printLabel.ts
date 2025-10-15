import React from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'

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
 * Generate QR code as data URL
 * Renders QR code in main document, converts to base64 image
 * Uses flushSync to force synchronous rendering for React 19
 */
async function generateQRCodeDataURL(value: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Create temporary hidden container in main document
      const container = document.createElement('div')
      container.style.position = 'fixed'
      container.style.left = '-9999px'
      container.style.top = '0'
      document.body.appendChild(container)

      // Render QR code using React with synchronous rendering
      const root = createRoot(container)

      // Force synchronous rendering to ensure canvas is created immediately
      flushSync(() => {
        root.render(
          React.createElement(QRCodeCanvas, {
            value,
            size: 150,
            level: 'M', // Medium error correction (15% recovery)
            marginSize: 4, // Quiet zone
          })
        )
      })

      // Use requestAnimationFrame to wait for canvas painting
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const canvas = container.querySelector('canvas')
          if (canvas) {
            const dataURL = canvas.toDataURL('image/png')
            root.unmount()
            document.body.removeChild(container)
            resolve(dataURL)
          } else {
            root.unmount()
            document.body.removeChild(container)
            reject(new Error('Canvas element not found after rendering'))
          }
        })
      })
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Print individual item label with QR code (4×4" format)
 * Data format: ITEMKEY--QTY (e.g., "INSAPP01--7.01")
 */
export async function printLabel(label: LabelData): Promise<void> {
  try {
    // Create QR code data: ITEMKEY--QTY
    const qrCodeData = `${label.itemKey}--${label.qtyReceived.toFixed(3)}`

    // Pre-render QR code to data URL in main document
    const qrCodeDataURL = await generateQRCodeDataURL(qrCodeData)

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

    // Generate HTML with QR code as data URL
    const html = generateLabelHTML(label, qrCodeDataURL)
    frameDoc.open()
    frameDoc.write(html)
    frameDoc.close()

    // Wait for iframe content to load, then print
    setTimeout(() => {
      printFrame.contentWindow?.print()

      // Cleanup after print dialog closes
      setTimeout(() => {
        document.body.removeChild(printFrame)
      }, 1000)
    }, 100)
  } catch (error) {
    console.error('Error printing label:', error)
    throw error
  }
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
 * Generate HTML label template with QR code as data URL
 * Format matches reference: Print-individual.png
 */
function generateLabelHTML(label: LabelData, qrCodeDataURL: string): string {
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
      font-weight: bold;
    }

    .picker-datetime {
      font-size: 11px;
      text-align: left;
      margin-bottom: 8px;
      width: 100%;
      font-weight: bold;
    }

    .qr-code-section {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 8px 0;
    }

    .qr-code-image {
      width: 150px;
      height: 150px;
    }
  </style>
</head>
<body>
  <div class="label-content">
    <div class="item-key">${label.itemKey}</div>
    <div class="qty-display">${label.qtyReceived.toFixed(3)} KG</div>
    <div class="batch-no">${label.batchNo}</div>
    <div class="lot-no">${label.lotNo}</div>
    <div class="picker-datetime">${label.picker} ${label.date} ${label.time}</div>

    <div class="qr-code-section">
      <img src="${qrCodeDataURL}" alt="QR Code" class="qr-code-image" />
    </div>
  </div>
</body>
</html>
`
}
