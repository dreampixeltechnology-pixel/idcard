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

interface PresetSpec {
  id: string;
  name: string;
  layoutNum: number;
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
}

const CORPORATE_PRESETS: PresetSpec[] = [
  { id: 'c1', name: 'Navy Prestige', layoutNum: 1, primary: '#1E3A8A', secondary: '#1F2937', accent: '#F59E0B', bg: '#F8FAFC' },
  { id: 'c2', name: 'Slate Tech', layoutNum: 2, primary: '#334155', secondary: '#1E293B', accent: '#14B8A6', bg: '#F8FAFC' },
  { id: 'c3', name: 'Emerald Global', layoutNum: 3, primary: '#065F46', secondary: '#374151', accent: '#34D399', bg: '#F0FDF4' },
  { id: 'c4', name: 'Burgundy Elite', layoutNum: 4, primary: '#701A75', secondary: '#4A044E', accent: '#F43F5E', bg: '#FFF1F2' },
  { id: 'c5', name: 'Royal Steel', layoutNum: 5, primary: '#2563EB', secondary: '#1F2937', accent: '#60A5FA', bg: '#EFF6FF' },
  { id: 'c6', name: 'Carbon Minimal', layoutNum: 6, primary: '#111827', secondary: '#1F2937', accent: '#9CA3AF', bg: '#F9FAFB' },
  { id: 'c7', name: 'Bronze Executive', layoutNum: 7, primary: '#451A03', secondary: '#1E293B', accent: '#F59E0B', bg: '#FFFBEB' },
  { id: 'c8', name: 'Indigo Shift', layoutNum: 8, primary: '#4338CA', secondary: '#1E293B', accent: '#8B5CF6', bg: '#F5F3FF' },
  { id: 'c9', name: 'Forest Eco', layoutNum: 9, primary: '#14532D', secondary: '#1F2937', accent: '#84CC16', bg: '#F0FDF4' },
  { id: 'c10', name: 'Cyber Neon (Dark)', layoutNum: 10, primary: '#10B981', secondary: '#1E293B', accent: '#06B6D4', bg: '#0F172A' }
];

const SCHOOL_PRESETS: PresetSpec[] = [
  { id: 's1', name: 'Royal Academy', layoutNum: 1, primary: '#1D4ED8', secondary: '#1E293B', accent: '#F59E0B', bg: '#F8FAFC' },
  { id: 's2', name: 'Harvard Crimson', layoutNum: 2, primary: '#991B1B', secondary: '#111827', accent: '#D97706', bg: '#FFF5F5' },
  { id: 's3', name: 'Ivy Green League', layoutNum: 3, primary: '#1E4620', secondary: '#1F2937', accent: '#EAB308', bg: '#F4FBF4' },
  { id: 's4', name: 'Sunflower Prep', layoutNum: 4, primary: '#EAB308', secondary: '#1E3A8A', accent: '#0EA5E9', bg: '#FEFDF0' },
  { id: 's5', name: 'Pacific High', layoutNum: 5, primary: '#0369A1', secondary: '#1E293B', accent: '#0D9488', bg: '#F0F9FF' },
  { id: 's6', name: 'Cardinal Classic', layoutNum: 6, primary: '#8C1515', secondary: '#272525', accent: '#53565A', bg: '#FAF9F6' },
  { id: 's7', name: 'Vibrant Orange', layoutNum: 7, primary: '#EA580C', secondary: '#1E1B4B', accent: '#475569', bg: '#FFF7ED' },
  { id: 's8', name: 'Purple Crest', layoutNum: 8, primary: '#581C87', secondary: '#1E293B', accent: '#CA8A04', bg: '#FAF5FF' },
  { id: 's9', name: 'Friendly Sky', layoutNum: 9, primary: '#0284C7', secondary: '#1E293B', accent: '#65A30D', bg: '#F0F9FF' },
  { id: 's10', name: 'SciTech Neon (Dark)', layoutNum: 10, primary: '#22C55E', secondary: '#111827', accent: '#06B6D4', bg: '#030712' }
];

function generateSvgBackground(layoutNum: number, orientation: 'horizontal' | 'vertical', primary: string, secondary: string, accent: string, bg: string) {
  const w = orientation === 'horizontal' ? 560 : 353;
  const h = orientation === 'horizontal' ? 353 : 560;

  let svgElements = '';

  if (layoutNum === 1) {
    if (orientation === 'horizontal') {
      svgElements = `
        <rect width="${w}" height="${h}" fill="${bg}"/>
        <rect width="${w}" height="76" fill="${primary}"/>
        <rect y="76" width="${w}" height="6" fill="${accent}"/>
        <rect y="323" width="${w}" height="30" fill="${secondary}"/>
      `;
    } else {
      svgElements = `
        <rect width="${w}" height="${h}" fill="${bg}"/>
        <rect width="${w}" height="95" fill="${primary}"/>
        <rect y="95" width="${w}" height="6" fill="${accent}"/>
        <rect y="525" width="${w}" height="35" fill="${secondary}"/>
      `;
    }
  } else if (layoutNum === 2) {
    if (orientation === 'horizontal') {
      svgElements = `
        <rect width="${w}" height="${h}" fill="${bg}"/>
        <rect width="130" height="${h}" fill="${primary}"/>
        <rect x="130" width="6" height="${h}" fill="${accent}"/>
        <rect x="136" y="323" width="${w - 136}" height="30" fill="${secondary}"/>
      `;
    } else {
      svgElements = `
        <rect width="${w}" height="${h}" fill="${bg}"/>
        <rect width="${w}" height="85" fill="${primary}"/>
        <rect y="85" width="${w}" height="6" fill="${accent}"/>
        <rect y="525" width="${w}" height="35" fill="${secondary}"/>
      `;
    }
  } else if (layoutNum === 3) {
    if (orientation === 'horizontal') {
      svgElements = `
        <rect width="${w}" height="${h}" fill="${bg}"/>
        <path d="M0 0 L260 0 L180 85 L0 85 Z" fill="${primary}"/>
        <path d="M180 85 L260 0 L270 0 L190 85 Z" fill="${accent}"/>
        <rect y="328" width="${w}" height="25" fill="${secondary}"/>
      `;
    } else {
      svgElements = `
        <rect width="${w}" height="${h}" fill="${bg}"/>
        <path d="M0 0 L200 0 L140 100 L0 100 Z" fill="${primary}"/>
        <path d="M140 100 L200 0 L210 0 L150 100 Z" fill="${accent}"/>
        <rect y="530" width="${w}" height="30" fill="${secondary}"/>
      `;
    }
  } else if (layoutNum === 4) {
    svgElements = `
      <rect width="${w}" height="${h}" fill="${bg}"/>
      <rect x="10" y="10" width="${w - 20}" height="${h - 20}" fill="none" stroke="${primary}" stroke-width="3"/>
      <rect x="15" y="15" width="${w - 30}" height="${h - 30}" fill="none" stroke="${accent}" stroke-width="1.5"/>
      <rect x="10" y="${h - 45}" width="${w - 20}" height="35" fill="${primary}"/>
    `;
  } else if (layoutNum === 5) {
    svgElements = `
      <rect width="${w}" height="${h}" fill="${bg}"/>
      <rect width="10" height="${h}" fill="${primary}"/>
      <rect x="10" width="4" height="${h}" fill="${accent}"/>
      <rect x="${w - 180}" y="12" width="168" height="28" rx="6" fill="${secondary}" opacity="0.9"/>
    `;
  } else if (layoutNum === 6) {
    if (orientation === 'horizontal') {
      svgElements = `
        <rect width="${w}" height="${h}" fill="${bg}"/>
        <path d="M0 0 C 150 0, 180 90, 300 60 C 380 40, 480 80, 560 50 L 560 0 Z" fill="${primary}"/>
        <path d="M0 0 C 150 0, 180 90, 300 60 C 380 40, 480 80, 560 50 L 560 0 Z" fill="${accent}" opacity="0.3" transform="translate(0, 6)"/>
        <rect y="325" width="${w}" height="28" fill="${secondary}"/>
      `;
    } else {
      svgElements = `
        <rect width="${w}" height="${h}" fill="${bg}"/>
        <path d="M0 0 C 90 0, 110 110, 180 80 C 240 60, 300 120, 353 90 L 353 0 Z" fill="${primary}"/>
        <path d="M0 0 C 90 0, 110 110, 180 80 C 240 60, 300 120, 353 90 L 353 0 Z" fill="${accent}" opacity="0.3" transform="translate(0, 6)"/>
        <rect y="530" width="${w}" height="30" fill="${secondary}"/>
      `;
    }
  } else if (layoutNum === 7) {
    if (orientation === 'horizontal') {
      svgElements = `
        <rect width="${w}" height="${h}" fill="${bg}"/>
        <rect width="210" height="${h}" fill="${primary}"/>
        <path d="M210 0 L240 0 L210 ${h} Z" fill="${primary}"/>
        <rect x="0" y="323" width="210" height="30" fill="${secondary}"/>
      `;
    } else {
      svgElements = `
        <rect width="${w}" height="${h}" fill="${bg}"/>
        <rect width="${w}" height="200" fill="${primary}"/>
        <path d="M0 200 L${w} 200 L0 230 Z" fill="${primary}"/>
        <rect x="0" y="525" width="${w}" height="35" fill="${secondary}"/>
      `;
    }
  } else if (layoutNum === 8) {
    svgElements = `
      <rect width="${w}" height="${h}" fill="${bg}"/>
      <line x1="18" y1="0" x2="18" y2="${h}" stroke="${primary}" stroke-width="4"/>
      <line x1="26" y1="0" x2="26" y2="${h}" stroke="${accent}" stroke-width="2"/>
      <line x1="32" y1="0" x2="32" y2="${h}" stroke="${primary}" stroke-width="1" stroke-dasharray="4 4"/>
      <rect x="42" y="${h - 40}" width="${w - 60}" height="25" rx="4" fill="${secondary}" opacity="0.1"/>
    `;
  } else if (layoutNum === 9) {
    svgElements = `
      <rect width="${w}" height="${h}" fill="${bg}"/>
      <path d="M0 0 L90 0 L0 90 Z" fill="${primary}"/>
      <path d="M0 0 L100 0 L0 100 Z" fill="${accent}" opacity="0.3"/>
      <path d="M${w} ${h} L${w - 90} ${h} L${w} ${h - 90} Z" fill="${secondary}"/>
      <path d="M${w} ${h} L${w - 100} ${h} L${w} ${h - 100} Z" fill="${accent}" opacity="0.3"/>
    `;
  } else if (layoutNum === 10) {
    svgElements = `
      <rect width="${w}" height="${h}" fill="#0F172A"/>
      <rect x="5" y="5" width="${w - 10}" height="${h - 10}" fill="none" stroke="${primary}" stroke-width="2" rx="10"/>
      <rect x="7" y="7" width="${w - 14}" height="${h - 14}" fill="none" stroke="${accent}" stroke-dasharray="10 5" stroke-width="1" rx="8" opacity="0.5"/>
      <rect x="15" y="${h - 45}" width="${w - 30}" height="30" rx="6" fill="${secondary}" opacity="0.2"/>
    `;
  }

  const svgString = `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${svgElements}
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString.trim())}`;
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
  const [activePresetTab, setActivePresetTab] = useState<'corporate' | 'school'>('corporate');
  
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

  const handleApplyPreset = (preset: PresetSpec, targetOrientation: 'horizontal' | 'vertical') => {
    setOrientation(targetOrientation);
    setSelectedFieldIndex(null);
    
    // 1. Generate programmatic SVG background
    const bgUrl = generateSvgBackground(
      preset.layoutNum,
      targetOrientation,
      preset.primary,
      preset.secondary,
      preset.accent,
      preset.bg
    );
    setBackgroundUrl(bgUrl);

    // 2. Adjust and align the existing fields configurations
    const updatedFields = [...fieldsConfig];

    updatedFields.forEach((item) => {
      if (item.field === 'Photo') {
        item.type = 'image';
        if (targetOrientation === 'horizontal') {
          item.width = 24;
          item.height = 38;
          if (preset.layoutNum === 2) {
            item.x = 65;
            item.y = 22;
          } else if (preset.layoutNum === 7) {
            item.x = 12;
            item.y = 24;
            item.width = 22;
            item.height = 35;
          } else {
            item.x = 68;
            item.y = 22;
          }
        } else {
          item.width = 36;
          item.height = 25;
          if (preset.layoutNum === 7) {
            item.x = 32;
            item.y = 12;
          } else {
            item.x = 32;
            item.y = 22;
          }
        }
      } else if (item.field === 'Serial Number') {
        item.type = 'text';
        item.fontSize = 9;
        item.bold = true;
        item.align = targetOrientation === 'horizontal' ? 'left' : 'center';
        if (preset.layoutNum === 1) {
          item.color = '#FFFFFF';
          item.x = targetOrientation === 'horizontal' ? 6 : 5;
          item.y = 6;
        } else if (preset.layoutNum === 10) {
          item.color = preset.accent;
          item.x = targetOrientation === 'horizontal' ? 6 : 5;
          item.y = 6;
        } else {
          item.color = preset.primary;
          item.x = targetOrientation === 'horizontal' ? 6 : 5;
          item.y = targetOrientation === 'horizontal' ? 20 : 14;
        }
      } else {
        const fieldLower = item.field.toLowerCase();
        
        if (fieldLower.includes('name')) {
          item.fontSize = 18;
          item.bold = true;
          item.italic = false;
          item.align = targetOrientation === 'horizontal' ? 'left' : 'center';
          
          if (targetOrientation === 'horizontal') {
            if (preset.layoutNum === 7) {
              item.color = '#FFFFFF';
              item.x = 6;
              item.y = 66;
            } else if (preset.layoutNum === 2) {
              item.color = '#111827';
              item.x = 28;
              item.y = 24;
            } else {
              item.color = preset.primary;
              item.x = 6;
              item.y = 36;
            }
          } else {
            if (preset.layoutNum === 7) {
              item.color = '#FFFFFF';
              item.x = 5;
              item.y = 42;
            } else {
              item.color = preset.primary;
              item.x = 5;
              item.y = 53;
            }
          }
        } else if (fieldLower.includes('designation') || fieldLower.includes('role') || fieldLower.includes('title') || fieldLower.includes('class') || fieldLower.includes('grade')) {
          item.fontSize = 12;
          item.bold = false;
          item.italic = true;
          item.align = targetOrientation === 'horizontal' ? 'left' : 'center';
          
          if (targetOrientation === 'horizontal') {
            if (preset.layoutNum === 7) {
              item.color = '#F3F4F6';
              item.x = 6;
              item.y = 78;
            } else if (preset.layoutNum === 2) {
              item.color = '#4B5563';
              item.x = 28;
              item.y = 42;
            } else {
              item.color = '#4B5563';
              item.x = 6;
              item.y = 52;
            }
          } else {
            if (preset.layoutNum === 7) {
              item.color = '#E5E7EB';
              item.x = 5;
              item.y = 50;
            } else {
              item.color = '#4B5563';
              item.x = 5;
              item.y = 62;
            }
          }
        } else if (fieldLower.includes('department') || fieldLower.includes('dept') || fieldLower.includes('school') || fieldLower.includes('section')) {
          item.fontSize = 10;
          item.bold = true;
          item.italic = false;
          item.align = targetOrientation === 'horizontal' ? 'left' : 'center';
          
          if (targetOrientation === 'horizontal') {
            if (preset.layoutNum === 7) {
              item.color = '#374151';
              item.x = 45;
              item.y = 30;
            } else if (preset.layoutNum === 2) {
              item.color = preset.primary;
              item.x = 28;
              item.y = 56;
            } else {
              item.color = preset.accent;
              item.x = 6;
              item.y = 65;
            }
          } else {
            if (preset.layoutNum === 7) {
              item.color = '#4B5563';
              item.x = 5;
              item.y = 62;
            } else {
              item.color = preset.accent;
              item.x = 5;
              item.y = 72;
            }
          }
        } else if (fieldLower.includes('id') || fieldLower.includes('roll') || fieldLower.includes('admission')) {
          item.fontSize = 11;
          item.bold = true;
          item.align = targetOrientation === 'horizontal' ? 'left' : 'center';
          
          if (targetOrientation === 'horizontal') {
            if (preset.layoutNum === 7) {
              item.color = '#111827';
              item.x = 45;
              item.y = 44;
            } else if (preset.layoutNum === 2) {
              item.color = '#111827';
              item.x = 28;
              item.y = 70;
            } else {
              item.color = '#1F2937';
              item.x = 6;
              item.y = 76;
            }
          } else {
            if (preset.layoutNum === 7) {
              item.color = '#111827';
              item.x = 5;
              item.y = 74;
            } else {
              item.color = '#1F2937';
              item.x = 5;
              item.y = 80;
            }
          }
        } else {
          item.fontSize = 10;
          item.bold = false;
          item.align = targetOrientation === 'horizontal' ? 'left' : 'center';
          item.color = '#475569';
          item.x = targetOrientation === 'horizontal' ? 6 : 5;
          item.y = 86;
        }
      }
    });

    setFieldsConfig(updatedFields);
    setSuccessMsg(`Preset "${preset.name}" applied! Please click 'Save Layout' above to persist changes.`);
  };

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

            {/* Design Presets Section */}
            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                  <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" /> Presets ({activePresetTab === 'corporate' ? CORPORATE_PRESETS.length : SCHOOL_PRESETS.length})
                </h3>
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    onClick={() => setActivePresetTab('corporate')}
                    className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${activePresetTab === 'corporate' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                  >
                    Corporate
                  </button>
                  <button
                    onClick={() => setActivePresetTab('school')}
                    className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${activePresetTab === 'school' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                  >
                    School ID
                  </button>
                </div>
              </div>

              {/* Grid list of presets */}
              <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pr-1 border border-slate-100 p-2 rounded-xl bg-slate-50/50">
                {(activePresetTab === 'corporate' ? CORPORATE_PRESETS : SCHOOL_PRESETS).map((preset) => (
                  <div
                    key={preset.id}
                    className="group border border-slate-200 bg-white hover:border-indigo-300 rounded-xl p-2.5 transition-all text-left relative flex flex-col justify-between"
                  >
                    <div>
                      <span className="block text-[11px] font-bold text-slate-700 truncate">{preset.name}</span>
                      {/* Color dots */}
                      <div className="flex gap-1 mt-1.5 mb-2">
                        <span className="h-3 w-3 rounded-full border border-slate-100 shadow-sm" style={{ backgroundColor: preset.primary }} title="Primary" />
                        <span className="h-3 w-3 rounded-full border border-slate-100 shadow-sm" style={{ backgroundColor: preset.accent }} title="Accent" />
                        <span className="h-3 w-3 rounded-full border border-slate-100 shadow-sm" style={{ backgroundColor: preset.secondary }} title="Secondary" />
                        <span className="h-3 w-3 rounded-full border border-slate-100 shadow-sm" style={{ backgroundColor: preset.bg }} title="BG" />
                      </div>
                    </div>

                    {/* Apply actions */}
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      <button
                        onClick={() => handleApplyPreset(preset, 'horizontal')}
                        className="text-[9px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 py-1 rounded-md text-center transition-all cursor-pointer"
                        title="Apply Landscape Layout"
                      >
                        Land.
                      </button>
                      <button
                        onClick={() => handleApplyPreset(preset, 'vertical')}
                        className="text-[9px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 py-1 rounded-md text-center transition-all cursor-pointer"
                        title="Apply Portrait Layout"
                      >
                        Port.
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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
