import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { generateCardPng } from '@/lib/card-renderer';
import * as archiver from 'archiver';
import * as XLSX from 'xlsx';

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
      .select('name, code, org_id, fields_schema')
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

    // 3. Fetch card design
    const { data: design, error: designError } = await supabaseAdmin
      .from('card_designs')
      .select('*')
      .eq('dept_id', deptId)
      .single();

    if (designError || !design) {
      return NextResponse.json({ error: 'No card design has been saved for this department yet. Please configure the Card Designer first.' }, { status: 400 });
    }

    // 4. Fetch all records (usually with photos, but we can export all, with placeholder or missing photo)
    const { data: records, error: recordsError } = await supabaseAdmin
      .from('records')
      .select('*')
      .eq('dept_id', deptId)
      .order('serial_number', { ascending: true });

    if (recordsError || !records || records.length === 0) {
      return NextResponse.json({ error: 'No records found to export. Please add records first.' }, { status: 400 });
    }

    const orgCode = org.code.toUpperCase();
    const deptCode = dept.code.toUpperCase();

    // 5. Build XLSX workbook using SheetJS
    const wb = XLSX.utils.book_new();
    const excelRows = records.map((r) => {
      const rowData: Record<string, any> = {
        'Serial Number': r.serial_number,
      };
      
      // Inject schema fields
      const fields = dept.fields_schema as Array<{ name: string; type: string }>;
      fields.forEach((f) => {
        rowData[f.name] = r.data[f.name] || '';
      });

      rowData['Photo URL'] = r.photo_url || 'N/A';
      rowData['Photo Uploaded'] = r.photo_uploaded ? 'YES' : 'NO';
      rowData['Created At'] = new Date(r.created_at).toLocaleDateString();

      return rowData;
    });

    const ws = XLSX.utils.json_to_sheet(excelRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Records Metadata');
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // 6. Generate card PNGs concurrently (with a concurrency limit of 10 or just basic map)
    // To protect memory limit in server, we do them with a neat Promise.all
    const cardRenderPromises = records.map(async (record) => {
      try {
        const pngBuffer = await generateCardPng(
          design.orientation as 'horizontal' | 'vertical',
          design.background_url,
          design.fields_config,
          record
        );
        return {
          filename: `${orgCode}-${deptCode}-${record.serial_number}`,
          buffer: pngBuffer,
          success: true
        };
      } catch (err) {
        console.error(`Failed to render card for Serial #${record.serial_number}:`, err);
        return {
          filename: `${orgCode}-${deptCode}-${record.serial_number}`,
          buffer: null,
          success: false
        };
      }
    });

    const renderedCards = await Promise.all(cardRenderPromises);

    // 7. Compress into a ZIP in memory using archiver
    const chunks: any[] = [];
    const archive = (archiver as any)('zip', { zlib: { level: 9 } });

    const zipPromise = new Promise<Buffer>((resolve, reject) => {
      archive.on('data', (chunk: any) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', (err: any) => reject(err));
    });

    // Pipe archive events
    archive.append(excelBuffer, { name: `${orgCode}-${deptCode}-records.xlsx` });

    renderedCards.forEach((card) => {
      if (card.success && card.buffer) {
        archive.append(card.buffer, { name: `${card.filename}.png` });
      }
    });

    await archive.finalize();
    const zipBuffer = await zipPromise;

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${orgCode}-${deptCode}-all-cards.zip"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('Error in export-all ZIP generator:', err);
    return NextResponse.json({ error: err?.message || 'Server error creating ZIP.' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow enough time for bulk generations
