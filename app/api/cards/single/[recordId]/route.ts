import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { generateCardPng } from '@/lib/card-renderer';

interface RouteParams {
  params: Promise<{ recordId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const resolvedParams = await params;
    const recordId = resolvedParams.recordId;

    if (!recordId) {
      return NextResponse.json({ error: 'Record ID is required.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Fetch record
    const { data: record, error: recordError } = await supabaseAdmin
      .from('records')
      .select('*')
      .eq('id', recordId)
      .single();

    if (recordError || !record) {
      return NextResponse.json({ error: 'Record not found.' }, { status: 404 });
    }

    // 2. Fetch department and design
    const { data: dept, error: deptError } = await supabaseAdmin
      .from('departments')
      .select('code, org_id')
      .eq('id', record.dept_id)
      .single();

    if (deptError || !dept) {
      return NextResponse.json({ error: 'Department not found.' }, { status: 404 });
    }

    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('code')
      .eq('id', dept.org_id)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found.' }, { status: 404 });
    }

    const { data: design, error: designError } = await supabaseAdmin
      .from('card_designs')
      .select('*')
      .eq('dept_id', record.dept_id)
      .single();

    if (designError || !design) {
      return NextResponse.json({ error: 'No card design found for this department. Please create a design first.' }, { status: 400 });
    }

    const orgCode = org.code.toUpperCase();
    const deptCode = dept.code.toUpperCase();
    const serial = record.serial_number;

    // 3. Generate PNG
    const pngBuffer = await generateCardPng(
      design.orientation as 'horizontal' | 'vertical',
      design.background_url,
      design.fields_config,
      record
    );

    // 4. Return PNG stream
    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${orgCode}-${deptCode}-${serial}.png"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('Error generating single card PNG:', err);
    return NextResponse.json({ error: err?.message || 'Server error rendering PNG.' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
