import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

interface RouteParams {
  params: Promise<{ deptId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const resolvedParams = await params;
    const deptId = resolvedParams.deptId;

    if (!deptId) {
      return NextResponse.json({ error: 'deptId is required.' }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Ensure bucket exists
    try {
      await supabaseAdmin.storage.createBucket('org-images', { public: true });
    } catch (err) {
      console.warn('Bucket creation warning (probably already exists):', err);
    }

    // 2. Read file buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const storagePath = `backgrounds/${deptId}.jpg`;

    // 3. Upload background
    const { error: uploadError } = await supabaseAdmin.storage
      .from('org-images')
      .upload(storagePath, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: `Image upload failed: ${uploadError.message}` }, { status: 500 });
    }

    // 4. Get Public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('org-images')
      .getPublicUrl(storagePath);

    return NextResponse.json({ success: true, url: urlData.publicUrl });
  } catch (err: any) {
    console.error('Error uploading background:', err);
    return NextResponse.json({ error: err?.message || 'Server error uploading background.' }, { status: 500 });
  }
}
