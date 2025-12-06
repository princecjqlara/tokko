/**
 * Test script to verify batch database saves work correctly
 * Run with: node scripts/test-db-save.js
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables. Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
    console.log('Current values:');
    console.log('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
    console.log('  SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING');
    console.log('  NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
});

async function testBatchSave() {
    console.log('🧪 Testing batch database save...');
    console.log('   Using Supabase URL:', supabaseUrl);
    console.log('   Using key type:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON');

    // Test user ID (use a test value)
    const testUserId = 'test-user-' + Date.now();
    const testContacts = [];

    // Create 5 test contacts
    for (let i = 0; i < 5; i++) {
        testContacts.push({
            contact_id: `test-contact-${Date.now()}-${i}`,
            page_id: 'test-page-123',
            user_id: testUserId,
            contact_name: `Test Contact ${i}`,
            page_name: 'Test Page',
            last_message: 'Test message',
            last_message_time: new Date().toISOString(),
            last_contact_message_date: new Date().toISOString().split('T')[0],
            tags: [],
            role: '',
            avatar: 'TC',
            date: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString(),
        });
    }

    console.log(`\n📝 Attempting to save ${testContacts.length} test contacts...`);

    try {
        // Test upsert with .select() to confirm save
        const { data: savedData, error: upsertError } = await supabase
            .from('contacts')
            .upsert(testContacts, {
                onConflict: 'contact_id,page_id,user_id'
            })
            .select('contact_id');

        if (upsertError) {
            console.error('❌ UPSERT ERROR:', {
                code: upsertError.code,
                message: upsertError.message,
                details: upsertError.details,
                hint: upsertError.hint,
            });
            return false;
        }

        console.log(`✅ CONFIRMED: ${savedData?.length || 0} contacts saved to database`);
        console.log('   Saved contact IDs:', savedData?.map(c => c.contact_id).join(', '));

        // Verify by reading back
        const { data: readBack, error: readError } = await supabase
            .from('contacts')
            .select('contact_id, contact_name')
            .eq('user_id', testUserId);

        if (readError) {
            console.error('❌ READ ERROR:', readError.message);
            return false;
        }

        console.log(`\n📖 Read back ${readBack?.length || 0} contacts from database:`);
        readBack?.forEach(c => console.log(`   - ${c.contact_name} (${c.contact_id})`));

        // Clean up test data
        console.log('\n🧹 Cleaning up test data...');
        const { error: deleteError } = await supabase
            .from('contacts')
            .delete()
            .eq('user_id', testUserId);

        if (deleteError) {
            console.error('❌ DELETE ERROR:', deleteError.message);
        } else {
            console.log('✅ Test data cleaned up');
        }

        return readBack?.length === testContacts.length;
    } catch (err) {
        console.error('❌ EXCEPTION:', err.message);
        return false;
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('DATABASE BATCH SAVE TEST');
    console.log('='.repeat(60));

    const success = await testBatchSave();

    console.log('\n' + '='.repeat(60));
    if (success) {
        console.log('✅ TEST PASSED: Batch save is working correctly!');
    } else {
        console.log('❌ TEST FAILED: Check the errors above');
    }
    console.log('='.repeat(60));

    process.exit(success ? 0 : 1);
}

main();
