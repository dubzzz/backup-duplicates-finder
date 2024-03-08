// @ts-check
const prefixes = { debug: '🐞 ', info: 'ℹ️ ', warn: '⚠️ ', error: '💥 ' };

/**
 * @param {string|[string, ...unknown[]]} message
 * @param {(string|[string, ...unknown[]])[]} details
 * @param {'log'|'debug'|'info'|'warn'|'error'} [kind]
 * @returns {{appendLine: (line:string|[string, ...unknown[]]) => void}}
 */
export function log(message, details, kind = 'log') {
  const logger = console[kind ?? 'log'];
  const prefix = prefixes[kind] ?? '';

  if (typeof message === 'string') {
    logger(prefix + message);
  } else {
    logger(prefix + message[0], ...message.slice(1));
  }

  /**
   * @param {string|[string, ...unknown[]]} line
   */
  const appendLine = (line) => {
    if (typeof line === 'string') {
      logger(`  -> ${line}`);
    } else {
      logger(`  -> ${line[0]}`, ...line.slice(1));
    }
  };

  for (const line of details) {
    appendLine(line);
  }
  return { appendLine };
}
