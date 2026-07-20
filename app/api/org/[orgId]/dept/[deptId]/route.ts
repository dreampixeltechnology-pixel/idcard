import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; deptId: string }> }
) {
  try {
    const { orgId, deptId } = await params;
    if (!orgId || !deptId) {
      return NextResponse.json({ error: 'orgId and deptId are required.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Fetch organization details to get its code
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('code')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found.' }, { status: 404 });
    }

    // 2. Fetch department details to get its code
    const { data: dept, error: deptError } = await supabaseAdmin
      .from('departments')
      .select('code')
      .eq('id', deptId)
      .single();

    if (deptError || !dept) {
      return NextResponse.json({ error: 'Department not found.' }, { status: 404 });
    }

    const orgCode = org.code.toUpperCase();
    const deptCode = dept.code.toUpperCase();
    const folderPath = `${orgCode}/${deptCode}`;

    // 3. List all files in the department folder in the storage bucket
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from('org-images')
      .list(folderPath);

    if (listError) {
      console.error(`Error listing files in ${folderPath}:`, listError);
    }

    // 4. Delete files from storage
    if (files && files.length > 0) {
      const filesToDelete = files.map((f) => `${folderPath}/${f.name}`);
      const { error: removeError } = await supabaseAdmin.storage
        .from('org-images')
        .remove(filesToDelete);

      if (removeError) {
        console.error(`Error deleting files in ${folderPath}:`, removeError);
      }
    }

    // 5. Delete department from database (cascades to delete records and card design)
    const { error: deleteError } = await supabaseAdmin
      .from('departments')
      .delete()
      .eq('id', deptId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting department and files:', err);
    return NextResponse.json({ error: err?.message || 'Server error.' }, { status: 500 });
  }
}
