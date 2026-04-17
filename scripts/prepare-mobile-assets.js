const fs = require('fs/promises');
const path = require('path');

const ROOT_DIR = process.cwd();
const MOBILE_WEB_DIR = path.join(ROOT_DIR, 'mobile-web');

const COPY_TARGETS = [
  'index.html',
  'zap-messenger-prototype.html',
  'scripts',
  'styles'
];

async function copyEntry(relativePath) {
  const src = path.join(ROOT_DIR, relativePath);
  const dest = path.join(MOBILE_WEB_DIR, relativePath);
  await fs.cp(src, dest, { recursive: true });
}

async function main() {
  await fs.rm(MOBILE_WEB_DIR, { recursive: true, force: true });
  await fs.mkdir(MOBILE_WEB_DIR, { recursive: true });

  for (const target of COPY_TARGETS) {
    await copyEntry(target);
  }

  console.log('Prepared mobile web assets in mobile-web/.');
}

main().catch((error) => {
  console.error('Failed to prepare mobile assets:', error.message);
  process.exit(1);
});
