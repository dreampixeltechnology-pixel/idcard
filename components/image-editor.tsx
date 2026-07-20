/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useCallback } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import getCroppedImg from '@/lib/crop-image';
import { 
  X, 
  Loader2, 
  Check, 
  Sparkles, 
  Palette, 
  Scissors, 
  RotateCcw 
} from 'lucide-react';

interface ImageEditorProps {
  imageSrc: string;
  onClose: () => void;
  onSave: (finalBlob: Blob) => void;
}

export default function ImageEditor({ imageSrc, onClose, onSave }: ImageEditorProps) {
  const [step, setStep] = useState<'crop' | 'process'>('crop');
  
  // Cropper State
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  
  // Processing State
  const [processing, setProcessing] = useState(false);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [croppedUrl, setCroppedUrl] = useState<string | null>(null);
  const [isBackgroundRemoved, setIsBackgroundRemoved] = useState(false);
  const [bgRemovedBlob, setBgRemovedBlob] = useState<Blob | null>(null);
  const [bgRemovedUrl, setBgRemovedUrl] = useState<string | null>(null);
  
  // Styling State
  const [bgColor, setBgColor] = useState<string>('transparent');
  const [customColor, setCustomColor] = useState('#4f46e5');
  
  // Active state to render
  const [activeUrl, setActiveUrl] = useState<string | null>(null);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCrop = async () => {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
      const url = URL.createObjectURL(blob);
      setCroppedBlob(blob);
      setCroppedUrl(url);
      setActiveUrl(url);
      setStep('process');
    } catch (e) {
      console.error('Error cropping image:', e);
      alert('Failed to crop image. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Run AI background removal
  const handleRemoveBackground = async () => {
    if (!croppedBlob) return;
    setProcessing(true);
    try {
      // Lazy load to prevent bundling issue on startup
      const { removeBackground } = await import('@imgly/background-removal');
      
      const removedBlob = await removeBackground(croppedBlob, {
        progress: (key, current, total) => {
          console.log(`AI Removing background ${key}: ${current}/${total}`);
        }
      });
      
      const url = URL.createObjectURL(removedBlob);
      setBgRemovedBlob(removedBlob);
      setBgRemovedUrl(url);
      setActiveUrl(url);
      setIsBackgroundRemoved(true);
      setBgColor('transparent'); // Default transparent once background removed
    } catch (err) {
      console.error('AI BG removal failed, falling back to local canvas keyer:', err);
      // Fallback: Chroma-key style background subtraction (removes whitish/light grey backgrounds)
      try {
        const localBlob = await runLocalChromaKey(croppedBlob);
        const url = URL.createObjectURL(localBlob);
        setBgRemovedBlob(localBlob);
        setBgRemovedUrl(url);
        setActiveUrl(url);
        setIsBackgroundRemoved(true);
        setBgColor('transparent');
      } catch (fallbackErr) {
        alert('Could not remove background automatically. Proceeding with standard cropped image.');
      }
    } finally {
      setProcessing(false);
    }
  };

  // Local fallback background removal (White / Light background removal using Canvas)
  const runLocalChromaKey = (blob: Blob): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context error'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // Thresholding: Detect light colors (R,G,B > 220) and make them transparent
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Whitish or very light gray pixels are made transparent
          if (r > 200 && g > 200 && b > 200) {
            data[i + 3] = 0; // Set Alpha to 0
          }
        }
        ctx.putImageData(imgData, 0, 0);
        canvas.toBlob((outBlob) => {
          resolve(outBlob || blob);
        }, 'image/png');
      };
      img.onerror = () => reject(new Error('Image load error'));
      img.src = URL.createObjectURL(blob);
    });
  };

  // Merge transparency with a solid color
  const compositeImage = (color: string): Promise<Blob> => {
    return new Promise((resolve) => {
      const imageToUse = bgRemovedBlob || croppedBlob;
      if (!imageToUse) {
        resolve(new Blob());
        return;
      }

      if (color === 'transparent') {
        resolve(imageToUse);
        return;
      }

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        }
        canvas.toBlob((blob) => {
          resolve(blob || imageToUse);
        }, 'image/jpeg', 0.95);
      };
      img.src = URL.createObjectURL(imageToUse);
    });
  };

  const handleFinish = async () => {
    setProcessing(true);
    try {
      const finalBlob = await compositeImage(bgColor);
      onSave(finalBlob);
    } catch (e) {
      console.error('Compositing failed:', e);
      alert('Error saving styled image.');
    } finally {
      setProcessing(false);
    }
  };

  const bgColorsPreset = [
    { name: 'Transparent', value: 'transparent', class: 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-200 to-slate-400' },
    { name: 'White', value: '#ffffff', class: 'bg-white border border-slate-300' },
    { name: 'Red', value: '#ef4444', class: 'bg-red-500' },
    { name: 'Blue', value: '#3b82f6', class: 'bg-blue-500' },
    { name: 'Slate', value: '#475569', class: 'bg-slate-600' },
    { name: 'Green', value: '#10b981', class: 'bg-emerald-500' },
    { name: 'Yellow', value: '#f59e0b', class: 'bg-amber-500' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" id="image-editor-overlay">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-100 shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex h-14 items-center justify-between border-b border-slate-100 px-6">
          <h3 className="font-display font-bold text-slate-900">
            {step === 'crop' ? 'Crop Photo (1:1 Ratio)' : 'Process Portrait Background'}
          </h3>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center min-h-[300px]">
          {step === 'crop' ? (
            <div className="relative w-full aspect-square bg-slate-950 rounded-xl overflow-hidden shadow-inner">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
          ) : (
            <div className="w-full flex flex-col items-center gap-6">
              {/* Preview Wrapper */}
              <div 
                className="relative h-48 w-48 rounded-xl shadow-lg border border-slate-100 overflow-hidden flex items-center justify-center"
                style={{ 
                  backgroundColor: bgColor === 'transparent' ? '' : bgColor,
                  backgroundImage: bgColor === 'transparent' ? 'radial-gradient(circle, #cbd5e1 10%, transparent 11%), radial-gradient(circle, #cbd5e1 10%, transparent 11%)' : 'none',
                  backgroundSize: bgColor === 'transparent' ? '12px 12px' : 'auto',
                  backgroundPosition: bgColor === 'transparent' ? '0 0, 6px 6px' : '0 0'
                }}
              >
                {activeUrl && (
                  <img 
                    src={activeUrl} 
                    alt="Cropped Preview" 
                    className="h-full w-full object-contain"
                  />
                )}
              </div>

              {/* Action Tools */}
              <div className="w-full space-y-4">
                {/* Background removal */}
                <div className="flex items-center justify-between p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-sm font-semibold text-slate-800 block">AI Background Isolation</span>
                      <span className="text-xs text-slate-500 block">Isolate the subject from complex backdrops.</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isBackgroundRemoved || processing}
                    onClick={handleRemoveBackground}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-100 disabled:opacity-40 transition-colors"
                  >
                    <Scissors className="h-3.5 w-3.5" /> Remove Background
                  </button>
                </div>

                {/* Background color styling */}
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Palette className="h-4 w-4" /> Solid Color Backdrop
                  </span>
                  
                  <div className="flex flex-wrap gap-2">
                    {bgColorsPreset.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        title={color.name}
                        onClick={() => {
                          setBgColor(color.value);
                        }}
                        className={`h-8 w-8 rounded-full flex items-center justify-center transition-all ${color.class} ${
                          bgColor === color.value ? 'ring-2 ring-indigo-600 scale-110' : 'hover:scale-105'
                        }`}
                      >
                        {bgColor === color.value && (
                          <Check className={`h-4 w-4 ${color.value === '#ffffff' || color.value === 'transparent' ? 'text-indigo-600' : 'text-white'}`} />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Manual color picker */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <input 
                      type="color" 
                      value={customColor}
                      onChange={(e) => {
                        setCustomColor(e.target.value);
                        setBgColor(e.target.value);
                      }}
                      className="h-7 w-7 rounded cursor-pointer border border-slate-200 outline-none"
                    />
                    <span className="text-xs font-semibold text-slate-600">Custom Color Picker: {customColor.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="h-16 border-t border-slate-100 bg-slate-50 px-6 flex items-center justify-between shrink-0">
          {step === 'crop' ? (
            <>
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Scissors className="h-3.5 w-3.5" /> Move image to position center
              </div>
              <button
                type="button"
                onClick={handleCrop}
                disabled={processing}
                className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-colors shadow-md shadow-indigo-100 disabled:opacity-50"
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Next (Crop)'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setStep('crop');
                  setIsBackgroundRemoved(false);
                  setBgRemovedBlob(null);
                  setBgRemovedUrl(null);
                  setActiveUrl(croppedUrl);
                }}
                className="flex items-center gap-1 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold transition-colors"
              >
                <RotateCcw className="h-4 w-4" /> Reset Crop
              </button>
              
              <button
                type="button"
                onClick={handleFinish}
                disabled={processing}
                className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-colors shadow-md shadow-indigo-100 disabled:opacity-50"
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply & Save'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
