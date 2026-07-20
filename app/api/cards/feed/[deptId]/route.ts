import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

interface RouteParams {
  params: Promise<{ deptId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const resolvedParams = await params;
    const deptId = resolvedParams.deptId;

    if (!deptId) {
      return new NextResponse('Department ID is required', { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Fetch department details
    const { data: dept, error: deptError } = await supabaseAdmin
      .from('departments')
      .select('name, code, fields_schema')
      .eq('id', deptId)
      .single();

    if (deptError || !dept) {
      return new NextResponse('Department not found', { status: 404 });
    }

    // 2. Fetch all records
    const { data: records, error: recordsError } = await supabaseAdmin
      .from('records')
      .select('*')
      .eq('dept_id', deptId)
      .order('serial_number', { ascending: true });

    if (recordsError || !records) {
      return new NextResponse('Records not found', { status: 500 });
    }

    const fieldsSchema = dept.fields_schema as Array<{ name: string; type: string }>;

    // 3. Build CSV string
    const headers = ['Serial Number', ...fieldsSchema.map(f => f.name), 'Photo Status', 'Photo URL', 'Created At'];
    
    const csvRows = [
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',')
    ];

    records.forEach((r) => {
      const rowData = [
        String(r.serial_number),
        ...fieldsSchema.map(f => {
          const val = r.data[f.name];
          return val !== undefined && val !== null ? String(val) : '';
        }),
        r.photo_uploaded ? 'Uploaded' : 'Missing',
        r.photo_url || '',
        new Date(r.created_at).toISOString()
      ];

      csvRows.push(
        rowData.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
      );
    });

    const csvContent = csvRows.join('\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${dept.code}-connected-sheet.csv"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: any) {
    console.error('Error in connected sheet API:', err);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
