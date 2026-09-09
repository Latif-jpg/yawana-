const fs = require('fs');
const path = require('path');

const targets = ['.expo', 'dist', 'build'];

for (const target of targets) {
  const absolutePath = path.resolve(process.cwd(), target);
  if (fs.existsSync(absolutePath)) {
    fs.rmSync(absolutePath, { recursive: true, force: true });
    console.log(`Removed ${target}`);
  }
}
