// Copies metadata.json to the build output with "version-name" set from
// package.json. extensions.gnome.org only accepts [a-zA-Z0-9 .]{1,16} there,
// so a pre-release such as 1.1.0-rc.1 is written as "1.1.0 rc.1".
import { readFileSync, writeFileSync } from 'node:fs';

const [src, dest] = process.argv.slice(2);
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const versionName = version.replace(/[^a-zA-Z0-9 .]/g, ' ');
if (versionName.length > 16) {
  console.error(`version-name "${versionName}" is longer than the 16 characters extensions.gnome.org allows`);
  process.exit(1);
}

const metadata = JSON.parse(readFileSync(src, 'utf8'));
metadata['version-name'] = versionName;
writeFileSync(dest, JSON.stringify(metadata, null, 2) + '\n');
