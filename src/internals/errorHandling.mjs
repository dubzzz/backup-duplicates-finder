// @ts-check
import process from 'process';
import { log } from './logger.mjs';

process.on('unhandledRejection', (reason, p) => {
  log(['Unhandled Rejection at:', p], [['reason:', reason]], 'error');
  process.exit(1);
});
process.on('uncaughtException', (error) => {
  log(['Caught exception:', error], [], 'error');
  log(`Exception origin: ${error.stack}`, [], 'error');
  process.exit(1);
});
