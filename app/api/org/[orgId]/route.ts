import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required.' }, { status: 400 });
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

    const orgCode = org.code.toUpperCase();

    // 2. Fetch all departments under this organization
    const { data: depts, error: deptsError } = await supabaseAdmin
      .from('departments')
      .select('id, code')
      .eq('org_id', orgId);

    if (deptsError) {
      console.error('Error fetching departments for deletion:', deptsError);
    }

    // 3. Delete files for each department's storage folder
    if (depts && depts.length > 0) {
      for (const dept of depts) {
        const deptCode = dept.code.toUpperCase();
        const folderPath = `${orgCode}/${deptCode}`;

        // List files in this department's folder
        const { data: files, error: listError } = await supabaseAdmin.storage
          .from('org-images')
          .list(folderPath);

        if (listError) {
          console.error(`Error listing files in ${folderPath}:`, listError);
          continue;
        }

        if (files && files.length > 0) {
          const filesToDelete = files.map((f) => `${folderPath}/${f.name}`);
          const { error: removeError } = await supabaseAdmin.storage
            .from('org-images')
            .remove(filesToDelete);

          if (removeError) {
            console.error(`Error deleting files in ${folderPath}:`, removeError);
          }
        }
      }
    }

    // 4. Try listing files in the root org folder (e.g., config or other files)
    const { data: rootFiles } = await supabaseAdmin.storage
      .from('org-images')
      .list(orgCode);

    if (rootFiles && rootFiles.length > 0) {
      // Filter out subfolder placeholders if any, but try removing direct files
      const rootFilesToDelete = rootFiles
        .filter((f) => f.name && !f.name.includes('.')) // skip folders or delete direct files
        .map((f) => `${orgCode}/${f.name}`);

      if (rootFilesToDelete.length > 0) {
        await supabaseAdmin.storage.from('org-images').remove(rootFilesToDelete);
      }
    }

    // 5. Delete organization from database (this will cascade delete depts, records, and designs)
    const { error: deleteError } = await supabaseAdmin
      .from('organizations')
      .delete()
      .eq('id', orgId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting organization and files:', err);
    return NextResponse.json({ error: err?.message || 'Server error.' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required.' }, { status: 400 });
    }

    const formData = await req.formData();
    const name = formData.get('name') as string | null;
    const address = formData.get('address') as string | null;
    const contactPhone = formData.get('contactPhone') as string | null;
    const logoFile = formData.get('logo') as File | null;
    const sealFile = formData.get('seal') as File | null;

    const supabaseAdmin = getSupabaseAdmin();

    const updateData: Record<string, any> = {};
    if (name !== null) updateData.name = name.trim();
    if (address !== null) updateData.address = address.trim() || null;
    if (contactPhone !== null) updateData.contact_phone = contactPhone.trim() || null;

    // Ensure bucket exists
    try {
      await supabaseAdmin.storage.createBucket('org-images', { public: true });
    } catch (err) {}

    // Upload Logo if present
    if (logoFile) {
      const bytes = await logoFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const storagePath = `org-assets/${orgId}/logo.jpg`;

      const { error: logoUploadError } = await supabaseAdmin.storage
        .from('org-images')
        .upload(storagePath, buffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (!logoUploadError) {
        const { data: urlData } = supabaseAdmin.storage
          .from('org-images')
          .getPublicUrl(storagePath);
        updateData.logo_url = urlData.publicUrl;
      } else {
        console.error('Logo upload error:', logoUploadError);
      }
    }

    // Upload Seal if present
    if (sealFile) {
      const bytes = await sealFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const storagePath = `org-assets/${orgId}/seal.jpg`;

      const { error: sealUploadError } = await supabaseAdmin.storage
        .from('org-images')
        .upload(storagePath, buffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (!sealUploadError) {
        const { data: urlData } = supabaseAdmin.storage
          .from('org-images')
          .getPublicUrl(storagePath);
        updateData.seal_url = urlData.publicUrl;
      } else {
        console.error('Seal upload error:', sealUploadError);
      }
    }

    const { data: updatedOrg, error: updateError } = await supabaseAdmin
      .from('organizations')
      .update(updateData)
      .eq('id', orgId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, organization: updatedOrg });
  } catch (err: any) {
    console.error('Error updating organization details:', err);
    return NextResponse.json({ error: err?.message || 'Server error.' }, { status: 500 });
  }
}

