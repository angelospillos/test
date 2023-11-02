import { ContentTypes } from '~/modules/content/content.redux';
import domLayer from '~/services/domLayer';
import Logger from '~/services/logger';

const logger = Logger.get('Runner Debug');

const handleKeydown = (event) => {
  logger.verbose('LOG: keydown', event.key, event.target, event);
};

const handleKeyup = (event) => {
  logger.verbose('LOG: keyup', event.key, event.target, event);
};

const handleMousedown = (event) => {
  logger.verbose('LOG: mousedown', event.target, event);
};

const handleMouseup = (event) => {
  logger.verbose('LOG: mouseup', event.target, event);
};

const handleClick = (event) => {
  logger.verbose('LOG: click', event.target, event);
};

const handleDblClick = (event) => {
  logger.verbose('LOG: dblClick', event.target, event);
};

const handleMouseover = (event) => {
  logger.verbose('LOG: mouseover', event.target, event);
};

const bindings = [
  ['keydown', handleKeydown],
  ['keyup', handleKeyup],
  ['mousedown', handleMousedown],
  ['mouseup', handleMouseup],
  ['click', handleClick],
  ['dblclick', handleDblClick],
  ['mouseover', handleMouseover],
];

const startEventLogger = () => {
  bindings.forEach((binding) => {
    document.addEventListener(binding[0], binding[1], true);
  });
};

const stopEventLogger = () => {
  bindings.forEach((binding) => {
    document.removeEventListener(binding[0], binding[1], true);
  });
};

domLayer.addEventListener('message', (event) => {
  if (!event.data || typeof event.data !== 'object') {
    return;
  }
  switch (event.data?.type) {
    case ContentTypes.GET_SETTINGS_SUCCEEDED: {
      const { isRunning } = event.data.settings;
      if (isRunning) {
        startEventLogger();
      }
      break;
    }
    case ContentTypes.STOP_RUNNING_REQUESTED: {
      stopEventLogger();
      break;
    }
    default:
      break;
  }
});
