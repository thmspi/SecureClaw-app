const fs = require('fs');
const path = require('path');

const distDir = path.join(process.cwd(), 'dist');
const packageJsonPath = path.join(distDir, 'package.json');

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(
  packageJsonPath,
  `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`,
  'utf8'
);
