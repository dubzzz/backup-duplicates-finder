// @ts-check
import fs from 'fs/promises';
import path from 'path';
import * as url from 'url';
import { createHash } from 'crypto';
import { scanDirectory } from './scan.mjs';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

/**
 * @param {string} dir
 * @param {{withHash: boolean, isIncremental:boolean}} options
 * @returns {Promise<{name: string, path:string, hash:string|undefined}[]>}
 */
export async function cachedScanDirectory(dir, options) {
  const cachedResultsPath = path.join(
    __dirname,
    '..',
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
    if (!options.isIncremental) {
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
