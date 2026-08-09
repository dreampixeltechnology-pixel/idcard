import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import React from 'react';
import { jsPDF } from 'jspdf';

let interFontBuffer: ArrayBuffer | null = null;
let devanagariFontBuffer: ArrayBuffer | null = null;
let devanagariBoldFontBuffer: ArrayBuffer | null = null;

const INTER_FONT_URLS = [
  'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf',
  'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.18/files/inter-latin-400-normal.ttf',
];

const DEVANAGARI_FONT_URLS = [
  'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-devanagari@latest/devanagari-400-normal.ttf',
  'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-devanagari@5.0.21/files/noto-sans-devanagari-devanagari-400-normal.ttf',
];

const DEVANAGARI_BOLD_FONT_URLS = [
  'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-devanagari@latest/devanagari-700-normal.ttf',
  'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-devanagari@5.0.21/files/noto-sans-devanagari-devanagari-700-normal.ttf',
];

async function fetchFontWithFallback(urls: string[], fontName: string): Promise<ArrayBuffer> {
  let lastError: any = null;
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.arrayBuffer();
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Failed to fetch ${fontName} font.`);
}

// Caches the fonts in memory to keep rendering fast and prevent duplicate network calls
async function getInterFont() {
  if (!interFontBuffer) {
    try {
      interFontBuffer = await fetchFontWithFallback(INTER_FONT_URLS, 'Inter');
    } catch (err) {
      console.error('Error fetching Inter font:', err);
      throw err;
    }
  }
  return interFontBuffer;
}

async function getDevanagariFont() {
  if (!devanagariFontBuffer) {
    try {
      devanagariFontBuffer = await fetchFontWithFallback(DEVANAGARI_FONT_URLS, 'Noto Sans Devanagari');
    } catch (err) {
      console.error('Error fetching Noto Sans Devanagari font:', err);
      throw err;
    }
  }
  return devanagariFontBuffer;
}

async function getDevanagariBoldFont() {
  if (!devanagariBoldFontBuffer) {
    try {
      devanagariBoldFontBuffer = await fetchFontWithFallback(DEVANAGARI_BOLD_FONT_URLS, 'Noto Sans Devanagari Bold');
    } catch (err) {
      console.warn('Error fetching Noto Sans Devanagari Bold font:', err);
      return null;
    }
  }
  return devanagariBoldFontBuffer;
}

interface CardFieldConfig {
  field: string;
  type: 'text' | 'image';
  x: number;
  y: number;
  width?: number;
  height?: number;
  fontSize?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  italic?: boolean;
}

interface RecordData {
  serial_number: number;
  photo_url?: string;
  data: Record<string, any>;
}

export async function generateCardPng(
  orientation: 'horizontal' | 'vertical',
  backgroundUrl: string | null,
  fieldsConfig: CardFieldConfig[],
  record: RecordData
): Promise<Buffer> {
  const interFont = await getInterFont();
  let devanagariFont: ArrayBuffer | null = null;
  let devanagariBoldFont: ArrayBuffer | null = null;
  try {
    devanagariFont = await getDevanagariFont();
    devanagariBoldFont = await getDevanagariBoldFont();
  } catch (err) {
    console.warn('Could not load Devanagari font for Satori, falling back to Inter only.', err);
  }

  // PVC Card size at ~600 DPI is 2024 x 1276 for high resolution print/zoom
  const isHorizontal = orientation === 'horizontal';
  const width = isHorizontal ? 2024 : 1276;
  const height = isHorizontal ? 1276 : 2024;

  // Scaling multiplier relative to 560x353 designer canvas
  const scale = isHorizontal ? 2024 / 560 : 1276 / 353;

  // Satori JSX template
  const cardJsx = React.createElement(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: '#ffffff',
        backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : 'none',
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        position: 'relative',
        fontFamily: 'NotoSansDevanagari, Inter, sans-serif',
        boxSizing: 'border-box',
        overflow: 'hidden',
      },
    },
    fieldsConfig.map((field, idx) => {
      // Determine what text value to print
      let textValue = '';
      if (field.field === 'Serial Number') {
        textValue = `#${record.serial_number}`;
      } else if (field.field === 'Photo') {
        // Photo is handled below
      } else {
        textValue = String(record.data[field.field] ?? '');
        if (textValue) {
          // Auto-format dates from YYYY-MM-DD or YYYY/MM/DD to DD-MM-YYYY
          const ymdMatch = textValue.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
          if (ymdMatch) {
            const yyyy = ymdMatch[1];
            const mm = ymdMatch[2].padStart(2, '0');
            const dd = ymdMatch[3].padStart(2, '0');
            textValue = `${dd}-${mm}-${yyyy}`;
          } else {
            const dmMatch = textValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (dmMatch) {
              const dd = dmMatch[1].padStart(2, '0');
              const mm = dmMatch[2].padStart(2, '0');
              const yyyy = dmMatch[3];
              textValue = `${dd}-${mm}-${yyyy}`;
            }
          }
        }
      }

      if (field.type === 'image' || field.field === 'Photo') {
        const imageUrl = field.field === 'Photo' ? record.photo_url : record.data[field.field];
        if (!imageUrl) return null;

        return React.createElement('img', {
          key: idx,
          src: imageUrl,
          style: {
            position: 'absolute',
            left: `${field.x}%`,
            top: `${field.y}%`,
            width: field.width ? `${field.width}%` : '22%',
            height: field.height ? `${field.height}%` : '28%',
            borderRadius: '12px',
            objectFit: 'cover',
            border: '4px solid #cbd5e1',
          },
        });
      }

      // Render Text element with Devanagari/Hindi font priority
      return React.createElement(
        'div',
        {
          key: idx,
          style: {
            position: 'absolute',
            left: `${field.x}%`,
            top: `${field.y}%`,
            fontSize: `${(field.fontSize || 14) * scale}px`, // Scale font size for 600dpi
            color: field.color || '#1e293b',
            fontWeight: field.bold ? 'bold' : 'normal',
            fontStyle: field.italic ? 'italic' : 'normal',
            textAlign: field.align || 'left',
            display: 'flex',
            alignItems: 'center',
            fontFamily: 'NotoSansDevanagari, Inter, sans-serif',
            whiteSpace: 'nowrap',
          },
        },
        textValue
      );
    })
  );

  const satoriFonts: any[] = [];

  if (devanagariFont) {
    satoriFonts.push({
      name: 'NotoSansDevanagari',
      data: devanagariFont,
      weight: 400,
      style: 'normal',
    });
  }

  if (devanagariBoldFont) {
    satoriFonts.push({
      name: 'NotoSansDevanagari',
      data: devanagariBoldFont,
      weight: 700,
      style: 'normal',
    });
  }

  satoriFonts.push({
    name: 'Inter',
    data: interFont,
    weight: 400,
    style: 'normal',
  });

  // Render SVG using Satori
  const svg = await satori(cardJsx, {
    width,
    height,
    fonts: satoriFonts,
  });

  // Render PNG using Resvg
  const resvg = new Resvg(svg, {
    background: 'rgba(255, 255, 255, 1)',
    fitTo: {
      mode: 'width',
      value: width,
    },
  });

  const pngData = resvg.render();
  return pngData.asPng();
}

/**
 * Generates a PDF Buffer for a single ID Card in standard CR80 dimensions (85.6mm x 53.98mm)
 */
export async function generateCardPdf(
  orientation: 'horizontal' | 'vertical',
  pngBuffer: Buffer
): Promise<Buffer> {
  const isHorizontal = orientation === 'horizontal';
  const widthMm = isHorizontal ? 85.6 : 53.98;
  const heightMm = isHorizontal ? 53.98 : 85.6;

  const doc = new jsPDF({
    orientation: isHorizontal ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [widthMm, heightMm],
    compress: true,
  });

  const base64Png = `data:image/png;base64,${pngBuffer.toString('base64')}`;
  doc.addImage(base64Png, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');

  const pdfArrayBuffer = doc.output('arraybuffer');
  return Buffer.from(pdfArrayBuffer);
}

/**
 * Generates an A4 Print Sheet PDF Buffer containing all cards formatted in a grid.
 */
export async function generateA4SheetPdf(
  orientation: 'horizontal' | 'vertical',
  cards: Array<{ pngBuffer: Buffer; serial_number: number }>
): Promise<Buffer> {
  const isHorizontal = orientation === 'horizontal';
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4', // 210mm x 297mm
    compress: true,
  });

  const cardWidth = isHorizontal ? 85.6 : 53.98;
  const cardHeight = isHorizontal ? 53.98 : 85.6;

  const marginX = 15;
  const marginY = 15;
  const gapX = 10;
  const gapY = 10;

  const cols = isHorizontal ? 2 : 3;
  const rows = isHorizontal ? 4 : 4;
  const cardsPerPage = cols * rows;

  cards.forEach((card, index) => {
    if (index > 0 && index % cardsPerPage === 0) {
      doc.addPage('a4', 'portrait');
    }
    const pageIndex = index % cardsPerPage;
    const col = pageIndex % cols;
    const row = Math.floor(pageIndex / cols);

    const x = marginX + col * (cardWidth + gapX);
    const y = marginY + row * (cardHeight + gapY);

    const base64Png = `data:image/png;base64,${card.pngBuffer.toString('base64')}`;
    doc.addImage(base64Png, 'PNG', x, y, cardWidth, cardHeight, undefined, 'FAST');
  });

  const pdfArrayBuffer = doc.output('arraybuffer');
  return Buffer.from(pdfArrayBuffer);
}

