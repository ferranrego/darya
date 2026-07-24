import fs from 'fs';
import path from 'path';

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (!['.git', '.next', 'node_modules', '.pnpm-store', 'temp', 'supabase'].includes(file)) {
        walk(full);
      }
    } else {
      if (['.ts', '.tsx', '.md', '.json', '.txt', '.js', '.mjs'].includes(path.extname(full))) {
        const content = fs.readFileSync(full, 'utf8');
        if (content.includes('-')) {
          // We'll replace ' - ' with ' - ' and '-' with '-'
          let newContent = content.replace(/ - /g, ' - ').replace(/-/g, '-');
          fs.writeFileSync(full, newContent);
          console.log(`Updated ${full}`);
        }
      }
    }
  }
}
walk(process.cwd());
