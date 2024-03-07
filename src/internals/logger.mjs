const prefixes = { debug: '🐞 ', info: 'ℹ️ ', warn: '⚠️ ', error: '💥 ' };

/**
 * @param {string} message
 * @param {string[]} details
 * @param {keyof typeof console} [kind]
 * @returns {{appendLine: (line:string) => void}}
 */
export function log(message, details, kind = 'log') {
  const logger = console[kind ?? 'log'];
  const prefix = prefixes[kind] ?? '';
  logger(prefix + message);
  for (const line of details) {
    logger(`  -> ${line}`);
  }
  return { appendLine: (line) => logger(`  -> ${line}`) };
}
