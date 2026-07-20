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

    const { orientation, background_url, fields_config } = await req.json();

    if (!orientation || !Array.isArray(fields_config)) {
      return NextResponse.json({ error: 'orientation and fields_config are required.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Upsert design
    const { data: design, error } = await supabaseAdmin
      .from('card_designs')
      .upsert({
        dept_id: deptId,
        orientation,
        background_url,
        fields_config,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'dept_id',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, design });
  } catch (err: any) {
    console.error('Error upserting card design:', err);
    return NextResponse.json({ error: err?.message || 'Server error.' }, { status: 500 });
  }
}

// GET design
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const resolvedParams = await params;
    const deptId = resolvedParams.deptId;

    const supabaseAdmin = getSupabaseAdmin();

    const { data: design, error } = await supabaseAdmin
      .from('card_designs')
      .select('*')
      .eq('dept_id', deptId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, design });
  } catch (err: any) {
    console.error('Error fetching card design:', err);
    return NextResponse.json({ error: err?.message || 'Server error.' }, { status: 500 });
  }
}
