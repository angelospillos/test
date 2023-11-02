import { RecorderActions } from '~/modules/recorder/recorder.redux';
import BaseService from '~/services/baseService';
import runtimeMessaging from '~/services/runtimeMessaging/runtimeMessaging';

const LAYER_CLASSNAME = 'angelos-mouse-events-catcher';

class EventsCatcherLayer extends BaseService {
  constructor() {
    super('EventsCatcherLayer');
    this.toggleVerboseLogs();
  }

  areMouseEventsEnabled = () => !this.blockingLayerElement || this.blockingLayerElement.hidden;

  isLayerEvent = (event) =>
    !this.areMouseEventsEnabled() && event.target.isSameNode(this.blockingLayerElement);

  disableMouseEventsWithPropagation = () => {
    runtimeMessaging.dispatchActionInBackground(
      RecorderActions.lockNativeMouseInteractionsRequested(),
    );
  };

  enableMouseEventsWithPropagation = () => {
    runtimeMessaging.dispatchActionInBackground(
      RecorderActions.unlockNativeMouseInteractionsRequested(),
    );
  };

  disableMouseEvents = () => {
    this.logVerbose('Mouse events disabled');
    this.blockingLayerElement =
      this.blockingLayerElement ||
      document.querySelector(`.${LAYER_CLASSNAME}`) ||
      document.createElement('div');

    this.blockingLayerElement.classList.add(LAYER_CLASSNAME);
    this.blockingLayerElement.hidden = false;

    const container = document.querySelector('.angelos') ?? document.documentElement;
    container.prepend(this.blockingLayerElement);
  };

  enableMouseEventAfterIFrameHover = () => {
    this.logVerbose('Mouse events enabled because mouse points to iframe element');
    this.blockingLayerElement.hidden = true;
  };

  enableMouseEvents = () => {
    this.logVerbose('Mouse events enabled');

    if (this.blockingLayerElement) {
      this.blockingLayerElement.remove();
    }
  };

  getClosestToTargetNonBlockingElement = (event) => {
    const { clientX, clientY } = event;
    const detectedElements = document.elementsFromPoint(clientX, clientY);

    return [...detectedElements].filter(
      (element) => !element.classList.contains(LAYER_CLASSNAME),
    )?.[0];
  };
}

export default EventsCatcherLayer;
