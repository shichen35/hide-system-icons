// Runs from the npm "version" lifecycle hook, after package.json has been
// bumped: turns "## [Unreleased]" into "## [x.y.z] - YYYY-MM-DD" and opens a
// fresh, empty Unreleased section above it.
import { readFileSync, writeFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const path = 'CHANGELOG.md';
const changelog = readFileSync(path, 'utf8');

// Git on Windows checks files out with CRLF line endings, so match either
// ending and write new lines with whichever the file already uses.
const heading = '## [Unreleased]';
const match = /^## \[Unreleased\](\r?\n)/m.exec(changelog);
if (!match) {
  console.error(`${path}: no "${heading}" section to release`);
  process.exit(1);
}

const start = match.index;
const eol = match[1];
const bodyStart = start + match[0].length;
const next = changelog.indexOf('\n## [', bodyStart);
const body = changelog.slice(bodyStart, next === -1 ? undefined : next);
if (body.trim() === '') {
  console.error(`${path}: the "${heading}" section is empty`);
  process.exit(1);
}

const date = new Date().toISOString().slice(0, 10);
writeFileSync(
  path,
  changelog.slice(0, start) + `${heading}${eol}${eol}## [${version}] - ${date}${eol}` + changelog.slice(bodyStart),
);
