import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import React from 'react';

let interFontBuffer: ArrayBuffer | null = null;
let devanagariFontBuffer: ArrayBuffer | null = null;

// Caches the fonts in memory to keep rendering fast and prevent duplicate network calls
async function getInterFont() {
  if (!interFontBuffer) {
    try {
      const response = await fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter-Regular.ttf');
      if (!response.ok) {
        throw new Error('Failed to fetch Inter font.');
      }
      interFontBuffer = await response.arrayBuffer();
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
      const response = await fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/notosansdevanagari/NotoSansDevanagari-Regular.ttf');
      if (!response.ok) {
        throw new Error('Failed to fetch Noto Sans Devanagari font.');
      }
      devanagariFontBuffer = await response.arrayBuffer();
    } catch (err) {
      console.error('Error fetching Noto Sans Devanagari font:', err);
      throw err;
    }
  }
  return devanagariFontBuffer;
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
  try {
    devanagariFont = await getDevanagariFont();
  } catch (err) {
    console.warn('Could not load Devanagari font for Satori, falling back to Inter only.', err);
  }

  // PVC Card size at 300dpi is 1012 x 638
  const width = orientation === 'horizontal' ? 1012 : 638;
  const height = orientation === 'horizontal' ? 638 : 1012;

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
        fontFamily: 'Inter, NotoSansDevanagari',
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
        textValue = record.data[field.field] || '';
      }

      if (field.type === 'image') {
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
            borderRadius: '6px',
            objectFit: 'cover',
            border: '2px solid #cbd5e1',
          },
        });
      }

      // Render Text element
      return React.createElement(
        'div',
        {
          key: idx,
          style: {
            position: 'absolute',
            left: `${field.x}%`,
            top: `${field.y}%`,
            fontSize: `${(field.fontSize || 14) * 2}px`, // Scale font size for 300dpi
            color: field.color || '#1e293b',
            fontWeight: field.bold ? 'bold' : 'normal',
            fontStyle: field.italic ? 'italic' : 'normal',
            textAlign: field.align || 'left',
            display: 'flex',
            alignItems: 'center',
            fontFamily: 'Inter, NotoSansDevanagari',
            whiteSpace: 'nowrap',
          },
        },
        textValue
      );
    })
  );

  const satoriFonts: any[] = [
    {
      name: 'Inter',
      data: interFont,
      weight: 400,
      style: 'normal',
    },
  ];

  if (devanagariFont) {
    satoriFonts.push({
      name: 'NotoSansDevanagari',
      data: devanagariFont,
      weight: 400,
      style: 'normal',
    });
  }

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
