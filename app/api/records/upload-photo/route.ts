import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function PATCH(req: NextRequest) {
  try {
    const formData = await req.formData();
    const recordId = formData.get('recordId') as string;
    const photoFile = formData.get('photo') as File | null;

    if (!recordId || !photoFile) {
      return NextResponse.json({ error: 'recordId and photo file are required.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Fetch current record to get serial and deptId
    const { data: existingRecord, error: recordError } = await supabaseAdmin
      .from('records')
      .select('serial_number, dept_id')
      .eq('id', recordId)
      .single();

    if (recordError || !existingRecord) {
      return NextResponse.json({ error: 'Record not found.' }, { status: 404 });
    }

    const serialNumber = existingRecord.serial_number;
    const deptId = existingRecord.dept_id;

    // 2. Fetch organization and department codes
    const { data: deptInfo, error: deptError } = await supabaseAdmin
      .from('departments')
      .select('code, org_id')
      .eq('id', deptId)
      .single();

    if (deptError || !deptInfo) {
      return NextResponse.json({ error: 'Department not found.' }, { status: 404 });
    }

    const { data: orgInfo, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('code')
      .eq('id', deptInfo.org_id)
      .single();

    if (orgError || !orgInfo) {
      return NextResponse.json({ error: 'Organization not found.' }, { status: 404 });
    }

    const orgCode = orgInfo.code.toUpperCase();
    const deptCode = deptInfo.code.toUpperCase();

    // 3. Upload photo
    const bytes = await photoFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const storagePath = `${orgCode}/${deptCode}/${serialNumber}.jpg`;

    // Create bucket if not exists
    try {
      await supabaseAdmin.storage.createBucket('org-images', { public: true });
    } catch (err) {}

    const { error: uploadError } = await supabaseAdmin.storage
      .from('org-images')
      .upload(storagePath, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: `Image upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('org-images')
      .getPublicUrl(storagePath);

    const photoUrl = urlData.publicUrl;

    // 4. Update record
    const { data: updatedRecord, error: updateError } = await supabaseAdmin
      .from('records')
      .update({
        photo_url: photoUrl,
        photo_uploaded: true,
      })
      .eq('id', recordId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, record: updatedRecord });
  } catch (err: any) {
    console.error('Error uploading row photo:', err);
    return NextResponse.json({ error: err?.message || 'Server error.' }, { status: 500 });
  }
}
export async function POST(req: NextRequest) {
  return PATCH(req);
}
