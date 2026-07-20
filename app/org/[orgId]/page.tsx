'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase-client';
import { 
  Building2, 
  FolderGit2, 
  Plus, 
  ArrowLeft, 
  Loader2, 
  AlertCircle,
  Trash2,
  ListTodo,
  CalendarDays,
  Hash,
  Image as ImageIcon,
  ChevronRight,
  Info,
  Edit3
} from 'lucide-react';

interface Department {
  id: string;
  name: string;
  code: string;
  expected_count: number;
  fields_schema: Array<{ name: string; type: 'text' | 'number' | 'date' | 'image' }>;
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
  code: string;
}

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export default function OrgDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const orgId = resolvedParams.orgId;
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [expectedCount, setExpectedCount] = useState<number>(0);
  const [fields, setFields] = useState<Array<{ name: string; type: 'text' | 'number' | 'date' | 'image' }>>([
    { name: '', type: 'text' }
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit Organization States
  const [isEditOrgModalOpen, setIsEditOrgModalOpen] = useState(false);
  const [editOrgName, setEditOrgName] = useState('');
  const [updatingOrg, setUpdatingOrg] = useState(false);

  const handleUpdateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editOrgName.trim()) {
      setFormError('Organization name cannot be empty.');
      return;
    }
    setUpdatingOrg(true);
    setFormError(null);
    try {
      const { error } = await supabase!
        .from('organizations')
        .update({ name: editOrgName.trim() })
        .eq('id', orgId);

      if (error) {
        setFormError(error.message);
      } else {
        setOrganization(prev => prev ? { ...prev, name: editOrgName.trim() } : null);
        setIsEditOrgModalOpen(false);
      }
    } catch (err: any) {
      setFormError(err?.message || 'Failed to update organization name.');
    } finally {
      setUpdatingOrg(false);
    }
  };

  const router = useRouter();
  const supabase = getSupabaseClient();

  useEffect(() => {
    if (!supabase) {
      setTimeout(() => {
        setLoading(false);
      }, 0);
      return;
    }

    async function loadOrgAndDepts() {
      try {
        // Fetch Org
        const { data: orgData, error: orgError } = await supabase!
          .from('organizations')
          .select('*')
          .eq('id', orgId)
          .single();

        if (orgError) {
          console.error('Error fetching organization:', orgError);
          router.push('/dashboard');
          return;
        }
        setOrganization(orgData);

        // Fetch Departments
        const { data: deptsData, error: deptsError } = await supabase!
          .from('departments')
          .select('*')
          .eq('org_id', orgId)
          .order('created_at', { ascending: false });

        if (deptsError) {
          console.error('Error fetching departments:', deptsError);
        } else {
          setDepartments(deptsData || []);
        }
      } catch (err) {
        console.error('Error loading page data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadOrgAndDepts();
  }, [supabase, orgId, router]);

  // Schema builder helpers
  const handleAddField = () => {
    setFields([...fields, { name: '', type: 'text' }]);
  };

  const handleRemoveField = (index: number) => {
    if (fields.length <= 1) {
      setFormError('At least one schema field is required.');
      return;
    }
    const updated = [...fields];
    updated.splice(index, 1);
    setFields(updated);
  };

  const handleFieldChange = (index: number, key: 'name' | 'type', value: string) => {
    const updated = [...fields];
    if (key === 'name') {
      updated[index].name = value.replace(/[^a-zA-Z0-9_\s]/g, ''); // alphanumeric + space
    } else {
      updated[index].type = value as any;
    }
    setFields(updated);
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!deptName.trim() || !deptCode.trim() || expectedCount <= 0) {
      setFormError('Please complete all department settings.');
      return;
    }

    const cleanedFields = fields.map(f => ({ ...f, name: f.name.trim() }));
    if (cleanedFields.some(f => !f.name)) {
      setFormError('All dynamic fields must have a valid name.');
      return;
    }

    // Check duplicate names
    const names = cleanedFields.map(f => f.name.toLowerCase());
    if (new Set(names).size !== names.length) {
      setFormError('Field names must be unique.');
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase!
        .from('departments')
        .insert([
          {
            org_id: orgId,
            name: deptName,
            code: deptCode.toUpperCase().replace(/[^A-Z0-9]/g, ''),
            expected_count: expectedCount,
            fields_schema: cleanedFields
          }
        ])
        .select();

      if (error) {
        if (error.code === '23505') {
          setFormError('A department with this code already exists in this organization.');
        } else {
          setFormError(error.message);
        }
      } else {
        if (data && data.length > 0) {
          setDepartments([data[0], ...departments]);
        }
        // Reset states
        setIsModalOpen(false);
        setDeptName('');
        setDeptCode('');
        setExpectedCount(0);
        setFields([{ name: '', type: 'text' }]);
      }
    } catch (err: any) {
      setFormError(err?.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-sm font-medium text-slate-500">Loading organization details...</p>
        </div>
      </div>
    );
  }

  if (!organization) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header Bar */}
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                id="back-to-dashboard-btn"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-display font-semibold text-slate-500 text-sm">Organizations</span>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                  <span className="font-display text-base font-bold text-slate-900">{organization.name}</span>
                  <button
                    onClick={() => {
                      setEditOrgName(organization.name);
                      setIsEditOrgModalOpen(true);
                    }}
                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                    title="Edit Organization Name"
                    id="edit-org-btn"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="font-mono text-xs font-semibold uppercase bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200">
              Org Code: {organization.code}
            </div>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900" id="departments-title">
              Departments
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Configure department profiles, define data structure schemas, and manage participant records.
            </p>
          </div>
          <button
            id="add-dept-btn"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center space-x-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-100"
          >
            <Plus className="h-4 w-4" />
            <span>Add Department</span>
          </button>
        </div>

        {departments.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center" id="empty-depts-state">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-4">
              <FolderGit2 className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No departments configured</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm">
              Create a department like &apos;Staff&apos;, &apos;Students&apos;, or &apos;Speakers&apos; with a tailored schema to generate custom ID cards.
            </p>
            <button
              id="empty-add-dept-btn"
              onClick={() => setIsModalOpen(true)}
              className="mt-6 flex items-center space-x-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-100"
            >
              <Plus className="h-4 w-4" />
              <span>Configure Department</span>
            </button>
          </div>
        )}

        {departments.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" id="depts-grid">
            {departments.map((dept) => (
              <div
                key={dept.id}
                id={`dept-card-${dept.id}`}
                onClick={() => router.push(`/org/${orgId}/dept/${dept.id}`)}
                className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 uppercase tracking-wider font-mono">
                      Code: {dept.code}
                    </span>
                    <span className="text-xs font-medium text-slate-400">
                      Expected: {dept.expected_count}
                    </span>
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {dept.name}
                  </h3>

                  {/* Schema Summary pills */}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {dept.fields_schema.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-md bg-slate-50 border border-slate-100 px-2 py-0.5 text-[11px] text-slate-500 font-medium">
                        {f.type === 'text' && <ListTodo className="h-3 w-3" />}
                        {f.type === 'date' && <CalendarDays className="h-3 w-3" />}
                        {f.type === 'number' && <Hash className="h-3 w-3" />}
                        {f.type === 'image' && <ImageIcon className="h-3 w-3" />}
                        {f.name}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-between pt-4 border-t border-slate-100">
                  <span className="text-xs text-slate-400">
                    Created {new Date(dept.created_at).toLocaleDateString()}
                  </span>
                  <span className="flex items-center text-xs font-semibold text-indigo-600 group-hover:translate-x-1 transition-transform">
                    Manage Records <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add Dept Modal with Dynamic Schema Builder */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in" id="add-dept-modal">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 relative animate-scale-up max-h-[90vh] overflow-y-auto">
            <h3 className="font-display text-xl font-bold text-slate-900 mb-1" id="dept-modal-title">
              Add New Department
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Create a department profile and define its custom dynamic data fields.
            </p>

            {formError && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 border border-red-100 mb-4 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateDept} className="space-y-6" id="add-dept-form">
              {/* Row 1: Name and Code */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Department Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Engineering Staff"
                    value={deptName}
                    onChange={(e) => {
                      setDeptName(e.target.value);
                      if (!deptCode) {
                        setDeptCode(e.target.value.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, ''));
                      }
                    }}
                    className="block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Short Code (Unique)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ENG"
                    value={deptCode}
                    onChange={(e) => setDeptCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    className="block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm outline-none transition-all uppercase font-mono"
                  />
                </div>
              </div>

              {/* Row 2: Expected Count */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Expected Count (Allocated Size)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 150"
                  value={expectedCount || ''}
                  onChange={(e) => setExpectedCount(parseInt(e.target.value) || 0)}
                  className="block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm outline-none transition-all"
                />
                <p className="text-xs text-slate-400 mt-1">
                  This determines the generated table size and card quotas.
                </p>
              </div>

              {/* Dynamic Field Builder */}
              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Fields & Schema Rules</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Define metadata fields printed on the cards.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddField}
                    className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-500 bg-indigo-50 px-2.5 py-1.5 rounded-lg border border-indigo-100"
                    id="add-schema-row-btn"
                  >
                    <Plus className="h-3 w-3" /> Add Field
                  </button>
                </div>

                <div className="space-y-3" id="schema-rows-container">
                  {fields.map((field, idx) => (
                    <div key={idx} className="flex gap-2 items-center animate-fade-in" id={`schema-row-${idx}`}>
                      <div className="flex-1">
                        <input
                          type="text"
                          required
                          placeholder="e.g. Employee ID, Designation"
                          value={field.name}
                          onChange={(e) => handleFieldChange(idx, 'name', e.target.value)}
                          className="block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm outline-none transition-all"
                        />
                      </div>
                      <div className="w-32">
                        <select
                          value={field.type}
                          onChange={(e) => handleFieldChange(idx, 'type', e.target.value)}
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
                        onClick={() => handleRemoveField(idx)}
                        disabled={fields.length <= 1}
                        className="p-2.5 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 border border-slate-200 rounded-xl transition-colors disabled:opacity-40 disabled:hover:bg-slate-50 disabled:hover:text-slate-400"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-xl p-3">
                <Info className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                <span>We suggest defining at least one field named <strong>Full Name</strong> or <strong>Name</strong> and one field of type <strong>Image</strong> to serve as the user avatar.</span>
              </div>

              {/* Actions Footer */}
              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-100"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Configure'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Organization Name Modal */}
      {isEditOrgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in" id="edit-org-modal">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 relative animate-scale-up">
            <h3 className="font-display text-xl font-bold text-slate-900 mb-1" id="edit-org-modal-title">
              Edit Organization Details
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Update your organization name here.
            </p>

            {formError && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 border border-red-100 mb-4 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateOrg} className="space-y-4" id="edit-org-form">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Silicon Valley Minerals"
                  value={editOrgName}
                  onChange={(e) => setEditOrgName(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm outline-none transition-all"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditOrgModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingOrg}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-100"
                >
                  {updatingOrg ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
