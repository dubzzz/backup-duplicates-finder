// @ts-check
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import * as url from 'url';
import './internals/errorHandling.mjs';
import { scanDirectory } from './internals/scan.mjs';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

// Pretty unsafe parsing for argv, but we can stay with it for simplicity (no install)
const options = process.argv.slice(2);
const checksumIncludesHash = process.argv.length <= 2 || options.includes('--hash') || options.includes('--all');
const checksumIncludesFile = process.argv.length <= 2 || options.includes('--file') || options.includes('--all');
const isIncremental = options.includes('--incremental');

/**
 * @param {string} dir
 * @param {{withHash: boolean}} options
 * @returns {Promise<{name: string, path:string, hash:string|undefined}[]>}
 */
async function cachedScanDirectory(dir, options) {
  const cachedResultsPath = path.join(
    __dirname,
    '..',
    '.cache',
    path.basename(dir) + '-' + createHash('sha1').update(dir).digest('hex') + '-' + options.withHash + '.json',
  );
  const printedOptions = JSON.stringify(options);

  let knownFilePathToHash = undefined;
  try {
    const cachedResultsRaw = await fs.readFile(cachedResultsPath);
    console.info(`ℹ️ Cache found for ${dir} with options ${printedOptions}`);
    console.info(`  -> read from ${cachedResultsPath}`);
    const cachedResults = JSON.parse(cachedResultsRaw.toString());
    console.info(`  -> got ${cachedResults.length} results`);
    if (!isIncremental) {
      return cachedResults;
    }
    knownFilePathToHash = new Map(cachedResults.map((r) => [r.path, r.hash]));
  } catch (err) {}

  if (knownFilePathToHash === undefined) {
    console.info(`⚠️ No cache found for ${dir} with options ${printedOptions}`);
  } else {
    console.info(`⚠️ Incrementally computing cache for ${dir} with options ${printedOptions}`);
  }
  const results = await scanDirectory(dir, knownFilePathToHash, options);
  console.info(`  -> scan found ${results.length} results`);
  await fs.mkdir(path.dirname(cachedResultsPath), { recursive: true });
  await fs.writeFile(cachedResultsPath, JSON.stringify(results));
  console.info(`  -> wrote cache to ${cachedResultsPath}`);
  return results;
}

/**
 * @param {string} dir
 * @returns {Promise<[string, {file:string,filePath:string}][]>}
 */
async function listFilesRecursively(dir) {
  const options = { withHash: checksumIncludesHash };
  const results = await cachedScanDirectory(dir, options);
  return results.map((entry) => [
    [checksumIncludesHash ? `hash:${entry.hash}` : '', checksumIncludesFile ? `file:${entry.name}` : ''].join(':'),
    { file: entry.name, filePath: entry.path },
  ]);
}

const sourcePath = `D:\\My Drive\\My files\\Photos`;
const sourceContent = new Map(await listFilesRecursively(sourcePath));

const copyPath = `D:\\Backup 001\\Photos`;
const copyContent = new Map(await listFilesRecursively(copyPath));

console.info(`ℹ️ Check if some entries of "copy" are missing in "source"`);
console.info(`  -> with source: ${sourcePath}`);
console.info(`  -> with copy: ${copyPath}`);
console.info(`  -> with hash: ${checksumIncludesHash ? 'ON' : 'OFF'}`);
console.info(`  -> with file: ${checksumIncludesFile ? 'ON' : 'OFF'}\n\n`);

let numMissing = 0;
for (const [checksum, { filePath }] of copyContent) {
  if (!sourceContent.has(checksum)) {
    ++numMissing;
    console.warn(`No such ${JSON.stringify(filePath)} in source`);
  }
}
if (numMissing !== 0) {
  console.log(`Found ${numMissing} elements in copy that cannot match anything in source`);
  console.log(`  -> with source: ${sourcePath}`);
  console.log(`  -> with copy: ${copyPath}`);
} else {
  console.log(`Every element known is copy is available in source`);
  console.log(`  -> with source: ${sourcePath}`);
  console.log(`  -> with copy: ${copyPath}`);
}
