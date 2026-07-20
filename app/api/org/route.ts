import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const name = formData.get('name') as string;
    const code = formData.get('code') as string;
    const address = formData.get('address') as string | null;
    const contactPhone = formData.get('contactPhone') as string | null;
    const userId = formData.get('userId') as string;
    const logoFile = formData.get('logo') as File | null;
    const sealFile = formData.get('seal') as File | null;

    if (!name || !code || !userId) {
      return NextResponse.json({ error: 'Name, code, and userId are required.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const cleanCode = code.trim().toUpperCase();

    // Check if code is already occupied
    const { data: existingOrg } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('code', cleanCode)
      .maybeSingle();

    if (existingOrg) {
      return NextResponse.json({ error: 'An organization with this code already exists. Code must be unique.' }, { status: 400 });
    }

    // 1. Insert organization to get an ID first (needed for storage pathing)
    const { data: newOrg, error: insertError } = await supabaseAdmin
      .from('organizations')
      .insert([
        {
          name: name.trim(),
          code: cleanCode,
          user_id: userId,
          address: address ? address.trim() : null,
          contact_phone: contactPhone ? contactPhone.trim() : null,
        },
      ])
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const orgId = newOrg.id;
    let logoUrl = null;
    let sealUrl = null;

    // Ensure bucket exists
    try {
      await supabaseAdmin.storage.createBucket('org-images', { public: true });
    } catch (err) {}

    // 2. Upload Logo if present
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
        logoUrl = urlData.publicUrl;
      } else {
        console.error('Logo upload error:', logoUploadError);
      }
    }

    // 3. Upload Seal if present
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
        sealUrl = urlData.publicUrl;
      } else {
        console.error('Seal upload error:', sealUploadError);
      }
    }

    // 4. Update the organization record with logo and seal URLs
    if (logoUrl || sealUrl) {
      const updateData: Record<string, any> = {};
      if (logoUrl) updateData.logo_url = logoUrl;
      if (sealUrl) updateData.seal_url = sealUrl;

      const { data: updatedOrg, error: updateError } = await supabaseAdmin
        .from('organizations')
        .update(updateData)
        .eq('id', orgId)
        .select()
        .single();

      if (!updateError) {
        return NextResponse.json({ success: true, organization: updatedOrg });
      }
    }

    return NextResponse.json({ success: true, organization: newOrg });
  } catch (err: any) {
    console.error('Error creating organization:', err);
    return NextResponse.json({ error: err?.message || 'Server error.' }, { status: 500 });
  }
}
