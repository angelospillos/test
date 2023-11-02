import Logger from '~/services/logger';
import runtimeMessaging, * as commands from '~/services/runtimeMessaging';

const logger = Logger.get('Offscreen script');

setInterval(() => {
  runtimeMessaging.sendMessageToBackground({
    command: commands.KEEP_ALIVE_FROM_OFFSCREEN,
  });
}, 20e3);

logger.info('Offscreen script is initiated.');
