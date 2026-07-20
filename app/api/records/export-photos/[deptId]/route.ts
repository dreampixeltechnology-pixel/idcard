import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import * as archiver from 'archiver';

interface RouteParams {
  params: Promise<{ deptId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const resolvedParams = await params;
    const deptId = resolvedParams.deptId;

    if (!deptId) {
      return NextResponse.json({ error: 'Department ID is required.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Fetch department details
    const { data: dept, error: deptError } = await supabaseAdmin
      .from('departments')
      .select('name, code, org_id')
      .eq('id', deptId)
      .single();

    if (deptError || !dept) {
      return NextResponse.json({ error: 'Department not found.' }, { status: 404 });
    }

    // 2. Fetch organization details
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('code')
      .eq('id', dept.org_id)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found.' }, { status: 404 });
    }

    // 3. Fetch all records that have uploaded photos
    const { data: records, error: recordsError } = await supabaseAdmin
      .from('records')
      .select('id, serial_number, photo_url, photo_uploaded')
      .eq('dept_id', deptId)
      .eq('photo_uploaded', true)
      .order('serial_number', { ascending: true });

    if (recordsError || !records || records.length === 0) {
      return NextResponse.json({ error: 'No records with uploaded photos found for this department.' }, { status: 400 });
    }

    const orgCode = org.code.toUpperCase();
    const deptCode = dept.code.toUpperCase();

    // 4. Download photos and add them to ZIP
    const chunks: any[] = [];
    const archive = (archiver as any)('zip', { zlib: { level: 9 } });

    const zipPromise = new Promise<Buffer>((resolve, reject) => {
      archive.on('data', (chunk: any) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', (err: any) => reject(err));
    });

    // Concurrently download up to 15 photos at a time
    const photoDownloads = await Promise.all(
      records.map(async (record) => {
        if (!record.photo_url) return null;
        try {
          const res = await fetch(record.photo_url);
          if (!res.ok) {
            console.error(`Failed to download photo for Serial #${record.serial_number} from url: ${record.photo_url}`);
            return null;
          }
          const arrayBuffer = await res.arrayBuffer();
          return {
            filename: `${record.serial_number}.jpg`,
            buffer: Buffer.from(arrayBuffer),
          };
        } catch (err) {
          console.error(`Error downloading photo for Serial #${record.serial_number}:`, err);
          return null;
        }
      })
    );

    photoDownloads.forEach((photo) => {
      if (photo) {
        archive.append(photo.buffer, { name: photo.filename });
      }
    });

    await archive.finalize();
    const zipBuffer = await zipPromise;

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${orgCode}-${deptCode}-photos.zip"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('Error exporting photos ZIP:', err);
    return NextResponse.json({ error: err?.message || 'Server error creating photos ZIP.' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
