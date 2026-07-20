'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase-client';
import { 
  Building2, 
  Plus, 
  LogOut, 
  User, 
  Calendar, 
  ArrowRight, 
  Loader2, 
  AlertCircle,
  MessageCircle
} from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  code: string;
  address?: string;
  contact_phone?: string;
  logo_url?: string;
  seal_url?: string;
  created_at: string;
}

export default function DashboardPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgStats, setOrgStats] = useState<Record<string, { expected: number; received: number }>>({});
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // New Org Form State
  const [orgName, setOrgName] = useState('');
  const [orgCode, setOrgCode] = useState('');
  const [orgAddress, setOrgAddress] = useState('');
  const [orgContactPhone, setOrgContactPhone] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [sealFile, setSealFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const router = useRouter();
  const supabase = getSupabaseClient();

  // Load profile/session and organizations
  useEffect(() => {
    if (!supabase) {
      setTimeout(() => {
        setLoading(false);
      }, 0);
      return;
    }

    async function loadData() {
      try {
        const { data: { session } } = await supabase!.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }
        setUser(session.user);

        const { data: orgsData, error: orgsError } = await supabase!
          .from('organizations')
          .select('*')
          .order('created_at', { ascending: false });

        if (orgsError) {
          console.error('Error fetching organizations:', orgsError);
        } else {
          const orgs = (orgsData || []) as Organization[];
          setOrganizations(orgs);

          if (orgs.length > 0) {
            const orgIds = orgs.map((o: Organization) => o.id);

            // Fetch departments for all these orgs
            const { data: deptsData, error: deptsError } = await supabase!
              .from('departments')
              .select('id, org_id, expected_count')
              .in('org_id', orgIds);

            if (deptsError) {
              console.error('Error fetching departments:', deptsError);
            }

            const depts = (deptsData || []) as { id: string; org_id: string; expected_count: number }[];
            const deptIds = depts.map((d) => d.id);

            // Fetch count of records for these departments
            let recordsCountMap: Record<string, number> = {};
            if (deptIds.length > 0) {
              const { data: recsData, error: recsError } = await supabase!
                .from('records')
                .select('id, dept_id')
                .in('dept_id', deptIds);
              
              if (recsError) {
                console.error('Error fetching records for stats:', recsError);
              } else {
                (recsData || []).forEach((r: any) => {
                  recordsCountMap[r.dept_id] = (recordsCountMap[r.dept_id] || 0) + 1;
                });
              }
            }

            const statsMap: Record<string, { expected: number; received: number }> = {};
            orgs.forEach((o: Organization) => {
              statsMap[o.id] = { expected: 0, received: 0 };
            });

            depts.forEach((d) => {
              if (statsMap[d.org_id]) {
                statsMap[d.org_id].expected += d.expected_count || 0;
                statsMap[d.org_id].received += recordsCountMap[d.id] || 0;
              }
            });

            setOrgStats(statsMap);
          }
        }
      } catch (err) {
        console.error('Load data error:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [supabase, router]);

  // Handle auto-code generation
  const handleNameChange = (val: string) => {
    setOrgName(val);
    if (!orgCode || orgCode === orgName.split(' ').map(w => w[0]).join('').toUpperCase()) {
      const generated = val
        .split(' ')
        .map(w => w[0])
        .join('')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
      setOrgCode(generated);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!orgName.trim() || !orgCode.trim()) {
      setFormError('Please fill out all fields.');
      return;
    }

    setSubmitting(true);

    try {
      const form = new FormData();
      form.append('name', orgName);
      form.append('code', orgCode.toUpperCase());
      form.append('userId', user.id);
      form.append('address', orgAddress.trim());
      form.append('contactPhone', orgContactPhone.trim());
      if (logoFile) {
        form.append('logo', logoFile);
      }
      if (sealFile) {
        form.append('seal', sealFile);
      }

      const response = await fetch('/api/org', {
        method: 'POST',
        body: form,
      });

      const result = await response.json();

      if (result.error) {
        setFormError(result.error);
      } else {
        if (result.organization) {
          setOrganizations([result.organization, ...organizations]);
          setOrgStats(prev => ({
            ...prev,
            [result.organization.id]: { expected: 0, received: 0 }
          }));
        }
        setIsModalOpen(false);
        setOrgName('');
        setOrgCode('');
        setOrgAddress('');
        setOrgContactPhone('');
        setLogoFile(null);
        setSealFile(null);
      }
    } catch (err: any) {
      setFormError(err?.message || 'An error occurred during submission.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-sm font-medium text-slate-500">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header Banner */}
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 backdrop-blur-md" id="dashboard-header">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-100">
                <Building2 className="h-5 w-5" />
              </div>
              <span className="font-display text-xl font-bold tracking-tight text-slate-900">
                Dreampixel Technology
              </span>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-slate-600">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  <User className="h-4 w-4" />
                </div>
                <span className="hidden font-medium sm:inline">
                  Dreampixel Owner (Admin)
                </span>
              </div>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 font-mono border border-emerald-100">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Console Online
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8" id="dashboard-main">
        {/* Welcome Block */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900" id="welcome-heading">
              Organizations
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Select or create an organization to manage departments and generate high-quality identity cards.
            </p>
          </div>
          <button
            id="add-org-btn"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center space-x-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-100"
          >
            <Plus className="h-4 w-4" />
            <span>New Organization</span>
          </button>
        </div>

        {/* Database Warning */}
        {!supabase && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800 mb-8" id="no-supabase-alert">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-red-900">Database Connection Required</h3>
                <p className="text-sm text-red-700 mt-1">
                  Please configure your Supabase variables in the AI Studio Secrets panel. You can copy the table definitions from <span className="font-mono bg-red-100 px-1 rounded">supabase_migration.sql</span> and run them in your Supabase SQL editor first.
                </p>
              </div>
            </div>
          </div>
        )}

        {organizations.length === 0 && !loading && supabase && (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center" id="empty-state">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-4">
              <Building2 className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No organizations found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm">
              Get started by creating your first organization. This will represent your company, university, or event.
            </p>
            <button
              id="empty-add-org-btn"
              onClick={() => setIsModalOpen(true)}
              className="mt-6 flex items-center space-x-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-100"
            >
              <Plus className="h-4 w-4" />
              <span>Create Organization</span>
            </button>
          </div>
        )}

        {organizations.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" id="org-list-grid">
            {organizations.map((org) => (
              <div
                key={org.id}
                id={`org-card-${org.id}`}
                onClick={() => router.push(`/org/${org.id}`)}
                className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    {org.logo_url ? (
                      <div className="flex items-center gap-2">
                        <img src={org.logo_url} alt="Logo" className="h-8 w-8 object-contain rounded-md border border-slate-200" />
                        <span className="font-mono text-xs font-semibold text-slate-500 uppercase">{org.code}</span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 uppercase tracking-wider font-mono">
                        Code: {org.code}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5">
                      {org.seal_url && (
                        <img src={org.seal_url} alt="Seal" title="Official Seal Attached" className="h-6 w-6 object-contain opacity-80" />
                      )}
                      <Calendar className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {org.name}
                  </h3>

                  {/* Address & Contact Info with WhatsApp reminder */}
                  {(org.address || org.contact_phone) && (
                    <div className="mt-3 space-y-1.5 text-xs text-slate-500 border-t border-slate-100 pt-3" onClick={(e) => e.stopPropagation()}>
                      {org.address && (
                        <div className="flex items-start gap-1.5">
                          <span className="font-semibold text-slate-600">Address:</span>
                          <span className="truncate max-w-[180px] text-slate-700" title={org.address}>{org.address}</span>
                        </div>
                      )}
                      {org.contact_phone && (
                        <div className="flex items-center justify-between gap-1.5 mt-1">
                          <div className="flex items-center gap-1">
                            <span className="font-semibold text-slate-600">Contact:</span>
                            <span className="font-mono text-slate-700">{org.contact_phone}</span>
                          </div>
                          
                          {/* Direct WhatsApp Link */}
                          <a
                            href={`https://wa.me/${org.contact_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello! This is a reminder regarding your ID Card Generation service for next year.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                            title="Direct WhatsApp Reminder"
                          >
                            <MessageCircle className="h-2.5 w-2.5" />
                            WhatsApp
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stats & Progress Section */}
                  {(() => {
                    const stats = orgStats[org.id] || { expected: 0, received: 0 };
                    const progressPercent = stats.expected > 0 ? Math.min(100, Math.round((stats.received / stats.expected) * 100)) : 0;
                    return (
                      <div className="mt-4 bg-slate-50/80 rounded-xl p-3 border border-slate-100/80 space-y-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-slate-500">Data Received / Expected</span>
                          <span className="font-mono text-indigo-600">{stats.received} / {stats.expected}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200/60 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-600 rounded-full transition-all duration-500" 
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                          <span>Progress</span>
                          <span>{progressPercent}%</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="mt-8 flex items-center justify-between pt-4 border-t border-slate-100">
                  <span className="text-xs text-slate-400">
                    Created {new Date(org.created_at).toLocaleDateString()}
                  </span>
                  <span className="flex items-center text-xs font-semibold text-indigo-600 group-hover:translate-x-1 transition-transform">
                    View Org <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add Org Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in" id="add-org-modal">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 relative animate-scale-up">
            <h3 className="font-display text-xl font-bold text-slate-900 mb-1" id="modal-title">
              Create New Organization
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Organizations act as templates for department categories.
            </p>

            {formError && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 border border-red-100 mb-4 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateOrg} className="space-y-4" id="add-org-form">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Silicon Valley Minerals"
                  value={orgName}
                  onChange={(e) => handleNameChange(e.target.value)}
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
                  placeholder="e.g. SVM"
                  value={orgCode}
                  onChange={(e) => setOrgCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  className="block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm outline-none transition-all uppercase font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Used for file structures and storage paths. Max alphanumeric.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Address
                </label>
                <textarea
                  placeholder="e.g. 123 Innovation Way, Tech District"
                  value={orgAddress}
                  onChange={(e) => setOrgAddress(e.target.value)}
                  rows={2}
                  className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Contact Phone Number (WhatsApp)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 919876543210 (with country code)"
                  value={orgContactPhone}
                  onChange={(e) => setOrgContactPhone(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm outline-none transition-all font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Enter number without spaces or symbols (e.g. 919876543210) for direct WhatsApp message.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Organization Logo (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setLogoFile(file);
                  }}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Organization Official Seal (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setSealFile(file);
                  }}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>

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
                    'Create'
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
