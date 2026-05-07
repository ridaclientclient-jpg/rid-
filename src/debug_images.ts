import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; // Use service role if available for better debug, but anon is what client uses

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugProducts() {
  console.log('Fetching products...');
  const { data, error } = await supabase
    .from('products')
    .select('id, name, image_url, vendor_id')
    .limit(5);

  if (error) {
    console.error('Error fetching products:', error);
    return;
  }

  console.log('Sample Products:');
  console.log(JSON.stringify(data, null, 2));

  for (const p of data) {
    if (p.image_url) {
      const path = p.image_url.replace('products/', '');
      const { data: pubUrl } = supabase.storage.from('products').getPublicUrl(path);
      console.log(`Product: ${p.name}`);
      console.log(`  image_url in DB: ${p.image_url}`);
      console.log(`  Path used for storage: ${path}`);
      console.log(`  Generated Public URL: ${pubUrl.publicUrl}`);
    }
  }
}

debugProducts();
