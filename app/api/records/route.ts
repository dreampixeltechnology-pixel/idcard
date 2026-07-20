import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// POST: Add single record (creates next serial, uploads photo, saves details)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const deptId = formData.get('deptId') as string;
    const dataStr = formData.get('data') as string;
    const photoFile = formData.get('photo') as File | null;

    if (!deptId || !dataStr) {
      return NextResponse.json({ error: 'deptId and data JSON are required.' }, { status: 400 });
    }

    const data = JSON.parse(dataStr);
    const supabaseAdmin = getSupabaseAdmin();

    // 1. Fetch organization and department codes for the storage path
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

    // 2. Compute next serial_number
    const { data: maxRecord, error: maxError } = await supabaseAdmin
      .from('records')
      .select('serial_number')
      .eq('dept_id', deptId)
      .order('serial_number', { ascending: false })
      .limit(1);

    if (maxError) {
      return NextResponse.json({ error: 'Failed to compute serial number.' }, { status: 500 });
    }

    let serialNumber = 1;
    if (maxRecord && maxRecord.length > 0) {
      serialNumber = maxRecord[0].serial_number + 1;
    }

    let photoUrl = null;
    let photoUploaded = false;

    // 3. Upload photo if present
    if (photoFile) {
      const bytes = await photoFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const fileExt = 'jpg';
      const storagePath = `${orgCode}/${deptCode}/${serialNumber}.${fileExt}`;

      // Create bucket if not exists (quiet check)
      try {
        await supabaseAdmin.storage.createBucket('org-images', { public: true });
      } catch (err) {
        // Ignore if exists
      }

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

      photoUrl = urlData.publicUrl;
      photoUploaded = true;
    }

    // 4. Create record in DB
    const { data: record, error: insertError } = await supabaseAdmin
      .from('records')
      .insert([
        {
          dept_id: deptId,
          serial_number: serialNumber,
          data: data,
          photo_url: photoUrl,
          photo_uploaded: photoUploaded,
        },
      ])
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, record });
  } catch (err: any) {
    console.error('Error in records POST endpoint:', err);
    return NextResponse.json({ error: err?.message || 'Server error.' }, { status: 500 });
  }
}

// PUT: Update single record
export async function PUT(req: NextRequest) {
  try {
    const formData = await req.formData();
    const recordId = formData.get('recordId') as string;
    const dataStr = formData.get('data') as string;
    const photoFile = formData.get('photo') as File | null;

    if (!recordId || !dataStr) {
      return NextResponse.json({ error: 'recordId and data JSON are required.' }, { status: 400 });
    }

    const data = JSON.parse(dataStr);
    const supabaseAdmin = getSupabaseAdmin();

    // 1. Fetch current record to get serial and deptId
    const { data: existingRecord, error: recordError } = await supabaseAdmin
      .from('records')
      .select('serial_number, dept_id, photo_url, photo_uploaded')
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

    let photoUrl = existingRecord.photo_url;
    let photoUploaded = existingRecord.photo_uploaded;

    // 3. Upload new photo if provided
    if (photoFile) {
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

      photoUrl = urlData.publicUrl;
      photoUploaded = true;
    }

    // 4. Update record in DB
    const { data: updatedRecord, error: updateError } = await supabaseAdmin
      .from('records')
      .update({
        data: data,
        photo_url: photoUrl,
        photo_uploaded: photoUploaded,
      })
      .eq('id', recordId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, record: updatedRecord });
  } catch (err: any) {
    console.error('Error in records PUT endpoint:', err);
    return NextResponse.json({ error: err?.message || 'Server error.' }, { status: 500 });
  }
}
