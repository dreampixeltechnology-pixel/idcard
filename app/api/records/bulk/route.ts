import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

function cleanRowData(row: Record<string, any>): Record<string, any> {
  if (!row || typeof row !== 'object') return {};
  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(row)) {
    if (typeof val === 'string' && (val.startsWith('data:image/') || val.length > 2000)) {
      continue;
    }
    if ((key.toLowerCase() === 'photo' || key.toLowerCase() === 'image') && typeof val === 'string' && val.startsWith('data:image/')) {
      continue;
    }
    cleaned[key] = val;
  }
  return cleaned;
}

export async function POST(req: NextRequest) {
  try {
    const { deptId, rows } = await req.json();

    if (!deptId || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'deptId and rows array are required.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Fetch current max serial number for this department
    const { data: maxRecord, error: maxError } = await supabaseAdmin
      .from('records')
      .select('serial_number')
      .eq('dept_id', deptId)
      .order('serial_number', { ascending: false })
      .limit(1);

    if (maxError) {
      return NextResponse.json({ error: 'Failed to compute serial number.' }, { status: 500 });
    }

    let nextSerial = 1;
    if (maxRecord && maxRecord.length > 0) {
      nextSerial = maxRecord[0].serial_number + 1;
    }

    // 2. Map row data and assign sequential serial numbers
    const inserts = rows.map((row, index) => ({
      dept_id: deptId,
      serial_number: nextSerial + index,
      data: cleanRowData(row),
      photo_url: null,
      photo_uploaded: false,
    }));

    // 3. Perform bulk insert
    const { data: insertedRecords, error: bulkError } = await supabaseAdmin
      .from('records')
      .insert(inserts)
      .select('id, serial_number, data, photo_url, photo_uploaded');

    if (bulkError) {
      return NextResponse.json({ error: bulkError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, records: insertedRecords });
  } catch (err: any) {
    console.error('Error in bulk records endpoint:', err);
    return NextResponse.json({ error: err?.message || 'Server error.' }, { status: 500 });
  }
}
