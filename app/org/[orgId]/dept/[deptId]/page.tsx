/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect, useRef, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase-client';
import ImageEditor from '@/components/image-editor';
import CameraCapture from '@/components/camera-capture';

import { 
  ArrowLeft, 
  ChevronRight, 
  Loader2, 
  AlertCircle,
  Plus, 
  Download, 
  Upload, 
  Palette, 
  FileDown, 
  FileSpreadsheet, 
  Edit3, 
  Trash2, 
  Image as ImageIcon, 
  Eye, 
  X, 
  CheckCircle2, 
  AlertTriangle,
  UserCheck,
  Link2,
  FileArchive,
  Camera
} from 'lucide-react';

interface Department {
  id: string;
  name: string;
  code: string;
  expected_count: number;
  fields_schema: Array<{ name: string; type: 'text' | 'number' | 'date' | 'image' }>;
}

interface Organization {
  id: string;
  name: string;
  code: string;
}

interface RecordRow {
  id: string;
  serial_number: number;
  data: Record<string, any>;
  photo_url: string | null;
  photo_uploaded: boolean;
  created_at: string;
}

interface PageProps {
  params: Promise<{ orgId: string; deptId: string }>;
}

export default function DeptDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const orgId = resolvedParams.orgId;
  const deptId = resolvedParams.deptId;
  
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [dept, setDept] = useState<Department | null>(null);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Single Entry Modals
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RecordRow | null>(null);
  const [targetSerialNumber, setTargetSerialNumber] = useState<number | null>(null);
  const [singleFormData, setSingleFormData] = useState<Record<string, any>>({});
  const [singleFormError, setSingleFormError] = useState<string | null>(null);
  const [singleSubmitting, setSingleSubmitting] = useState(false);
  
  // Image Editor Triggers
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorImgSrc, setEditorImgSrc] = useState<string>('');
  const [activeImageField, setActiveImageField] = useState<string>(''); // name of the field receiving the image
  const [editorTargetRecordId, setEditorTargetRecordId] = useState<string | null>(null); // if row-specific photo upload
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraActiveFieldName, setCameraActiveFieldName] = useState<string>('');
  const [cameraActiveRecordId, setCameraActiveRecordId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Excel Bulk Modals
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [excelRows, setExcelRows] = useState<any[]>([]);
  const [excelPreviewHeaders, setExcelPreviewHeaders] = useState<string[]>([]);
  const [excelUploadError, setExcelUploadError] = useState<string | null>(null);
  const [excelSubmitting, setExcelSubmitting] = useState(false);
  
  // Photo upload trigger for bulk rows
  const [bulkUploadedRecords, setBulkUploadedRecords] = useState<RecordRow[]>([]);
  const [excelSuccessMsg, setExcelSuccessMsg] = useState<string | null>(null);

  // Edit Department States
  const [isEditDeptModalOpen, setIsEditDeptModalOpen] = useState(false);
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [formulaCopied, setFormulaCopied] = useState(false);
  const [editDeptName, setEditDeptName] = useState('');
  const [editExpectedCount, setEditExpectedCount] = useState<number>(0);
  const [editFields, setEditFields] = useState<Array<{ name: string; type: 'text' | 'number' | 'date' | 'image' }>>([]);
  const [updatingDept, setUpdatingDept] = useState(false);
  const [deletingDept, setDeletingDept] = useState(false);
  const [editDeptError, setEditDeptError] = useState<string | null>(null);

  // Filtering & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterField, setFilterField] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'uploaded' | 'missing'>('all');

  const filteredRecords = records.filter(record => {
    // 1. Status Filter
    if (statusFilter === 'uploaded' && !record.photo_uploaded) return false;
    if (statusFilter === 'missing' && record.photo_uploaded) return false;

    // 2. Dynamic fields filtering / SearchTerm
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();

    // If a specific field filter is chosen
    if (filterField !== 'All') {
      const val = record.data[filterField];
      return val ? String(val).toLowerCase().includes(term) : false;
    }

    // Global search across all fields and serial number
    if (record.serial_number.toString().includes(term)) return true;
    for (const f of fieldsSchema) {
      const val = record.data[f.name];
      if (val && String(val).toLowerCase().includes(term)) {
        return true;
      }
    }
    return false;
  });

  const isFiltered = searchTerm.trim() !== '' || statusFilter !== 'all';

  // ZIP Export States
  const [isZipExporting, setIsZipExporting] = useState(false);

  // Bulk Edit States
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [bulkEditField, setBulkEditField] = useState<string>('');
  const [bulkEditValue, setBulkEditValue] = useState<string>('');
  const [bulkEditSubmitting, setBulkEditSubmitting] = useState(false);

  const handleAddEditField = () => {
    setEditFields([...editFields, { name: '', type: 'text' }]);
  };

  const handleRemoveEditField = (index: number) => {
    if (editFields.length <= 1) {
      setEditDeptError('At least one schema field is required.');
      return;
    }
    const updated = [...editFields];
    updated.splice(index, 1);
    setEditFields(updated);
  };

  const handleEditFieldChange = (index: number, key: 'name' | 'type', value: string) => {
    const updated = [...editFields];
    if (key === 'name') {
      updated[index].name = value.replace(/[^a-zA-Z0-9_\s]/g, ''); // alphanumeric + space
    } else {
      updated[index].type = value as any;
    }
    setEditFields(updated);
  };

  const handleDeleteDeptInDetails = async () => {
    const confirmDelete = window.confirm(`Are you sure you want to permanently delete this department "${dept?.name}" and all of its records? This action cannot be undone.`);
    if (!confirmDelete) return;

    setDeletingDept(true);
    try {
      const { error } = await supabase!
        .from('departments')
        .delete()
        .eq('id', deptId);

      if (error) {
        setEditDeptError(error.message);
      } else {
        setIsEditDeptModalOpen(false);
        router.push(`/org/${orgId}`);
      }
    } catch (err: any) {
      setEditDeptError(err?.message || 'Failed to delete department.');
    } finally {
      setDeletingDept(false);
    }
  };

  const handleUpdateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDeptName.trim() || editExpectedCount <= 0) {
      setEditDeptError('Please provide a valid name and an expected count greater than 0.');
      return;
    }

    const cleanedFields = editFields.map(f => ({ ...f, name: f.name.trim() }));
    if (cleanedFields.some(f => !f.name)) {
      setEditDeptError('All dynamic fields must have a valid name.');
      return;
    }

    // Check duplicate names
    const names = cleanedFields.map(f => f.name.toLowerCase());
    if (new Set(names).size !== names.length) {
      setEditDeptError('Field names must be unique.');
      return;
    }

    setUpdatingDept(true);
    setEditDeptError(null);
    try {
      // 1. Update department first
      const { error: deptError } = await supabase!
        .from('departments')
        .update({
          name: editDeptName.trim(),
          expected_count: editExpectedCount,
          fields_schema: cleanedFields
        })
        .eq('id', deptId);

      if (deptError) {
        setEditDeptError(deptError.message);
        return;
      }

      // 2. Fetch all records to migrate their JSON data values to match renamed or updated fields
      if (dept) {
        const { data: recordsData, error: recordsError } = await supabase!
          .from('records')
          .select('*')
          .eq('dept_id', deptId);

        if (!recordsError && recordsData && recordsData.length > 0) {
          for (const rec of recordsData) {
            const updatedRecordData: Record<string, any> = {};
            
            cleanedFields.forEach((newField, newIdx) => {
              // Try to find if a field with the exact same name existed in the old schema
              const oldFieldExact = dept.fields_schema.find(f => f.name === newField.name);
              if (oldFieldExact) {
                updatedRecordData[newField.name] = rec.data[newField.name] !== undefined ? rec.data[newField.name] : '';
              } else {
                // If it is a renamed field (same index, different name, and the old name is not present in the new schema)
                const matchingOldField = dept.fields_schema[newIdx];
                if (matchingOldField && !cleanedFields.some(f => f.name === matchingOldField.name)) {
                  updatedRecordData[newField.name] = rec.data[matchingOldField.name] !== undefined ? rec.data[matchingOldField.name] : '';
                } else {
                  // Completely new field
                  updatedRecordData[newField.name] = '';
                }
              }
            });

            // Update record data
            await supabase!
              .from('records')
              .update({ data: updatedRecordData })
              .eq('id', rec.id);
          }
        }
      }

      await loadPageData();
      setIsEditDeptModalOpen(false);
    } catch (err: any) {
      setEditDeptError(err?.message || 'Failed to update department details.');
    } finally {
      setUpdatingDept(false);
    }
  };

  const router = useRouter();
  const supabase = getSupabaseClient();

  // Load details
  const loadPageData = async () => {
    if (!supabase) return;
    try {
      // Org
      const { data: orgData } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();
      setOrganization(orgData);

      // Dept
      const { data: deptData } = await supabase
        .from('departments')
        .select('*')
        .eq('id', deptId)
        .single();
      setDept(deptData);

      // Records
      const { data: recsData } = await supabase
        .from('records')
        .select('*')
        .eq('dept_id', deptId)
        .order('serial_number', { ascending: true });
      setRecords(recsData || []);
    } catch (err) {
      console.error('Error fetching page records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTimeout(() => {
      loadPageData();
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, deptId]);

  // Compute metrics
  const expectedCount = dept?.expected_count || 0;
  const receivedCount = records.length;
  const pendingCount = Math.max(0, expectedCount - receivedCount);
  const missingPhotoCount = records.filter(r => !r.photo_uploaded).length;
  
  const fieldsSchema = dept?.fields_schema || [];
  
  const missingDataCount = records.filter(r => {
    return fieldsSchema.some(f => {
      const val = r.data[f.name];
      return val === undefined || val === null || val === '';
    });
  }).length;

  // Single record file picker triggers ImageEditor
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string, recordId: string | null = null) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setEditorImgSrc(reader.result as string);
      setActiveImageField(fieldName);
      setEditorTargetRecordId(recordId);
      setIsEditorOpen(true);
    };
    reader.readAsDataURL(file);
  };

  // ImageEditor saves final Blob
  const handleEditorSave = async (finalBlob: Blob) => {
    setIsEditorOpen(false);
    
    // Scenario A: Custom field image in the single creation modal
    if (!editorTargetRecordId) {
      // Save locally in temporary form state
      const reader = new FileReader();
      reader.onload = () => {
        setSingleFormData({
          ...singleFormData,
          [activeImageField]: reader.result as string // Save as Base64 for preview and sending
        });
      };
      reader.readAsDataURL(finalBlob);
      return;
    }

    // Scenario B: Row-specific direct photo upload
    setLoading(true);
    try {
      const form = new FormData();
      form.append('recordId', editorTargetRecordId);
      form.append('photo', finalBlob, 'photo.jpg');

      const response = await fetch('/api/records/upload-photo', {
        method: 'PATCH',
        body: form
      });
      const result = await response.json();

      if (result.error) {
        alert(result.error);
      } else {
        await loadPageData(); // Refresh UI
      }
    } catch (e) {
      console.error('Row photo upload failed:', e);
      alert('Network error uploading image.');
    } finally {
      setLoading(false);
    }
  };

  const handleCameraCapture = (dataUrl: string) => {
    setIsCameraOpen(false);
    setEditorImgSrc(dataUrl);
    setActiveImageField(cameraActiveFieldName);
    setEditorTargetRecordId(cameraActiveRecordId);
    setIsEditorOpen(true);
  };

  // Submit single entry
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSingleFormError(null);
    setSingleSubmitting(true);

    try {
      // 1. Validate Serial Number if provided
      if (!editingRecord && targetSerialNumber !== null) {
        if (targetSerialNumber < 1 || targetSerialNumber > expectedCount) {
          throw new Error(`Serial Number must be between 1 and ${expectedCount}.`);
        }
        const exists = records.some(r => r.serial_number === targetSerialNumber);
        if (exists) {
          throw new Error(`Serial Number ${targetSerialNumber} is already taken.`);
        }
      }

      // 2. Validate custom fields from schema
      for (const field of fieldsSchema) {
        const val = singleFormData[field.name];

        // Required check for non-image fields
        if (field.type !== 'image') {
          if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
            throw new Error(`"${field.name}" is a required field and cannot be empty.`);
          }
        }

        // Phone format regex validation
        const isPhoneField = field.name.toLowerCase().includes('phone') || 
                             field.name.toLowerCase().includes('mobile') || 
                             field.name.toLowerCase().includes('contact') || 
                             field.name.toLowerCase().includes('tel');
        if (isPhoneField && val) {
          const cleanedPhone = String(val).replace(/[\s-()]/g, '');
          const phoneRegex = /^\+?[0-9]{10,12}$/;
          if (!phoneRegex.test(cleanedPhone)) {
            throw new Error(`"${field.name}" must be a valid phone number (10 to 12 digits, e.g. 9876543210 or +919876543210).`);
          }
        }

        // Date validity check
        if (field.type === 'date' && val) {
          const dateObj = new Date(val);
          if (isNaN(dateObj.getTime())) {
            throw new Error(`"${field.name}" must be a valid calendar date.`);
          }
          const year = dateObj.getFullYear();
          if (year < 1900 || year > 2100) {
            throw new Error(`"${field.name}" must have a valid year between 1900 and 2100.`);
          }
        }
      }

      const form = new FormData();
      form.append('deptId', deptId);
      if (targetSerialNumber !== null) {
        form.append('serialNumber', targetSerialNumber.toString());
      }
      
      // Separate custom Photo file if it is stored in base64 state, or put in data
      let photoFileToSend: File | null = null;
      const cleanedData: Record<string, any> = {};

      for (const field of fieldsSchema) {
        let val = singleFormData[field.name];
        if (field.type === 'date' && val) {
          val = formatToDDMMYYYY(val);
        }
        if (field.type === 'image' && field.name.toLowerCase() === 'photo' && val) {
          // Convert Base64 back to file blob
          const res = await fetch(val);
          const blob = await res.blob();
          photoFileToSend = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
        } else {
          cleanedData[field.name] = val || '';
        }
      }

      form.append('data', JSON.stringify(cleanedData));
      if (photoFileToSend) {
        form.append('photo', photoFileToSend);
      }

      const method = editingRecord ? 'PUT' : 'POST';
      if (editingRecord) {
        form.append('recordId', editingRecord.id);
      }

      const response = await fetch('/api/records', {
        method,
        body: form,
      });

      const result = await response.json();

      if (result.error) {
        setSingleFormError(result.error);
      } else {
        setIsSingleModalOpen(false);
        setEditingRecord(null);
        setTargetSerialNumber(null);
        setSingleFormData({});
        await loadPageData();
      }
    } catch (err: any) {
      setSingleFormError(err?.message || 'Submission failed.');
    } finally {
      setSingleSubmitting(false);
    }
  };

  // Open Edit Single entry modal
  const handleOpenEdit = (record: RecordRow) => {
    setEditingRecord(record);
    const initialForm: Record<string, any> = {};
    fieldsSchema.forEach(f => {
      let val = record.data[f.name] || '';
      if (f.type === 'date' && val) {
        val = convertDDMMYYYYToYYYYMMDD(val);
      }
      initialForm[f.name] = val;
    });
    // Set Photo preview url if pre-existing
    if (record.photo_url) {
      initialForm['Photo'] = record.photo_url;
    }
    setSingleFormData(initialForm);
    setIsSingleModalOpen(true);
  };

  // Delete record
  const handleDeleteRecord = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record? This cannot be undone.')) return;
    setLoading(true);
    try {
      const response = await fetch('/api/records', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordIds: [id] })
      });

      const result = await response.json();
      if (result.error) {
        alert(result.error);
      } else {
        await loadPageData();
      }
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Failed to delete record.');
    } finally {
      setLoading(false);
    }
  };

  // Bulk Delete selected records
  const handleBulkDelete = async () => {
    if (selectedRecordIds.length === 0) return;
    const confirmDelete = window.confirm(`Are you sure you want to permanently delete the ${selectedRecordIds.length} selected records and all of their uploaded images? This action cannot be undone.`);
    if (!confirmDelete) return;

    setLoading(true);
    try {
      const response = await fetch('/api/records', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordIds: selectedRecordIds })
      });

      const result = await response.json();
      if (result.error) {
        alert(result.error);
      } else {
        setSelectedRecordIds([]);
        await loadPageData();
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to bulk delete records.');
    } finally {
      setLoading(false);
    }
  };

  // SheetJS - Download excel template
  const handleDownloadTemplate = async () => {
    if (!dept) return;
    const XLSX = await import('xlsx');
    const headers = fieldsSchema.map(f => f.name);
    
    // Add "photo" as standard guide column name if dynamic image exists
    const hasPhotoField = fieldsSchema.some(f => f.name.toLowerCase() === 'photo' || f.type === 'image');
    if (!hasPhotoField) {
      headers.push('Photo');
    }

    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Records Template');
    XLSX.writeFile(wb, `${organization?.code}-${dept.code}-template.xlsx`);
  };

  // SheetJS - Parse excel upload
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelUploadError(null);
    setExcelSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await import('xlsx');
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          setExcelUploadError('The uploaded Excel spreadsheet is empty.');
          return;
        }

        // Detect columns from first row
        const headers = Object.keys(data[0] as any);
        setExcelPreviewHeaders(headers);
        setExcelRows(data);
      } catch (err: any) {
        setExcelUploadError('Failed to parse Excel file. Please ensure it is a valid .xlsx file.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Submit bulk inserts
  const handleBulkSubmit = async () => {
    setExcelSubmitting(true);
    setExcelUploadError(null);
 
    try {
      // Map rows conforming to schema keys
      const formattedRows = excelRows.map((row) => {
        const rowData: Record<string, any> = {};
        fieldsSchema.forEach((f) => {
          let val = row[f.name] !== undefined ? String(row[f.name]) : '';
          if (f.type === 'date' && val) {
            val = formatToDDMMYYYY(val);
          }
          rowData[f.name] = val;
        });
        return rowData;
      });

      const response = await fetch('/api/records/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deptId,
          rows: formattedRows,
        }),
      });

      const result = await response.json();

      if (result.error) {
        setExcelUploadError(result.error);
      } else {
        setBulkUploadedRecords(result.records || []);
        setExcelSuccessMsg(`Successfully imported ${formattedRows.length} records in bulk! You can now upload photos row-by-row below.`);
        setExcelRows([]);
        await loadPageData();
      }
    } catch (err: any) {
      setExcelUploadError(err?.message || 'Bulk insertion failed.');
    } finally {
      setExcelSubmitting(false);
    }
  };

  // Export active records directly to Excel
  const handleExportExcelOnly = async () => {
    if (!dept || !organization) return;
    const XLSX = await import('xlsx');
    
    // Build headers
    const headers = ['Serial Number', ...fieldsSchema.map(f => f.name), 'Photo Status', 'Photo URL', 'Created At'];
    
    // Build rows
    const tableRows = records.map((r) => {
      const rowData: Record<string, any> = {
        'Serial Number': r.serial_number
      };
      
      fieldsSchema.forEach((f) => {
        let val = r.data[f.name] || '';
        if (f.type === 'date' && val) {
          const dateMatch = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (dateMatch) {
            val = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
          }
        }
        rowData[f.name] = val;
      });
      
      rowData['Photo Status'] = r.photo_uploaded ? 'Uploaded' : 'Missing';
      rowData['Photo URL'] = r.photo_url || 'N/A';
      rowData['Created At'] = new Date(r.created_at).toLocaleDateString();
      
      return rowData;
    });
    
    // Generate spreadsheet using xlsx
    const ws = XLSX.utils.json_to_sheet(tableRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Roster Records');
    
    XLSX.writeFile(wb, `${organization.code}-${dept.code}-roster.xlsx`);
  };

  // jsPDF - Generate PDF of Records with highlighted gaps
  const handleDownloadPdf = async () => {
    if (!dept || !organization) return;
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF() as any;
    
    let fontName = 'Helvetica';
    try {
      // Fetch Noto Sans Devanagari regular font for Hindi Unicode rendering support
      const response = await fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/notosansdevanagari/NotoSansDevanagari-Regular.ttf');
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        
        // Native browser FileReader based safe base64 converter
        const base64Font = await new Promise<string>((resolve) => {
          const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
          const reader = new FileReader();
          reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            const base64 = dataUrl.split(',')[1];
            resolve(base64);
          };
          reader.readAsDataURL(blob);
        });

        doc.addFileToVFS('NotoSansDevanagari-Regular.ttf', base64Font);
        doc.addFont('NotoSansDevanagari-Regular.ttf', 'NotoSansDevanagari', 'normal');
        fontName = 'NotoSansDevanagari';
      }
    } catch (err) {
      console.warn('Unable to load NotoSansDevanagari font, falling back to Helvetica', err);
    }

    doc.setFont(fontName);
    doc.setFontSize(16);
    doc.text(`${organization.name} - ${dept.name} Status Report`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Total Expected Quota: ${expectedCount} | Entries Received: ${receivedCount}`, 14, 21);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 26);

    const headers = ['Serial', ...fieldsSchema.map(f => f.name), 'Photo Status'];
    const tableRows: any[] = [];

    for (let s = 1; s <= expectedCount; s++) {
      const rec = records.find(r => r.serial_number === s);
      if (!rec) {
        const emptyRow = [s, ...fieldsSchema.map(() => 'Not Received'), 'Not Received'];
        tableRows.push(emptyRow);
      } else {
        const rowData: any[] = [s];
        fieldsSchema.forEach(f => {
          rowData.push(rec.data[f.name] || 'Missing');
        });
        rowData.push(rec.photo_uploaded ? 'Uploaded' : 'Missing');
        tableRows.push(rowData);
      }
    }

    autoTable(doc, {
      startY: 32,
      head: [headers],
      body: tableRows,
      styles: {
        font: fontName,
      },
      headStyles: {
        font: fontName,
      },
      bodyStyles: {
        font: fontName,
      },
      didParseCell: (dataCell: any) => {
        const text = dataCell.cell.text[0];
        if (text === 'Not Received') {
          dataCell.cell.styles.fillColor = [254, 226, 226]; // Red highlight
          dataCell.cell.styles.textColor = [220, 38, 38];
        } else if (text === 'Missing') {
          dataCell.cell.styles.fillColor = [255, 247, 237]; // Light yellow for missing cells
          dataCell.cell.styles.textColor = [234, 88, 12];
        }
      }
    });

    doc.save(`${organization.code}-${dept.code}-report.pdf`);
  };

  // Robust date-handling helpers
  const formatToDDMMYYYY = (val: any): string => {
    if (!val) return '';
    const trimmed = String(val).trim();
    if (!trimmed) return '';

    // 1. If it matches DD-MM-YYYY or DD/MM/YYYY
    const dmMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmMatch) {
      const dd = dmMatch[1].padStart(2, '0');
      const mm = dmMatch[2].padStart(2, '0');
      const yyyy = dmMatch[3];
      return `${dd}-${mm}-${yyyy}`;
    }

    // 2. If it matches YYYY-MM-DD or YYYY/MM/DD
    const ymdMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (ymdMatch) {
      const yyyy = ymdMatch[1];
      const mm = ymdMatch[2].padStart(2, '0');
      const dd = ymdMatch[3].padStart(2, '0');
      return `${dd}-${mm}-${yyyy}`;
    }

    // 3. If it's a normal number (like an Excel serial date number or just a timestamp)
    const num = Number(trimmed);
    if (!isNaN(num) && num > 1000) {
      if (num < 100000) {
        try {
          const date = new Date((num - 25569) * 86400 * 1000);
          if (!isNaN(date.getTime())) {
            const dd = String(date.getDate()).padStart(2, '0');
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const yyyy = date.getFullYear();
            return `${dd}-${mm}-${yyyy}`;
          }
        } catch (e) {}
      } else {
        try {
          const date = new Date(num);
          if (!isNaN(date.getTime())) {
            const dd = String(date.getDate()).padStart(2, '0');
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const yyyy = date.getFullYear();
            return `${dd}-${mm}-${yyyy}`;
          }
        } catch (e) {}
      }
    }

    // 4. Try parsing as a generic date string
    try {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
      }
    } catch (e) {}

    return trimmed;
  };

  const convertDDMMYYYYToYYYYMMDD = (val: string): string => {
    if (!val) return '';
    const match = val.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (match) {
      const dd = match[1].padStart(2, '0');
      const mm = match[2].padStart(2, '0');
      const yyyy = match[3];
      return `${yyyy}-${mm}-${dd}`;
    }
    return val;
  };

  // Format date string
  const formatDateString = (val: string): string => {
    return formatToDDMMYYYY(val);
  };

  // Export all cards + Excel metadata as ZIP
  const handleExportZip = async () => {
    if (!dept || !organization) return;
    setIsZipExporting(true);
    try {
      const response = await fetch(`/api/cards/export-all/${deptId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate ZIP.');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${organization.code.toUpperCase()}-${dept.code.toUpperCase()}-all-cards.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Error downloading ZIP archive.');
    } finally {
      setIsZipExporting(false);
    }
  };

  // Submit bulk edit changes
  const handleBulkEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkEditField || selectedRecordIds.length === 0) return;
    
    setBulkEditSubmitting(true);
    try {
      const response = await fetch('/api/records', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordIds: selectedRecordIds,
          fieldName: bulkEditField,
          newValue: bulkEditValue
        })
      });

      const result = await response.json();
      if (result.error) {
        alert(result.error);
      } else {
        setIsBulkEditModalOpen(false);
        setSelectedRecordIds([]);
        setBulkEditField('');
        setBulkEditValue('');
        await loadPageData();
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to apply bulk edit.');
    } finally {
      setBulkEditSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-sm font-medium text-slate-500">Loading record management console...</p>
        </div>
      </div>
    );
  }

  if (!dept || !organization) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href={`/org/${orgId}`}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                id="back-to-org-btn"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-display font-semibold text-slate-500 text-sm">{organization.name}</span>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                  <span className="font-display text-base font-bold text-slate-900">{dept.name}</span>
                  <button
                    onClick={() => {
                      setEditDeptName(dept.name);
                      setEditExpectedCount(dept.expected_count);
                      setEditFields(JSON.parse(JSON.stringify(dept.fields_schema || [])));
                      setEditDeptError(null);
                      setIsEditDeptModalOpen(true);
                    }}
                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                    title="Edit Department Details"
                    id="edit-dept-btn"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Link
                href={`/org/${orgId}/dept/${deptId}/design`}
                className="flex items-center space-x-1 bg-white hover:bg-slate-50 text-indigo-600 border border-slate-200 rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition-colors"
                id="design-cards-btn"
              >
                <Palette className="h-4 w-4" />
                <span>Card Designer</span>
              </Link>

              <a
                href={`/api/cards/export-all/${deptId}`}
                className="flex items-center space-x-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-4 py-2 text-sm font-semibold shadow-md shadow-indigo-100 transition-colors"
                id="export-all-btn"
              >
                <Download className="h-4 w-4" />
                <span>Export All (ZIP)</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Action Controls Section */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">
              Record Console
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Add individual items, batch upload spreadsheets, inspect missing cells, and print cards.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              id="bulk-upload-trigger-btn"
              onClick={() => setIsExcelModalOpen(true)}
              className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors"
            >
              <Upload className="h-4 w-4 text-emerald-600" />
              <span>Bulk Spreadsheet Upload</span>
            </button>

            <button
              id="excel-export-btn"
              onClick={handleExportExcelOnly}
              className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Excel Export</span>
            </button>

            <button
              id="zip-export-btn"
              onClick={handleExportZip}
              disabled={isZipExporting}
              className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              {isZipExporting ? (
                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
              ) : (
                <FileArchive className="h-4 w-4 text-indigo-600" />
              )}
              <span>Export Cards (ZIP)</span>
            </button>

            <button
              id="pdf-report-btn"
              onClick={handleDownloadPdf}
              className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors"
            >
              <FileDown className="h-4 w-4 text-rose-600" />
              <span>Status Report (PDF)</span>
            </button>

            <button
              id="add-single-entry-btn"
              onClick={() => {
                setEditingRecord(null);
                setTargetSerialNumber(null);
                setSingleFormData({});
                setIsSingleModalOpen(true);
              }}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-indigo-100 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add Single Entry</span>
            </button>
          </div>
        </div>

        {/* Dynamic Statistics Panel with Destructive Warning Layout */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-8" id="metrics-grid">
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Expected</span>
            <span className="text-3xl font-bold text-slate-800 mt-2">{expectedCount}</span>
          </div>

          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Received (Active)</span>
            <span className="text-3xl font-bold text-slate-800 mt-2">{receivedCount}</span>
          </div>

          <div className={`p-5 rounded-2xl border flex flex-col justify-between ${pendingCount > 0 ? 'bg-red-50 border-red-200 text-red-900 shadow-sm' : 'bg-white border-slate-200'}`}>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pending Receipt</span>
            <span className={`text-3xl font-bold mt-2 ${pendingCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>{pendingCount}</span>
          </div>

          <div className={`p-5 rounded-2xl border flex flex-col justify-between ${missingPhotoCount > 0 ? 'bg-red-50 border-red-200 text-red-900 shadow-sm' : 'bg-white border-slate-200'}`}>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Missing Portrait</span>
            <span className={`text-3xl font-bold mt-2 ${missingPhotoCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>{missingPhotoCount}</span>
          </div>

          <div className={`p-5 rounded-2xl border flex flex-col justify-between ${missingDataCount > 0 ? 'bg-red-50 border-red-200 text-red-900 shadow-sm' : 'bg-white border-slate-200'}`}>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Missing Data Cells</span>
            <span className={`text-3xl font-bold mt-2 ${missingDataCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>{missingDataCount}</span>
          </div>
        </section>

        {/* Warning Callout when statistics has gaps */}
        {(pendingCount > 0 || missingPhotoCount > 0 || missingDataCount > 0) && (
          <div className="rounded-2xl bg-red-50 border border-red-100 p-4 mb-8 flex items-start gap-3 animate-fade-in" id="compliance-warning">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-red-900">Database Compliance Alert</h4>
              <p className="text-xs text-red-700 mt-0.5">
                Some participant records are not completed. Gaps are highlighted in red in the preview matrix below. Update their properties or upload photos before card generation.
              </p>
            </div>
          </div>
        )}

        {/* Bulk Edit Action Bar */}
        {selectedRecordIds.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-150 p-4 rounded-2xl mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in shadow-sm">
            <div className="flex items-center gap-3">
              <span className="bg-indigo-600 text-white font-bold text-xs px-2.5 py-1 rounded-full">
                {selectedRecordIds.length} Selected
              </span>
              <p className="text-sm font-semibold text-indigo-900">
                Bulk action active for school ID cards batch update.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setBulkEditField('');
                  setBulkEditValue('');
                  setIsBulkEditModalOpen(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm"
              >
                Bulk Edit Columns
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Bulk Delete
              </button>
              <button
                type="button"
                onClick={() => setSelectedRecordIds([])}
                className="text-indigo-600 hover:bg-indigo-100 text-xs font-bold px-3 py-2 rounded-xl transition-colors"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Matrix Table Preview */}
        <section className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden" id="records-table-container">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-display font-bold text-slate-900 text-base">Participant Preview Matrix</h3>
              <p className="text-xs text-slate-400 font-medium font-mono">Quota range: 1 - {expectedCount}</p>
            </div>

            {/* Filtering & Search Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Search Input */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search records..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 pl-8 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-400 w-44"
                />
                <svg className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Dynamic Field Selector */}
              <select
                value={filterField}
                onChange={(e) => setFilterField(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-600 outline-none focus:border-indigo-500 transition-all cursor-pointer"
              >
                <option value="All">All Fields</option>
                {fieldsSchema.map((f, i) => (
                  <option key={i} value={f.name}>{f.name}</option>
                ))}
              </select>

              {/* Portrait Status Selector */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-600 outline-none focus:border-indigo-500 transition-all cursor-pointer"
              >
                <option value="all">All Portrait Status</option>
                <option value="uploaded">With Portrait</option>
                <option value="missing">Missing Portrait</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/60 font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3.5 w-10">
                    <input
                      type="checkbox"
                      checked={records.length > 0 && selectedRecordIds.length === records.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRecordIds(records.map(r => r.id));
                        } else {
                          setSelectedRecordIds([]);
                        }
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-3.5 w-16">Serial</th>
                  {fieldsSchema.map((f, i) => (
                    <th key={i} className="px-4 py-3.5">{f.name}</th>
                  ))}
                  <th className="px-4 py-3.5 w-32">Photo</th>
                  <th className="px-6 py-3.5 text-right w-44">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {isFiltered ? (
                  filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={fieldsSchema.length + 4} className="text-center py-10 text-slate-400 font-semibold italic">
                        No records match the current filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((record) => {
                      const serialNum = record.serial_number;
                      return (
                        <tr key={record.id} className="hover:bg-slate-50/60 transition-colors animate-fade-in" id={`row-record-${serialNum}`}>
                          <td className="px-4 py-4 w-10">
                            <input
                              type="checkbox"
                              checked={selectedRecordIds.includes(record.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRecordIds([...selectedRecordIds, record.id]);
                                } else {
                                  setSelectedRecordIds(selectedRecordIds.filter(id => id !== record.id));
                                }
                              }}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                            />
                          </td>
                          <td className="px-6 py-4 font-mono font-semibold text-slate-600">{serialNum}</td>
                          
                          {/* Render schema fields */}
                          {fieldsSchema.map((field, fIdx) => {
                            let val = record.data[field.name];
                            const isMissing = val === undefined || val === null || val === '';
                            if (!isMissing && field.type === 'date') {
                              val = formatDateString(val);
                            }
                            return (
                              <td 
                                key={fIdx} 
                                className={`px-4 py-4 ${isMissing ? 'bg-red-50/40 text-red-600 font-semibold' : 'text-slate-700'}`}
                              >
                                {isMissing ? 'Missing' : val}
                              </td>
                            );
                          })}

                          {/* Photo Column - Size Doubled (h-20 w-20) for 2x clarity */}
                          <td className="px-4 py-4">
                            {record.photo_uploaded && record.photo_url ? (
                              <div className="relative h-20 w-20 rounded-lg overflow-hidden border border-slate-200 shadow-sm hover:scale-105 transition-transform duration-200 cursor-pointer">
                                <img 
                                  src={record.photo_url} 
                                  alt="Avatar" 
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 px-2 py-1 rounded-md w-fit">
                                <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                                <span>Missing</span>
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Direct photo upload tool if missing or changing */}
                              <div className="relative">
                                <input 
                                  type="file" 
                                  accept="image/*"
                                  className="hidden" 
                                  id={`row-file-${record.id}`}
                                  onChange={(e) => handlePhotoSelect(e, 'Photo', record.id)}
                                />
                                <label 
                                  htmlFor={`row-file-${record.id}`}
                                  className="cursor-pointer p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg flex items-center justify-center transition-colors"
                                  title="Upload Photo"
                                >
                                  <ImageIcon className="h-4 w-4" />
                                </label>
                              </div>

                              <button
                                onClick={() => {
                                  setCameraActiveFieldName('Photo');
                                  setCameraActiveRecordId(record.id);
                                  setIsCameraOpen(true);
                                }}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg flex items-center justify-center transition-colors"
                                title="Capture with Camera"
                              >
                                <Camera className="h-4 w-4" />
                              </button>

                              <button
                                onClick={() => handleOpenEdit(record)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg flex items-center justify-center transition-colors"
                                title="Edit Record"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>

                              {record.photo_uploaded && (
                                <a
                                  href={`/api/cards/single/${record.id}`}
                                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-center transition-colors"
                                  title="Export Card PNG"
                                  id={`export-single-btn-${record.id}`}
                                >
                                  <FileSpreadsheet className="h-4 w-4" />
                                </a>
                              )}

                              <button
                                onClick={() => handleDeleteRecord(record.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-100 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                                title="Delete Record"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )
                ) : (
                  Array.from({ length: expectedCount }).map((_, idx) => {
                    const serialNum = idx + 1;
                    const record = records.find(r => r.serial_number === serialNum);

                    if (!record) {
                      // Empty row highlight
                      return (
                        <tr key={serialNum} className="bg-red-50/20 hover:bg-red-50/40 transition-colors animate-fade-in" id={`row-empty-${serialNum}`}>
                          <td className="px-4 py-4 w-10"></td>
                          <td className="px-6 py-4 font-mono font-bold text-red-600">{serialNum}</td>
                          {fieldsSchema.map((_, fIdx) => (
                            <td key={fIdx} className="px-4 py-4 text-red-500 italic font-medium">Not Received</td>
                          ))}
                          <td className="px-4 py-4 text-red-500 italic font-medium">Missing</td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => {
                                setEditingRecord(null);
                                setTargetSerialNumber(serialNum);
                                setSingleFormData({});
                                setIsSingleModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-500 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-lg px-2.5 py-1.5 transition-all"
                            >
                              <Plus className="h-3 w-3" /> Fill Entry
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    // Record exists
                    return (
                      <tr key={record.id} className="hover:bg-slate-50/60 transition-colors" id={`row-record-${serialNum}`}>
                        <td className="px-4 py-4 w-10">
                          <input
                            type="checkbox"
                            checked={selectedRecordIds.includes(record.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRecordIds([...selectedRecordIds, record.id]);
                              } else {
                                setSelectedRecordIds(selectedRecordIds.filter(id => id !== record.id));
                              }
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-4 font-mono font-semibold text-slate-600">{serialNum}</td>
                        
                        {/* Render schema fields */}
                        {fieldsSchema.map((field, fIdx) => {
                          let val = record.data[field.name];
                          const isMissing = val === undefined || val === null || val === '';
                          if (!isMissing && field.type === 'date') {
                            val = formatDateString(val);
                          }
                          return (
                            <td 
                              key={fIdx} 
                              className={`px-4 py-4 ${isMissing ? 'bg-red-50/40 text-red-600 font-semibold' : 'text-slate-700'}`}
                            >
                              {isMissing ? 'Missing' : val}
                            </td>
                          );
                        })}

                        {/* Photo Column - Size Doubled (h-20 w-20) for 2x clarity */}
                        <td className="px-4 py-4">
                          {record.photo_uploaded && record.photo_url ? (
                            <div className="relative h-20 w-20 rounded-lg overflow-hidden border border-slate-200 shadow-sm hover:scale-105 transition-transform duration-200 cursor-pointer">
                              <img 
                                src={record.photo_url} 
                                alt="Avatar" 
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 px-2 py-1 rounded-md w-fit">
                              <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                              <span>Missing</span>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Direct photo upload tool if missing or changing */}
                            <div className="relative">
                              <input 
                                type="file" 
                                accept="image/*"
                                className="hidden" 
                                id={`row-file-${record.id}`}
                                onChange={(e) => handlePhotoSelect(e, 'Photo', record.id)}
                              />
                              <label 
                                htmlFor={`row-file-${record.id}`}
                                className="cursor-pointer p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg flex items-center justify-center transition-colors"
                                title="Upload Photo"
                              >
                                <ImageIcon className="h-4 w-4" />
                              </label>
                            </div>

                            <button
                              onClick={() => {
                                setCameraActiveFieldName('Photo');
                                setCameraActiveRecordId(record.id);
                                setIsCameraOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg flex items-center justify-center transition-colors"
                              title="Capture with Camera"
                            >
                              <Camera className="h-4 w-4" />
                            </button>

                            <button
                              onClick={() => handleOpenEdit(record)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg flex items-center justify-center transition-colors"
                              title="Edit Record"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>

                            {record.photo_uploaded && (
                              <a
                                href={`/api/cards/single/${record.id}`}
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-center transition-colors"
                                title="Export Card PNG"
                                id={`export-single-btn-${record.id}`}
                              >
                                <FileSpreadsheet className="h-4 w-4" />
                              </a>
                            )}

                            <button
                              onClick={() => handleDeleteRecord(record.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded-lg flex items-center justify-center transition-colors"
                              title="Delete Record"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Single Add/Edit Entry Modal */}
      {isSingleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in" id="single-entry-modal">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 relative animate-scale-up max-h-[90vh] overflow-y-auto">
            <h3 className="font-display text-xl font-bold text-slate-900 mb-1">
              {editingRecord ? 'Update Record' : 'Add Single Record'}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Complete the properties for this participant card.
            </p>

            {singleFormError && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 border border-red-100 mb-4 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{singleFormError}</span>
              </div>
            )}

            <form onSubmit={handleSingleSubmit} className="space-y-4">
              {/* Display / edit of Serial Number */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Serial Number (Row Slot)
                </label>
                <input
                  type="number"
                  disabled={editingRecord !== null || targetSerialNumber !== null}
                  value={editingRecord ? editingRecord.serial_number : (targetSerialNumber || '')}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setTargetSerialNumber(isNaN(val) ? null : val);
                  }}
                  placeholder="Auto-assigned sequentially"
                  className="block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 bg-slate-50 disabled:opacity-75 sm:text-sm outline-none transition-all font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  {editingRecord || targetSerialNumber 
                    ? "Fixed slot number for this card row." 
                    : "Leave blank to automatically assign the next sequential slot."}
                </p>
              </div>

              {fieldsSchema.map((field) => (
                <div key={field.name}>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    {field.name}
                  </label>
                  
                  {field.type === 'text' && (
                    <input
                      type="text"
                      placeholder={`Enter ${field.name}`}
                      value={singleFormData[field.name] || ''}
                      onChange={(e) => setSingleFormData({ ...singleFormData, [field.name]: e.target.value })}
                      className="block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm outline-none transition-all"
                    />
                  )}

                  {field.type === 'number' && (
                    <input
                      type="number"
                      placeholder={`Enter ${field.name}`}
                      value={singleFormData[field.name] || ''}
                      onChange={(e) => setSingleFormData({ ...singleFormData, [field.name]: e.target.value })}
                      className="block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm outline-none transition-all"
                    />
                  )}

                  {field.type === 'date' && (
                    <input
                      type="date"
                      value={singleFormData[field.name] || ''}
                      onChange={(e) => setSingleFormData({ ...singleFormData, [field.name]: e.target.value })}
                      className="block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm outline-none transition-all"
                    />
                  )}

                  {field.type === 'image' && (
                    <div className="space-y-2">
                      <div className="flex gap-2.5 items-center">
                        <input 
                          type="file" 
                          accept="image/*"
                          ref={fileInputRef}
                          className="hidden"
                          onChange={(e) => handlePhotoSelect(e, field.name)}
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors"
                        >
                          <ImageIcon className="h-4 w-4" /> Pick Image
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setCameraActiveFieldName(field.name);
                            setCameraActiveRecordId(null);
                            setIsCameraOpen(true);
                          }}
                          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-150 rounded-xl text-xs font-semibold transition-colors"
                        >
                          <Camera className="h-4 w-4" /> Camera
                        </button>
                        
                        {singleFormData[field.name] && (
                          <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                          </span>
                        )}
                      </div>

                      {singleFormData[field.name] && (
                        <div className="relative h-40 w-40 rounded-xl border border-slate-200 overflow-hidden">
                          <img 
                            src={singleFormData[field.name]} 
                            alt="Crop Preview" 
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Standard Photo option if schema has no images but we want to upload */}
              {!fieldsSchema.some(f => f.type === 'image') && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Card Photo / Portrait
                  </label>
                  <div className="space-y-2">
                    <div className="flex gap-2.5 items-center">
                      <input 
                        type="file" 
                        accept="image/*"
                        className="hidden"
                        id="standard-photo-picker"
                        onChange={(e) => handlePhotoSelect(e, 'Photo')}
                      />
                      <label
                        htmlFor="standard-photo-picker"
                        className="cursor-pointer flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors"
                      >
                        <ImageIcon className="h-4 w-4" /> Choose Photo
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          setCameraActiveFieldName('Photo');
                          setCameraActiveRecordId(null);
                          setIsCameraOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-150 rounded-xl text-xs font-semibold transition-colors"
                      >
                        <Camera className="h-4 w-4" /> Camera
                      </button>
                      
                      {singleFormData['Photo'] && (
                        <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Attached
                        </span>
                      )}
                    </div>

                    {singleFormData['Photo'] && (
                      <div className="relative h-40 w-40 rounded-xl border border-slate-200 overflow-hidden">
                        <img 
                          src={singleFormData['Photo']} 
                          alt="Crop Preview" 
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Footer Buttons */}
              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsSingleModalOpen(false);
                    setEditingRecord(null);
                    setTargetSerialNumber(null);
                    setSingleFormError(null);
                  }}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={singleSubmitting}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-100"
                >
                  {singleSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    editingRecord ? 'Update' : 'Add'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {isBulkEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md p-6 relative">
            <button
              onClick={() => setIsBulkEditModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="font-display text-xl font-bold text-slate-900 mb-2">
              Bulk Edit Selected Records
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              You are editing <strong>{selectedRecordIds.length}</strong> records at once. Perfect for fast class, section, or department updates.
            </p>

            <form onSubmit={handleBulkEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Select Column to Update
                </label>
                <select
                  required
                  value={bulkEditField}
                  onChange={(e) => {
                    setBulkEditField(e.target.value);
                    setBulkEditValue('');
                  }}
                  className="block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 bg-white sm:text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">-- Choose Field --</option>
                  {fieldsSchema.map((field) => (
                    <option key={field.name} value={field.name}>
                      {field.name} ({field.type})
                    </option>
                  ))}
                </select>
              </div>

              {bulkEditField && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Enter New Value
                  </label>
                  {fieldsSchema.find(f => f.name === bulkEditField)?.type === 'date' ? (
                    <input
                      type="date"
                      required
                      value={bulkEditValue}
                      onChange={(e) => setBulkEditValue(e.target.value)}
                      className="block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 sm:text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  ) : fieldsSchema.find(f => f.name === bulkEditField)?.type === 'number' ? (
                    <input
                      type="number"
                      required
                      value={bulkEditValue}
                      onChange={(e) => setBulkEditValue(e.target.value)}
                      className="block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 sm:text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  ) : (
                    <input
                      type="text"
                      required
                      value={bulkEditValue}
                      onChange={(e) => setBulkEditValue(e.target.value)}
                      placeholder="Enter the new common value"
                      className="block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 sm:text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  )}
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBulkEditModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bulkEditSubmitting || !bulkEditField}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {bulkEditSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    'Apply Update'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Editor Modal overlay */}
      {isEditorOpen && (
        <ImageEditor 
          imageSrc={editorImgSrc}
          onClose={() => setIsEditorOpen(false)}
          onSave={handleEditorSave}
        />
      )}

      {/* Camera Capture Modal overlay */}
      {isCameraOpen && (
        <CameraCapture 
          onCapture={handleCameraCapture}
          onClose={() => setIsCameraOpen(false)}
        />
      )}

      {/* Excel Bulk Upload Modal */}
      {isExcelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in" id="bulk-upload-modal">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 relative animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-display text-xl font-bold text-slate-900">
                Bulk Spreadsheet Upload
              </h3>
              <button 
                onClick={() => {
                  setIsExcelModalOpen(false);
                  setExcelRows([]);
                  setExcelUploadError(null);
                  setExcelSuccessMsg(null);
                }}
                className="text-slate-400 hover:bg-slate-50 hover:text-slate-600 p-1 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {excelSuccessMsg && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 mb-4">
                <h4 className="text-sm font-bold text-emerald-900">Success!</h4>
                <p className="text-xs text-emerald-700 mt-0.5">{excelSuccessMsg}</p>
                
                {/* Display rows to upload photo */}
                {bulkUploadedRecords.length > 0 && (
                  <div className="mt-4 border-t border-emerald-200/50 pt-3">
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1 mb-2">
                      <UserCheck className="h-4 w-4" /> Quick Upload Row Photos
                    </span>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                      {bulkUploadedRecords.map((rec) => (
                        <div key={rec.id} className="flex items-center justify-between bg-white border border-slate-100 p-2 rounded-lg text-xs">
                          <span className="font-semibold text-slate-700 font-mono">Row #{rec.serial_number}</span>
                          <input 
                            type="file" 
                            accept="image/*"
                            id={`row-photo-picker-${rec.id}`}
                            className="hidden"
                            onChange={(e) => handlePhotoSelect(e, 'Photo', rec.id)}
                          />
                          <label
                            htmlFor={`row-photo-picker-${rec.id}`}
                            className="cursor-pointer bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 font-bold px-2.5 py-1 rounded-md text-[10px] transition-all flex items-center gap-1"
                          >
                            <ImageIcon className="h-3 w-3" /> Photo
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {excelUploadError && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 border border-red-100 mb-4 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{excelUploadError}</span>
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2 mb-6">
              {/* Step 1: Download */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 mb-3">
                    <Download className="h-4.5 w-4.5" />
                  </span>
                  <h4 className="font-bold text-slate-800 text-sm">1. Download Excel Template</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Get an Excel spreadsheet pre-configured with headers matching your exact dynamic department schema.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="mt-4 flex items-center justify-center gap-1.5 w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-4 py-2 text-xs font-semibold shadow-md shadow-indigo-100 transition-colors"
                >
                  <FileDown className="h-4 w-4" /> Download Template
                </button>
              </div>

              {/* Step 2: Upload */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 mb-3">
                    <Upload className="h-4.5 w-4.5" />
                  </span>
                  <h4 className="font-bold text-slate-800 text-sm">2. Upload Spreadsheet</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Upload your completed spreadsheet. All rows will be parsed, validated, and staged for creation.
                  </p>
                </div>
                <div className="mt-4">
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    id="excel-file-uploader"
                    className="hidden"
                    onChange={handleExcelUpload}
                  />
                  <label
                    htmlFor="excel-file-uploader"
                    className="cursor-pointer flex items-center justify-center gap-1.5 w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl px-4 py-2 text-xs font-semibold shadow-sm transition-colors"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Choose Excel File
                  </label>
                </div>
              </div>
            </div>

            {/* Stage Parsing Preview */}
            {excelRows.length > 0 && (
              <div className="border-t border-slate-100 pt-4 animate-fade-in">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-slate-900">Parsed Spreadsheet Matrix ({excelRows.length} Rows)</h4>
                  <span className="text-[11px] font-mono text-slate-400">Previewing first 5 rows</span>
                </div>
                
                <div className="overflow-x-auto border border-slate-100 rounded-xl bg-slate-50/50 max-h-48">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 uppercase font-mono tracking-wider font-semibold">
                        {excelPreviewHeaders.slice(0, 5).map((h, i) => (
                          <th key={i} className="px-3 py-2">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {excelRows.slice(0, 5).map((row, rIdx) => (
                        <tr key={rIdx}>
                          {excelPreviewHeaders.slice(0, 5).map((h, hIdx) => (
                            <td key={hIdx} className="px-3 py-2 text-slate-600">{String(row[h] || '')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Confirm upload */}
                <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setExcelRows([]);
                      setExcelUploadError(null);
                    }}
                    className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkSubmit}
                    disabled={excelSubmitting}
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-100"
                  >
                    {excelSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Confirm & Bulk Insert'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Department Modal */}
      {isEditDeptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in" id="edit-dept-modal">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 relative animate-scale-up max-h-[90vh] overflow-y-auto">
            <h3 className="font-display text-xl font-bold text-slate-900 mb-1" id="edit-dept-modal-title">
              Edit Department Details
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Update the name, allocated size (expected count), and data fields schema of this department.
            </p>

            {editDeptError && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 border border-red-100 mb-4 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{editDeptError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateDept} className="space-y-6" id="edit-dept-form">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Department Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Engineering Staff"
                    value={editDeptName}
                    onChange={(e) => setEditDeptName(e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Expected Count (Allocated Size)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 150"
                    value={editExpectedCount || ''}
                    onChange={(e) => setEditExpectedCount(parseInt(e.target.value) || 0)}
                    className="block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-400">
                  Updating Expected Count changes the participant matrix slots. Gaps will highlight automatically.
                </p>
              </div>

              {/* Dynamic Field Builder */}
              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Fields & Schema Rules</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Edit, add, or delete metadata fields printed on cards.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddEditField}
                    className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-500 bg-indigo-50 px-2.5 py-1.5 rounded-lg border border-indigo-100 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> Add Field
                  </button>
                </div>

                <div className="space-y-3 max-h-56 overflow-y-auto pr-1" id="edit-schema-rows-container">
                  {editFields.map((field, idx) => (
                    <div key={idx} className="flex gap-2 items-center animate-fade-in" id={`edit-schema-row-${idx}`}>
                      <div className="flex-1">
                        <input
                           type="text"
                           required
                           placeholder="e.g. Employee ID, Designation"
                           value={field.name}
                           onChange={(e) => handleEditFieldChange(idx, 'name', e.target.value)}
                           className="block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm outline-none transition-all"
                        />
                      </div>
                      <div className="w-32">
                        <select
                           value={field.type}
                           onChange={(e) => handleEditFieldChange(idx, 'type', e.target.value)}
                           className="block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm outline-none transition-all"
                        >
                           <option value="text">Text</option>
                           <option value="number">Number</option>
                           <option value="date">Date</option>
                           <option value="image">Image</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveEditField(idx)}
                        disabled={editFields.length <= 1}
                        className="p-2.5 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 border border-slate-200 rounded-xl transition-colors disabled:opacity-40 disabled:hover:bg-slate-50 disabled:hover:text-slate-400 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex justify-between gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleDeleteDeptInDetails}
                  disabled={deletingDept || updatingDept}
                  className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                  id="delete-dept-details-btn"
                >
                  {deletingDept ? (
                    <Loader2 className="h-4 w-4 animate-spin animate-spin-fast" />
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Delete Dept
                    </>
                  )}
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditDeptModalOpen(false)}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingDept}
                    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-100 cursor-pointer"
                  >
                    {updatingDept ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Google Sheets Sync Modal */}
      {isSheetsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in" id="google-sheets-modal">
          <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 relative animate-scale-up">
            <button
              onClick={() => setIsSheetsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="font-display text-xl font-bold text-slate-900 mb-1" id="sheets-modal-title">
              Connected Google Sheets Live Sync
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Connect this department roster directly to Google Sheets using a dynamic, real-time CSV data feed.
            </p>

            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-100/50 rounded-2xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-1.5 flex items-center gap-1">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">1</span>
                  Copy the Sync Formula
                </h4>
                <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                  Open any Google Spreadsheet and paste this live import formula into cell <strong>A1</strong>. Google Sheets will fetch and automatically update your participant list in real-time.
                </p>
                <div className="flex gap-2 items-center">
                  <div className="flex-1 font-mono text-[11px] bg-slate-900 text-slate-200 p-3 rounded-xl border border-slate-800 overflow-x-auto select-all whitespace-nowrap">
                    {`=IMPORTDATA("${typeof window !== 'undefined' ? window.location.origin : ''}/api/cards/feed/${deptId}")`}
                  </div>
                  <button
                    onClick={() => {
                      const origin = typeof window !== 'undefined' ? window.location.origin : '';
                      navigator.clipboard.writeText(`=IMPORTDATA("${origin}/api/cards/feed/${deptId}")`);
                      setFormulaCopied(true);
                      setTimeout(() => setFormulaCopied(false), 2000);
                    }}
                    className="shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-4 py-3 text-xs font-semibold shadow-md shadow-indigo-100 transition-colors cursor-pointer"
                  >
                    {formulaCopied ? 'Copied!' : 'Copy Formula'}
                  </button>
                </div>
              </div>

              <div className="border border-slate-200/60 rounded-2xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">2</span>
                  How it updates
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Google Sheets updates `=IMPORTDATA` formulas periodically (typically every hour or when the spreadsheet is opened). Any additions, photo status updates, or changes made in this Record Console will automatically stream into your sheet.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex gap-3 items-start">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Direct Live Feed Link</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    You can also access the raw CSV directly at: <a href={`/api/cards/feed/${deptId}`} target="_blank" className="text-indigo-600 underline font-mono text-[10px] break-all">{`${typeof window !== 'undefined' ? window.location.origin : ''}/api/cards/feed/${deptId}`}</a>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsSheetsModalOpen(false)}
                className="rounded-xl px-5 py-2.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
