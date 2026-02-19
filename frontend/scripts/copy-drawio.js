/**
 * copy-drawio.js
 *
 * Copies the draw.io webapp from ../drawio/src/main/webapp/ into public/drawio/
 * so Next.js can serve it as a static asset at /drawio/index.html.
 *
 * Run via: node scripts/copy-drawio.js
 * Hooked into npm scripts as predev / prebuild.
 */

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', '..', 'drawio', 'src', 'main', 'webapp');
const DEST = path.resolve(__dirname, '..', 'public', 'drawio');

// Directories to copy (these contain the core draw.io app)
const DIRS_TO_COPY = [
    'js',
    'styles',
    'resources',
    'shapes',
    'stencils',
    'images',
    'img',
    'mxgraph',
    'math4',
    'connect',
    'plugins',
    'templates',
];

// Individual files to copy from the root
const FILES_TO_COPY = [
    'index.html',
    'favicon.ico',
    'open.html',
    'export3.html',
    'service-worker.js',
];

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });

    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function main() {
    if (!fs.existsSync(SRC)) {
        console.warn('[copy-drawio] Source not found:', SRC);
        console.warn('[copy-drawio] Skipping draw.io asset copy.');
        return;
    }

    // Check if already copied (skip if dest index.html exists and is up-to-date)
    const destIndex = path.join(DEST, 'index.html');
    const srcIndex = path.join(SRC, 'index.html');

    if (fs.existsSync(destIndex)) {
        const srcStat = fs.statSync(srcIndex);
        const destStat = fs.statSync(destIndex);
        if (destStat.mtimeMs >= srcStat.mtimeMs) {
            console.log('[copy-drawio] public/drawio/ is up-to-date, skipping.');
            return;
        }
    }

    console.log('[copy-drawio] Copying draw.io webapp to public/drawio/ ...');

    // Clean destination
    if (fs.existsSync(DEST)) {
        fs.rmSync(DEST, { recursive: true, force: true });
    }
    fs.mkdirSync(DEST, { recursive: true });

    // Copy directories
    for (const dir of DIRS_TO_COPY) {
        const srcDir = path.join(SRC, dir);
        if (fs.existsSync(srcDir)) {
            copyDir(srcDir, path.join(DEST, dir));
        }
    }

    // Copy individual files
    for (const file of FILES_TO_COPY) {
        const srcFile = path.join(SRC, file);
        if (fs.existsSync(srcFile)) {
            fs.copyFileSync(srcFile, path.join(DEST, file));
        }
    }

    console.log('[copy-drawio] Done.');
}

main();
