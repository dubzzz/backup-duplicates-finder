// @ts-check
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { poolSize, runInPool } from './pool.mjs';
import { log } from './logger.mjs';

/**
 * @param {string} dir
 * @param {Map<string, string|undefined>|undefined} knownFilePathToHash
 * @param {{withHash: boolean}} options
 * @returns {Promise<{name: string, path:string, hash:string|undefined}[]>}
 */
export async function scanDirectory(dir, knownFilePathToHash, options) {
  const fileList = [];
  await scanDirectoryInternal(dir, options.withHash, fileList, knownFilePathToHash ?? new Map());
  return fileList;
}

/**
 * @param {string} dir
 * @param {boolean} withHash
 * @param {{name: string, path:string, hash:string|undefined}[]} fileList
 * @param {Map<string, string|undefined>} knownFilePathToHash
 * @returns {Promise<void>}
 */
async function scanDirectoryInternal(dir, withHash, fileList, knownFilePathToHash) {
  const files = await fs.readdir(dir);

  let resolveDirectoryDone, rejectDirectoryDone;
  const directoryDonePromise = new Promise((r, rej) => {
    resolveDirectoryDone = r;
    rejectDirectoryDone = rej;
  });

  let missing = 0;
  for (const file of files) {
    ++missing;
    scanAnyInternal(dir, file, withHash, fileList, knownFilePathToHash).then(() => {
      if (--missing === 0) resolveDirectoryDone();
    }, rejectDirectoryDone);
  }
  if (missing === 0) {
    resolveDirectoryDone();
  }
  return directoryDonePromise;
}

/**
 * @param {string} dir
 * @param {string} file
 * @param {boolean} withHash
 * @param {{name: string, path:string, hash:string|undefined}[]} fileList
 * @param {Map<string, string|undefined>} knownFilePathToHash
 * @returns {Promise<void>}
 */
async function scanAnyInternal(dir, file, withHash, fileList, knownFilePathToHash) {
  const filePath = path.join(dir, file);
  const stats = await fs.stat(filePath);

  if (stats.isDirectory()) {
    await scanDirectoryInternal(filePath, withHash, fileList, knownFilePathToHash);
  } else if (!withHash) {
    fileList.push({ name: file, path: filePath, hash: undefined });
  } else {
    const alreadyHash = knownFilePathToHash.get(filePath);
    if (alreadyHash !== undefined) {
      fileList.push({ name: file, path: filePath, hash: alreadyHash });
    } else {
      let analytics;
      const sha1sum = await withRetries(
        () =>
          runInPool(
            () => computeHash(filePath),
            stats.size,
            (a) => (analytics = a),
          ),
        5,
      );
      log(
        `Scanned: ${file}`,
        [`analytics: ${JSON.stringify(analytics)}`, `hash: ${sha1sum}`, `pool: ${JSON.stringify(poolSize())}`],
        'debug',
      );
      fileList.push({ name: file, path: filePath, hash: sha1sum });
    }
  }
}

/**
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function computeHash(filePath) {
  const hashComputation = createHash('sha1');
  const fd = await fs.open(filePath);
  const readStream = fd.createReadStream();

  let resolve, reject;
  const promise = new Promise((r, rej) => {
    resolve = r;
    reject = rej;
  });
  readStream.on('data', (data) => hashComputation.update(data));
  readStream.on('error', (err) => {
    reject(new Error(`Failed to compute the hash of ${filePath}`, { cause: err }));
    fd.close();
  });
  readStream.on('end', () => {
    resolve(hashComputation.digest('hex'));
    fd.close();
  });

  return promise;
}

/**
 * @template T
 * @param {() => Promise<T>} action
 * @param {number} count
 * @returns {Promise<T>}
 */
async function withRetries(action, count) {
  const errors = [];
  for (let i = 0; i < count; ++i) {
    try {
      const out = await action();
      return out;
    } catch (err) {
      errors.push(err);
    }
  }
  throw new AggregateError(errors, `Failed after ${count} retries`);
}
