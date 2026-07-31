const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
async function run() {
  const { data, error } = await supabase.from('texts').select('id, title_target, title_translit, title_en, doc, new_words').ilike('title_translit', '%Roz%');
  console.log(JSON.stringify(data, null, 2));
}
run();
