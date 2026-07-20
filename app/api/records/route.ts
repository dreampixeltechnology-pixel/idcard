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

    // 2. Compute or validate serial_number
    let serialNumber = 1;
    const clientSerialStr = formData.get('serialNumber');
    if (clientSerialStr) {
      serialNumber = parseInt(clientSerialStr as string);
      
      // Check if this slot/serial number is already taken
      const { data: existingRec } = await supabaseAdmin
        .from('records')
        .select('id')
        .eq('dept_id', deptId)
        .eq('serial_number', serialNumber)
        .maybeSingle();
        
      if (existingRec) {
        return NextResponse.json({ error: `Serial Number #${serialNumber} is already occupied by another entry.` }, { status: 400 });
      }
    } else {
      const { data: maxRecord, error: maxError } = await supabaseAdmin
        .from('records')
        .select('serial_number')
        .eq('dept_id', deptId)
        .order('serial_number', { ascending: false })
        .limit(1);

      if (maxError) {
        return NextResponse.json({ error: 'Failed to compute serial number.' }, { status: 500 });
      }

      if (maxRecord && maxRecord.length > 0) {
        serialNumber = maxRecord[0].serial_number + 1;
      }
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

// PATCH: Bulk update field value for multiple records
export async function PATCH(req: NextRequest) {
  try {
    const { recordIds, fieldName, newValue } = await req.json();

    if (!recordIds || !Array.isArray(recordIds) || recordIds.length === 0 || !fieldName) {
      return NextResponse.json({ error: 'recordIds (array) and fieldName are required.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Fetch current records to update their JSON data
    const { data: existingRecords, error: fetchError } = await supabaseAdmin
      .from('records')
      .select('id, data')
      .in('id', recordIds);

    if (fetchError || !existingRecords) {
      return NextResponse.json({ error: fetchError?.message || 'Failed to fetch existing records.' }, { status: 500 });
    }

    // 2. Perform updates concurrently
    const updatePromises = existingRecords.map(async (rec) => {
      const updatedData = {
        ...rec.data,
        [fieldName]: newValue
      };

      return supabaseAdmin
        .from('records')
        .update({ data: updatedData })
        .eq('id', rec.id);
    });

    const results = await Promise.all(updatePromises);
    const failed = results.filter(r => r.error);

    if (failed.length > 0) {
      console.error('Some bulk updates failed:', failed);
      return NextResponse.json({ error: 'Some records failed to update.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: recordIds.length });
  } catch (err: any) {
    console.error('Error in bulk update PATCH endpoint:', err);
    return NextResponse.json({ error: err?.message || 'Server error during bulk edit.' }, { status: 500 });
  }
}

// DELETE: Delete multiple (or single) records and their uploaded storage photos
export async function DELETE(req: NextRequest) {
  try {
    const { recordIds } = await req.json();

    if (!recordIds || !Array.isArray(recordIds) || recordIds.length === 0) {
      return NextResponse.json({ error: 'recordIds (array) is required.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Fetch records to get serial numbers and dept_id
    const { data: recordsToDelete, error: fetchError } = await supabaseAdmin
      .from('records')
      .select('id, serial_number, dept_id, photo_uploaded')
      .in('id', recordIds);

    if (fetchError || !recordsToDelete) {
      return NextResponse.json({ error: fetchError?.message || 'Failed to fetch records.' }, { status: 500 });
    }

    // 2. Identify the storage paths for records that have uploaded photos
    if (recordsToDelete.length > 0) {
      // Group by department to query the dept and org codes efficiently
      const deptIds = Array.from(new Set(recordsToDelete.map((r) => r.dept_id)));
      
      for (const deptId of deptIds) {
        // Fetch department and organization codes
        const { data: deptInfo } = await supabaseAdmin
          .from('departments')
          .select('code, org_id')
          .eq('id', deptId)
          .single();

        if (deptInfo) {
          const { data: orgInfo } = await supabaseAdmin
            .from('organizations')
            .select('code')
            .eq('id', deptInfo.org_id)
            .single();

          if (orgInfo) {
            const orgCode = orgInfo.code.toUpperCase();
            const deptCode = deptInfo.code.toUpperCase();

            // Find all serial numbers in this department being deleted
            const deptSerials = recordsToDelete
              .filter((r) => r.dept_id === deptId && r.photo_uploaded)
              .map((r) => r.serial_number);

            if (deptSerials.length > 0) {
              const filePaths = deptSerials.map((serial) => `${orgCode}/${deptCode}/${serial}.jpg`);
              
              const { error: removeError } = await supabaseAdmin.storage
                .from('org-images')
                .remove(filePaths);

              if (removeError) {
                console.error(`Failed to remove files for department ${deptCode}:`, removeError);
              }
            }
          }
        }
      }
    }

    // 3. Delete records from the database
    const { error: deleteError } = await supabaseAdmin
      .from('records')
      .delete()
      .in('id', recordIds);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: recordIds.length });
  } catch (err: any) {
    console.error('Error in records DELETE endpoint:', err);
    return NextResponse.json({ error: err?.message || 'Server error during deletion.' }, { status: 500 });
  }
}

