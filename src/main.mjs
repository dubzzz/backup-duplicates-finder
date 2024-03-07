// @ts-check
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import * as url from 'url';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import './internals/errorHandling.mjs';
import { scanDirectory } from './internals/scan.mjs';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const argv = await yargs(hideBin(process.argv))
  .command(
    'yarn check <path_copy> <path_source>',
    'detect content of <path_copy> that is missing in <path_source>',
    () => {},
    (argv) => console.info(argv),
  )
  .option('incremental', {
    alias: 'i',
    type: 'boolean',
    description: 'Force to rebuild the cache but incrementally if we already know hashes',
  })
  .option('no-hash', {
    type: 'boolean',
    description: 'Do not use the hash of the files to compare them together',
  })
  .option('no-name', {
    type: 'boolean',
    description: 'Do not use the file name of the files to compare them together',
  })
  .demandCommand(2, 2)
  .parse();

const checksumIncludesHash = !argv['no-hash'];
const checksumIncludesName = !argv['no-name'];
const isIncremental = !!argv['incremental'];
const [sourcePath, copyPath] = argv._;

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
    [checksumIncludesHash ? `hash:${entry.hash}` : '', checksumIncludesName ? `file:${entry.name}` : ''].join(':'),
    { file: entry.name, filePath: entry.path },
  ]);
}

const sourceContent = new Map(await listFilesRecursively(String(sourcePath)));
const copyContent = new Map(await listFilesRecursively(String(copyPath)));

console.info(`ℹ️ Check if some entries of "copy" are missing in "source"`);
console.info(`  -> with source: ${sourcePath}`);
console.info(`  -> with copy: ${copyPath}`);
console.info(`  -> with hash: ${checksumIncludesHash ? 'ON' : 'OFF'}`);
console.info(`  -> with file: ${checksumIncludesName ? 'ON' : 'OFF'}\n\n`);

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
