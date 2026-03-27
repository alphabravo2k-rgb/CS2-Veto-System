const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: __dirname + '/../.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env file');
    process.exit(1);
}

const supaAdmin = createClient(supabaseUrl, supabaseKey);

async function createMasterAdmin() {
    console.log('--- VETO.GG: GLOBAL ADMIN INITIALIZER ---');
    const email = 'alphabravo2k@gmail.com';
    const password = '123456789';

    try {
        console.log(`[1] Creating user account for ${email}...`);
        
        // 1. Create Auth User
        const { data: authData, error: authError } = await supaAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { role: 'platform_admin' }
        });

        if (authError) {
             console.error(`ERROR: Failed to create Auth User: ${authError.message}`);
             if (authError.message.includes('already exists')) {
                 console.log(`[!] User already exists. Try updating their role manually in Supabase SQL Editor:`);
                 console.log(`UPDATE public.users SET role = 'platform_admin' WHERE email = '${email}';`);
                 return;
             }
             process.exit(1);
        }

        const userId = authData.user.id;
        console.log(`[SUCCESS] Master Admin created successfully.`);
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);
        console.log(`\nIf they do not appear as an admin immediately, run this query in your Supabase SQL Editor:`);
        console.log(`UPDATE public.users SET role = 'platform_admin' WHERE id = '${userId}';`);

        process.exit(0);

    } catch (err) {
        console.error('SCRIPT FAILURE:', err);
    }
}

createMasterAdmin();
