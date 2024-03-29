// @ts-check
import fs from 'fs/promises';
import path from 'path';
import * as url from 'url';
import { createHash } from 'crypto';
import { scanDirectory } from './scan.mjs';
import { log } from './logger.mjs';

/**
 * @typedef {import('./scan.mjs').FileDescription} FileDescription
 */

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

/**
 * @type {Map<string, FileDescription[]>}
 */
const readCachedResultsFromCache = new Map();

/**
 * @param {string} fileFullPath
 * @param {() => void} [beforeRead]
 * @returns {Promise<FileDescription[]>}
 */
async function readCachedResultsFrom(fileFullPath, beforeRead) {
  const fromCache = readCachedResultsFromCache.get(fileFullPath);
  if (fromCache !== undefined) {
    return fromCache;
  }
  beforeRead?.();
  const fileContentRaw = await fs.readFile(fileFullPath);
  const fileContent = JSON.parse(fileContentRaw.toString());
  readCachedResultsFromCache.set(fileFullPath, fileContent);
  return fileContent;
}

/**
 * @param {string} dir
 * @param {{withHash: boolean, isIncremental:boolean,continueOnFailure:boolean}} options
 * @returns {Promise<FileDescription[]>}
 */
export async function cachedScanDirectory(dir, options) {
  const cachedResultsDirectoryPath = path.join(__dirname, '..', '..', '.cache');
  const cachedResultsPath = path.join(
    cachedResultsDirectoryPath,
    path.basename(dir) + '-' + createHash('sha1').update(dir).digest('hex') + '-' + options.withHash + '.json',
  );
  const printedOptions = JSON.stringify(options);

  let cachedResults = undefined;
  try {
    cachedResults = await readCachedResultsFrom(cachedResultsPath);
    log(
      `Cache found for ${dir} with options ${printedOptions}`,
      [`read from ${cachedResultsPath}`, `got ${cachedResults.length} results`],
      'info',
    );
    if (!options.isIncremental) {
      return cachedResults;
    }
  } catch (err) {
    if (options.isIncremental && options.withHash) {
      const normalizedDir = path.normalize(dir);
      const { appendLine } = log(
        `Aggregating data from already known directories for a faster incremental scan for ${dir}`,
        [],
        'info',
      );
      cachedResults = [];
      const files = await fs.readdir(cachedResultsDirectoryPath, { withFileTypes: true });
      for (const file of files) {
        if (file.isFile()) {
          const fileFullPath = path.join(file.path, file.name);
          const fileContent = await readCachedResultsFrom(fileFullPath, () =>
            appendLine(`Reading from ${fileFullPath}`),
          );

          let addedOne = false;
          for (const item of fileContent) {
            if (typeof item.hash === 'string' && path.normalize(item.path).includes(normalizedDir)) {
              addedOne = true;
              cachedResults.push(item);
            }
          }
          if (addedOne) {
            appendLine(`Total items count: ${cachedResults.length}`);
          }
        }
      }
      cachedResults.sort((a, b) => b.lastChangedMs - a.lastChangedMs);
    }
  }
  const knownFilePathToHash =
    cachedResults !== undefined ? new Map(cachedResults.map((r) => [r.path, r.hash])) : undefined;

  const { appendLine } =
    knownFilePathToHash === undefined
      ? log(`No cache found for ${dir} with options ${printedOptions}`, [], 'warn')
      : log(`Incrementally computing cache for ${dir} with options ${printedOptions}`, [], 'warn');
  const results = await scanDirectory(dir, knownFilePathToHash, options);
  appendLine(`scan found ${results.length} results`);
  await fs.mkdir(path.dirname(cachedResultsPath), { recursive: true });
  await fs.writeFile(cachedResultsPath, JSON.stringify(results));
  appendLine(`wrote cache to ${cachedResultsPath}`);
  readCachedResultsFromCache.set(cachedResultsPath, results);
  return results;
}
