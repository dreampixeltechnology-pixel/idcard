'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Draggable from 'react-draggable';
import { getSupabaseClient } from '@/lib/supabase-client';
import { 
  ArrowLeft, 
  ChevronRight, 
  Loader2, 
  AlertCircle,
  Save, 
  Image as ImageIcon, 
  RotateCw,
  Type,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkles,
  RefreshCw,
  Sliders,
  CheckCircle2
} from 'lucide-react';

interface Department {
  id: string;
  name: string;
  code: string;
  fields_schema: Array<{ name: string; type: 'text' | 'number' | 'date' | 'image' }>;
}

interface Organization {
  id: string;
  name: string;
  code: string;
}

interface FieldConfig {
  field: string;
  type: 'text' | 'image';
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  width?: number; // percentage (0-100) for images
  height?: number; // percentage (0-100) for images
  fontSize: number; // standard pt size
  color: string;
  align: 'left' | 'center' | 'right';
  bold?: boolean;
  italic?: boolean;
}

interface PageProps {
  params: Promise<{ orgId: string; deptId: string }>;
}

export default function CardDesignerPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const orgId = resolvedParams.orgId;
  const deptId = resolvedParams.deptId;

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [dept, setDept] = useState<Department | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Designer Canvas Configuration
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [fieldsConfig, setFieldsConfig] = useState<FieldConfig[]>([]);
  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = getSupabaseClient();

  // Canvas Dimensions (Displayed scaled ratio)
  // Standard PVC card is 85.6mm x 54mm (ratio 1.585)
  const displayWidth = orientation === 'horizontal' ? 560 : 353;
  const displayHeight = orientation === 'horizontal' ? 353 : 560;

  useEffect(() => {
    if (!supabase) {
      setTimeout(() => {
        setLoading(false);
      }, 0);
      return;
    }

    async function loadDesignerData() {
      try {
        // Fetch Org
        const { data: orgData } = await supabase!
          .from('organizations')
          .select('*')
          .eq('id', orgId)
          .single();
        setOrganization(orgData);

        // Fetch Dept
        const { data: deptData } = await supabase!
          .from('departments')
          .select('*')
          .eq('id', deptId)
          .single();
        setDept(deptData);

        // Fetch Existing Card Design
        const res = await fetch(`/api/card-design/${deptId}`);
        const result = await res.json();

        if (result.success && result.design) {
          setOrientation(result.design.orientation);
          setBackgroundUrl(result.design.background_url);
          setFieldsConfig(result.design.fields_config || []);
        } else {
          // Initialize default field positions if no design exists yet
          const initialFields: FieldConfig[] = [
            { field: 'Serial Number', type: 'text', x: 5, y: 5, fontSize: 10, color: '#64748b', align: 'left', bold: true },
            { field: 'Photo', type: 'image', x: 38, y: 15, width: 24, height: 32, fontSize: 12, color: '#000000', align: 'center' }
          ];

          if (deptData?.fields_schema) {
            deptData.fields_schema.forEach((f: any, idx: number) => {
              if (f.type !== 'image') {
                initialFields.push({
                  field: f.name,
                  type: 'text',
                  x: 10,
                  y: 55 + idx * 8,
                  fontSize: f.name.toLowerCase().includes('name') ? 16 : 12,
                  color: f.name.toLowerCase().includes('name') ? '#1e293b' : '#475569',
                  align: 'left',
                  bold: f.name.toLowerCase().includes('name') ? true : false
                });
              }
            });
          }
          setFieldsConfig(initialFields);
        }
      } catch (err) {
        console.error('Error loading designer:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDesignerData();
  }, [supabase, orgId, deptId]);

  // Handle uploading custom card background
  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;

    setSubmitting(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const storagePath = `backgrounds/${deptId}.jpg`;

      // Create bucket if not exists
      try {
        const { data: bucketData } = await supabase.storage.getBucket('org-images');
        if (!bucketData) {
          await supabase.storage.createBucket('org-images', { public: true });
        }
      } catch {
        // Safe creation fallback
      }

      const { error: uploadError } = await supabase.storage
        .from('org-images')
        .upload(storagePath, buffer, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: urlData } = supabase.storage
        .from('org-images')
        .getPublicUrl(storagePath);

      setBackgroundUrl(urlData.publicUrl);
      setSuccessMsg('Background image uploaded successfully!');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to upload background.');
    } finally {
      setSubmitting(false);
    }
  };

  // Convert pixels to percentage on drag stop
  const handleDragStop = (index: number, e: any, data: any) => {
    if (!canvasRef.current) return;

    // We calculate new position relative to current canvas coordinates
    const updated = [...fieldsConfig];
    
    // Convert drag pixel coordinates directly to percentage of display size
    const xPercent = Math.round((data.x / displayWidth) * 100);
    const yPercent = Math.round((data.y / displayHeight) * 100);

    // Bound values between 0 and 100
    updated[index].x = Math.max(0, Math.min(100, xPercent));
    updated[index].y = Math.max(0, Math.min(100, yPercent));

    setFieldsConfig(updated);
    setSelectedFieldIndex(index);
  };

  // Edit fields configs property (Selected block)
  const handleUpdateProperty = (key: keyof FieldConfig, value: any) => {
    if (selectedFieldIndex === null) return;
    const updated = [...fieldsConfig];
    updated[selectedFieldIndex] = {
      ...updated[selectedFieldIndex],
      [key]: value
    };
    setFieldsConfig(updated);
  };

  // Save full configuration
  const handleSaveDesign = async () => {
    setSubmitting(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/card-design/${deptId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orientation,
          background_url: backgroundUrl,
          fields_config: fieldsConfig
        })
      });

      const result = await res.json();
      if (result.error) {
        setErrorMsg(result.error);
      } else {
        setSuccessMsg('ID Card Design layout saved successfully! All generated cards will use this layout template.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save configuration.');
    } finally {
      setSubmitting(false);
    }
  };

  // Placeholder preview mapping
  const dummyData: Record<string, string> = {
    'Serial Number': '#001',
    'Name': 'Jane Doe',
    'Full Name': 'Jane Doe',
    'Designation': 'Project Director',
    'Department': dept?.name || 'Operations',
    'Employee ID': 'EMP-2026-98'
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-sm font-medium text-slate-500">Loading designer canvas...</p>
        </div>
      </div>
    );
  }

  if (!dept || !organization) return null;

  const selectedField = selectedFieldIndex !== null ? fieldsConfig[selectedFieldIndex] : null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur-md shrink-0">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href={`/org/${orgId}/dept/${deptId}`}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                id="back-to-console-btn"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-display font-semibold text-slate-500 text-sm">{dept.name}</span>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                  <span className="font-display text-base font-bold text-slate-900">Card Designer</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                id="save-design-btn"
                onClick={handleSaveDesign}
                disabled={submitting}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-4 py-2 text-sm font-semibold shadow-md shadow-indigo-100 transition-colors"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>Save Layout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Editor Main body */}
      <div className="flex-1 overflow-hidden grid lg:grid-cols-12 min-h-0">
        
        {/* Left Side: Drag Blocks & Property inspector */}
        <aside className="lg:col-span-4 bg-white border-r border-slate-200 p-6 flex flex-col justify-between overflow-y-auto max-h-[calc(100vh-64px)]">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider mb-3">
                <Sliders className="h-4 w-4 text-indigo-500" /> Card Base Properties
              </h3>
              
              <div className="grid grid-cols-2 gap-2">
                {/* Orientation Switcher */}
                <button
                  onClick={() => {
                    setOrientation(orientation === 'horizontal' ? 'vertical' : 'horizontal');
                    setSelectedFieldIndex(null);
                  }}
                  className="flex items-center justify-center gap-1.5 border border-slate-200 hover:bg-slate-50 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700"
                >
                  <RotateCw className="h-3.5 w-3.5" /> Toggle Orientation
                </button>

                {/* Upload Background */}
                <input
                  type="file"
                  accept="image/*"
                  ref={bgInputRef}
                  className="hidden"
                  onChange={handleBackgroundUpload}
                />
                <button
                  onClick={() => bgInputRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 border border-slate-200 hover:bg-slate-50 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700"
                >
                  <ImageIcon className="h-3.5 w-3.5 text-indigo-600" /> Card Background
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">Standard PVC Size: 85.6 × 54 mm. Background image scales to fit.</p>
            </div>

            {/* List of draggable fields in designer */}
            <div className="border-t border-slate-100 pt-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2.5">Available Fields</h3>
              <div className="flex flex-wrap gap-1.5">
                {fieldsConfig.map((f, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedFieldIndex(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                      selectedFieldIndex === i 
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm' 
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {f.field}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-2">Select a field above or drag elements on the canvas to configure styling.</p>
            </div>

            {/* Property Inspector */}
            {selectedField && (
              <div className="border-t border-slate-100 pt-4 space-y-4 animate-fade-in" id="property-inspector">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Styling: {selectedField.field}</h3>
                  <span className="text-[11px] bg-slate-100 px-2 py-0.5 rounded-md text-slate-500 font-mono">X:{selectedField.x}% Y:{selectedField.y}%</span>
                </div>

                {selectedField.type === 'text' ? (
                  <>
                    {/* Font size */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Font Size (pt)</label>
                        <input
                          type="number"
                          min="6"
                          max="40"
                          value={selectedField.fontSize}
                          onChange={(e) => handleUpdateProperty('fontSize', parseInt(e.target.value) || 12)}
                          className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs font-mono outline-none"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Font Color</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={selectedField.color}
                            onChange={(e) => handleUpdateProperty('color', e.target.value)}
                            className="h-8 w-8 rounded cursor-pointer border border-slate-200 outline-none"
                          />
                          <input 
                            type="text" 
                            value={selectedField.color.toUpperCase()}
                            onChange={(e) => handleUpdateProperty('color', e.target.value)}
                            className="w-full text-xs font-mono border border-slate-200 rounded-xl py-1.5 px-2 outline-none uppercase"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bold / Italic */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1.5">Text Formats</label>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleUpdateProperty('bold', !selectedField.bold)}
                          className={`p-2 rounded-lg border transition-all ${selectedField.bold ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'border-slate-200 hover:bg-slate-50'}`}
                        >
                          <Bold className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleUpdateProperty('italic', !selectedField.italic)}
                          className={`p-2 rounded-lg border transition-all ${selectedField.italic ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'border-slate-200 hover:bg-slate-50'}`}
                        >
                          <Italic className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Alignment */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1.5">Alignment</label>
                      <div className="grid grid-cols-3 gap-1 bg-slate-50 border border-slate-100 p-1 rounded-xl">
                        {(['left', 'center', 'right'] as const).map((align) => (
                          <button
                            key={align}
                            onClick={() => handleUpdateProperty('align', align)}
                            className={`flex justify-center py-1.5 rounded-lg text-xs capitalize font-semibold transition-all ${
                              selectedField.align === align ? 'bg-white shadow-sm text-indigo-600 font-bold' : 'text-slate-500 hover:bg-white/50'
                            }`}
                          >
                            {align === 'left' && <AlignLeft className="h-3.5 w-3.5" />}
                            {align === 'center' && <AlignCenter className="h-3.5 w-3.5" />}
                            {align === 'right' && <AlignRight className="h-3.5 w-3.5" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Image custom dimensions (width & height) */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Image Width (%)</label>
                        <input
                          type="number"
                          min="10"
                          max="90"
                          value={selectedField.width || 20}
                          onChange={(e) => handleUpdateProperty('width', parseInt(e.target.value) || 20)}
                          className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs font-mono outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Image Height (%)</label>
                        <input
                          type="number"
                          min="10"
                          max="90"
                          value={selectedField.height || 20}
                          onChange={(e) => handleUpdateProperty('height', parseInt(e.target.value) || 20)}
                          className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs font-mono outline-none"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Tips Callout */}
          <div className="mt-8 border-t border-slate-100 pt-4 text-xs text-slate-400 space-y-1 bg-indigo-50/20 border border-indigo-100/30 p-3 rounded-xl">
            <span className="font-bold text-indigo-800 uppercase tracking-wider block mb-1">Designer Tips</span>
            <span className="block">• Select any block to change styles or colors.</span>
            <span className="block">• Drag items inside the white frame to position.</span>
            <span className="block">• Save layout before returning to records.</span>
          </div>
        </aside>

        {/* Right Side: Interactive Drag Area */}
        <main className="lg:col-span-8 bg-slate-100 flex flex-col items-center justify-center p-6 relative overflow-y-auto max-h-[calc(100vh-64px)]">
          
          {/* Notification banners inside layout */}
          {successMsg && (
            <div className="absolute top-4 left-6 right-6 z-10 bg-emerald-50 border border-emerald-100 text-emerald-800 p-4 rounded-xl shadow-md flex items-center gap-2.5 animate-fade-in">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <span className="text-xs font-semibold">{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="absolute top-4 left-6 right-6 z-10 bg-red-50 border border-red-100 text-red-800 p-4 rounded-xl shadow-md flex items-center gap-2.5 animate-fade-in">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              <span className="text-xs font-semibold">{errorMsg}</span>
            </div>
          )}

          <div className="text-center mb-4 space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> Interactive Blueprint Layout
            </span>
            <p className="text-xs text-slate-400">Values are previewed with Jane Doe mock data. Red box indicates current active block selection.</p>
          </div>

          {/* The Designer Frame */}
          <div 
            ref={canvasRef}
            className="relative bg-white border border-slate-200/80 shadow-2xl rounded-2xl overflow-hidden select-none transition-all duration-200"
            style={{ 
              width: `${displayWidth}px`, 
              height: `${displayHeight}px`,
              backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : 'none',
              backgroundSize: '100% 100%',
              backgroundRepeat: 'no-repeat'
            }}
            id="designer-canvas"
          >
            {fieldsConfig.map((field, index) => {
              // Convert stored percentage position directly back to display pixels
              const xPx = (field.x / 100) * displayWidth;
              const yPx = (field.y / 100) * displayHeight;

              const isSelected = selectedFieldIndex === index;

              if (field.type === 'image') {
                const widthPercent = field.width || 20;
                const heightPercent = field.height || 25;
                const widthPx = (widthPercent / 100) * displayWidth;
                const heightPx = (heightPercent / 100) * displayHeight;

                return (
                  <Draggable
                    key={index}
                    bounds="parent"
                    position={{ x: xPx, y: yPx }}
                    onStop={(e, data) => handleDragStop(index, e, data)}
                  >
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFieldIndex(index);
                      }}
                      className={`absolute cursor-move flex flex-col items-center justify-center border-2 bg-indigo-50/40 select-none overflow-hidden rounded-lg ${
                        isSelected ? 'border-red-500 ring-2 ring-red-100' : 'border-indigo-300 border-dashed hover:border-indigo-400'
                      }`}
                      style={{ 
                        width: `${widthPx}px`, 
                        height: `${heightPx}px`,
                        boxSizing: 'border-box'
                      }}
                    >
                      <ImageIcon className="h-6 w-6 text-indigo-500" />
                      <span className="text-[9px] text-indigo-600 font-bold mt-1 uppercase tracking-wider">{field.field}</span>
                    </div>
                  </Draggable>
                );
              }

              // Text Field Layout
              // Resolve mock or label text to preview
              const mockText = dummyData[field.field] || `{{${field.field}}}`;

              return (
                <Draggable
                  key={index}
                  bounds="parent"
                  position={{ x: xPx, y: yPx }}
                  onStop={(e, data) => handleDragStop(index, e, data)}
                >
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFieldIndex(index);
                    }}
                    className={`absolute cursor-move px-2 py-0.5 rounded select-none whitespace-nowrap flex items-center ${
                      isSelected 
                        ? 'border border-red-500 bg-red-50/50 text-red-900 font-bold' 
                        : 'hover:border hover:border-indigo-300 hover:bg-indigo-50/30'
                    }`}
                    style={{
                      fontSize: `${field.fontSize}px`,
                      color: field.color,
                      fontWeight: field.bold ? 'bold' : 'normal',
                      fontStyle: field.italic ? 'italic' : 'normal',
                      textAlign: field.align,
                      boxSizing: 'border-box'
                    }}
                  >
                    {mockText}
                  </div>
                </Draggable>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
export const dynamic = 'force-dynamic';
