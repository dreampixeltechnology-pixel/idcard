import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const email = 'shop-owner@privateshop.com';
    const password = 'PrivateShopOwnerPassword123!';

    // Get list of users with this email to see if they exist
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users from admin client:', listError);
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    const existingUser = users.find(u => u.email === email);

    if (existingUser) {
      return NextResponse.json({ success: true, message: 'Default shop owner already exists.', user: existingUser });
    }

    // Create the default shop owner user with auto-confirm email
    const { data: { user }, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: 'Shop Owner',
      }
    });

    if (createError) {
      console.error('Error creating default shop owner:', createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Default shop owner created successfully.', user });
  } catch (error: any) {
    console.error('Unhandled admin auth initialization error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
