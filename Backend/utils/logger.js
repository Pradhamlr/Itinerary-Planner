const fs = require('fs');
const path = require('path');

const LOG_DIRECTORY = path.join(__dirname, '..', 'logs');
const LOG_FILE_PATH = path.join(LOG_DIRECTORY, 'backend.log');
const INFO_TO_CONSOLE = String(process.env.LOG_INFO_TO_CONSOLE || 'false').toLowerCase() === 'true';

const ensureLogDirectory = () => {
  if (!fs.existsSync(LOG_DIRECTORY)) {
    fs.mkdirSync(LOG_DIRECTORY, { recursive: true });
  }
};

const formatPayload = (payload) => {
  if (!payload) {
    return '';
  }

  try {
    return ` ${JSON.stringify(payload)}`;
  } catch (error) {
    return ' [unserializable payload]';
  }
};

const log = (level, message, payload) => {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}${formatPayload(payload)}`;
  ensureLogDirectory();
  fs.appendFileSync(LOG_FILE_PATH, `${line}\n`, 'utf8');

  if (level === 'ERROR') {
    console.error(line);
    return;
  }

  if (level === 'WARN') {
    console.warn(line);
    return;
  }

  if (INFO_TO_CONSOLE) {
    console.log(line);
  }
};

module.exports = {
  info: (message, payload) => log('INFO', message, payload),
  warn: (message, payload) => log('WARN', message, payload),
  error: (message, payload) => log('ERROR', message, payload),
};
