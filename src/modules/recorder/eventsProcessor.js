import {
    eqProps,
    is,
    isEmpty,
    isNil,
    last,
    omit,
    pick,
    propEq,
    props,
    without,
    takeLast,
  } from 'ramda';
  
  import { HTMLTags, HTMLInputTypes } from '~/constants/browser';
  import { SELECT_TYPE, WAITING_CONDITION_TYPE } from '~/constants/step';
  import {
    EVENT_TYPE,
    STEP_SCROLL_TARGET_TYPE,
    STEP_TYPE,
    NAVIGATION_EVENTS,
    STEP_SCROLL_TO_TYPE,
    MAIN_FRAME_LOCATION,
    DND_TARGET_TYPE,
  } from '~/constants/test';
  import Logger from '~/services/logger';
  import * as keyboardLayout from '~/utils/keyboardLayout';
  import { genFrontId } from '~/utils/misc';
  
  import { getScrollDirection, processTypingEventsToText } from './eventsProcessor.helpers';
  
  const logger = Logger.get('EventsProcessor');
  
  class EventsProcessor {
    constructor(event, processingData) {
      const { steps, stepsOrder, tabContext, cachedScreenshots } = processingData;
      this.event = event;
      this.steps = { ...steps };
      this.stepsOrder = [...stepsOrder];
      this.context = { ...tabContext };
      this.cachedScreenshots = cachedScreenshots;
      this.diff = {
        added: [],
        modified: [],
        removed: [],
        artifacts: {},
      };
      this.eventToFuncMap = {
        [EVENT_TYPE.GOTO]: this.processGoto,
        [EVENT_TYPE.PAGE_NAVIGATION]: this.processPageNavigation,
        [EVENT_TYPE.NEW_TAB]: this.processNewTab,
        [EVENT_TYPE.CLOSE_TAB]: this.processCloseTab,
        [EVENT_TYPE.CLICK]: this.processClick,
        [EVENT_TYPE.DOUBLE_CLICK]: this.processDblClick,
        [EVENT_TYPE.RIGHT_CLICK]: this.processRightClick,
        [EVENT_TYPE.CHANGE]: this.processChange,
        [EVENT_TYPE.KEYDOWN]: this.processKeyDown,
        [EVENT_TYPE.MOUSEDOWN]: this.processMouseDown,
        [EVENT_TYPE.PASTE]: this.processPaste,
        [EVENT_TYPE.SCROLL]: this.processScroll,
        [EVENT_TYPE.HOVER]: this.processHover,
        [EVENT_TYPE.ASSERT]: this.processAssert,
        [EVENT_TYPE.SWITCH_CONTEXT]: this.processSwitchContext,
        [EVENT_TYPE.DROP]: this.processDrop,
        [EVENT_TYPE.ANSWER_PROMPT]: this.processAnswerPrompt,
        [EVENT_TYPE.SET_LOCAL_VARIABLE]: this.processSetLocalVariable,
        [EVENT_TYPE.INSERT_LOCAL_VARIABLE]: this.processInsertLocalVariable,
      };
      this.ignoredEvents = [EVENT_TYPE.MOUSEUP];
    }
  
    get lastStep() {
      if (this.stepsOrder.length) {
        const lastFrontId = last(this.stepsOrder);
        return this.steps[lastFrontId];
      }
      return undefined;
    }
  
    get lastStepScreenshot() {
      const { lastStep } = this;
      if (lastStep) {
        return this.cachedScreenshots[lastStep.frontId];
      }
      return null;
    }
  
    get stepsList() {
      return this.stepsOrder.map((stepId) => this.steps[stepId]);
    }
  
    hasContextChanged = () =>
      !NAVIGATION_EVENTS.includes(this.event.type) &&
      is(Number, this.event.tabNo) &&
      this.event.frameLocation &&
      (this.event.tabNo !== this.context.tabNo ||
        this.event.frameLocation !== this.context.frameLocation);
  
    hasUrlChanged = () => {
      const ignoredStepTypes = [
        STEP_TYPE.GOTO,
        STEP_TYPE.NEW_TAB,
        STEP_TYPE.CLOSE_TAB,
        STEP_TYPE.SWITCH_CONTEXT,
      ];
  
      if (
        !this.lastStep ||
        ignoredStepTypes.includes(this.lastStep.type) ||
        !this.lastStep.frameIsRoot ||
        isNil(this.event.frameSrc) ||
        isNil(this.lastStep.frameSrc)
      ) {
        return false;
      }
  
      return (
        !propEq('frameSessionId', this.lastStep.frameSessionId, this.event) ||
        !propEq('frameSrc', this.lastStep.frameSrc, this.event)
      );
    };
  
    updateContext = (newContext) => {
      this.context = newContext;
    };
  
    initContext = () => {
      this.updateContext({
        tabNo: this.event.tabNo,
        frameLocation: MAIN_FRAME_LOCATION,
      });
    };
  
    createSwitchContextStep = () => {
      const newContext = {
        tabNo: this.event.tabNo,
        frameLocation: this.event.frameLocation,
      };
      this.updateContext(newContext);
  
      if (this.hasLastStepType(STEP_TYPE.SWITCH_CONTEXT)) {
        this.modifyStep(this.lastStep.frontId, newContext);
      } else {
        this.createStep(
          {
            type: STEP_TYPE.SWITCH_CONTEXT,
            frontId: genFrontId(),
            isActive: true,
            tabNo: this.event.tabNo,
            windowNo: this.event.windowNo,
            frameLocation: this.event.frameLocation,
            groupId: this.event.groupId,
            testId: this.event.testId,
            isNewGroup: this.event.isNewGroup,
            screenshotData: null,
            timestamp: this.event.timestamp - 1, // position before this.event
            isClipboard: this.event.isClipboard,
            selectors: [],
          },
          {
            waitingConditions: [],
          },
          false,
        );
      }
    };
  
    getWaitingConditions = (event) => {
      if (NAVIGATION_EVENTS.includes(event.type) || event.isTargetDocument) {
        return [];
      }
      const waitingConditions = [];
      if (!event.isVisible || event.type === STEP_TYPE.SCROLL) {
        waitingConditions.push({ type: WAITING_CONDITION_TYPE.ELEMENT_IS_VISIBLE, isActive: false });
      }
      if (event.isDisabled || [STEP_TYPE.ASSERT].includes(event.type)) {
        waitingConditions.push({
          type: WAITING_CONDITION_TYPE.ELEMENT_IS_NOT_DISABLED,
          isActive: false,
        });
      }
      if (
        event.isCovered ||
        [STEP_TYPE.CHANGE, STEP_TYPE.UPLOAD_FILE, STEP_TYPE.SCROLL].includes(event.type)
      ) {
        waitingConditions.push({
          type: WAITING_CONDITION_TYPE.ELEMENT_IS_NOT_COVERED,
          isActive: false,
        });
      }
      if ([STEP_TYPE.CHANGE, STEP_TYPE.UPLOAD_FILE].includes(event.type)) {
        waitingConditions.push({
          type: WAITING_CONDITION_TYPE.ELEMENT_HAS_FOCUS,
          isActive: false,
        });
      }
  
      return waitingConditions;
    };
  
    createStep = (event, modifiers = {}, shouldDetectChanges = true) => {
      if (shouldDetectChanges) {
        this.processSwitchContext();
        if (this.hasUrlChanged()) {
          this.processPageNavigation();
        }
      }
  
      const newStep = {
        ...event,
        sourceEventId: event.frontId,
        waitingConditions: this.getWaitingConditions(event),
        ...modifiers,
      };
      const { frontId } = newStep;
      this.steps[frontId] = newStep;
      this.stepsOrder.push(frontId);
      this.diff.added.push(frontId);
  
      return newStep;
    };
  
    createClearStep = (modifiers = {}) =>
      this.createStep(this.event, {
        type: STEP_TYPE.CLEAR,
        frontId: genFrontId(),
        timestamp: this.event.timestamp - 1,
        ...modifiers,
      });
  
    modifyStep = (frontId, modifiers = {}) => {
      this.steps[frontId] = {
        ...this.steps[frontId],
        ...modifiers,
      };
  
      if (!this.diff.added.includes(frontId)) {
        this.diff.modified.push(frontId);
      }
    };
  
    createArtifact = (frontId, file) => {
      this.diff.artifacts[frontId] = {
        ...file,
        frontId,
      };
    };
  
    deleteArtifact = (frontId) => {
      delete this.diff.artifacts[frontId];
    };
  
    modifySteps = (steps) => {
      for (let index = 0; index < steps.length; index += 1) {
        const step = steps[index];
        this.modifyStep(step.frontId, step);
      }
    };
  
    deleteSteps = (ids) => {
      this.steps = omit(ids, this.steps);
      this.stepsOrder = without(ids, this.stepsOrder);
      const cachedAdded = this.diff.added;
      const cachedModified = this.diff.modified;
      this.diff.added = without(ids, cachedAdded);
      this.diff.modified = without(ids, cachedModified);
      this.diff.removed.push(...without([...cachedAdded, ...cachedModified], ids));
      this.diff.artifacts = omit(ids, this.diff.artifacts);
    };
  
    deleteLastStep = () => {
      const frontId = last(this.stepsOrder);
      this.deleteSteps([frontId]);
    };
  
    hasStepType = (step, value) => propEq('type', value, step || {});
  
    hasLastStepType = (value) => this.hasStepType(this.lastStep, value);
  
    process = () => {
      const { type, isTrusted } = this.event;
      if (!isTrusted) {
        logger.verbose(`Event ${this.event.type} is not trusted. Omitting...`, this.event);
        return this.getResult();
      }
  
      if (this.ignoredEvents.includes(type)) {
        logger.verbose(`Event ${this.event.type} is ignored. Omitting...`, this.event);
        return this.getResult();
      }
  
      const func = this.eventToFuncMap[type];
      if (!func) {
        throw new Error(`Missing handler for ${type}`);
      }
  
      if (this.context.tabNo === undefined) {
        this.initContext();
      }
      func(this.event);
      return this.getResult();
    };
  
    getResult = () => {
      const stepsAdded = pick(this.diff.added, this.steps);
      const stepsModified = pick(this.diff.modified, this.steps);
      const hasChanged = Boolean(
        this.diff.added.length || this.diff.modified.length || this.diff.removed.length,
      );
      return {
        hasChanged,
        stepsAdded,
        stepsModified,
        diff: omit(['artifacts'], this.diff),
        tabContext: this.context,
        artifacts: this.diff.artifacts,
      };
    };
  
    modifyOrDeleteScrollIfNeeded = () => {
      if (this.hasLastStepType(STEP_TYPE.SCROLL)) {
        if (!this.event.isTargetCreatedRecently && !this.event.hasChangedVisibilityRecently) {
          // If element was not added and has not changed visibility during the scroll
          this.deleteLastStep();
        } else if (!this.lastStep.isMultiAxis) {
          this.modifyStep(this.lastStep.frontId, {
            scrollTo: STEP_SCROLL_TO_TYPE.UNTIL_NEXT_STEP_ELEMENT_IS_VISIBLE,
            scrollDirection: getScrollDirection(this.lastStep),
          });
        }
      }
    };
  
    processGoto = () => {
      if (this.hasLastStepType(STEP_TYPE.NEW_TAB)) {
        this.modifyStep(this.lastStep.frontId, pick(['url', 'username', 'password'], this.event));
        return;
      }
      this.createStep(this.event, { type: STEP_TYPE.GOTO });
    };
  
    processMouseDown = () => {
      if (this.event.tagName === HTMLTags.HTML || this.event.isOptionClick) {
        return;
      }
  
      this.modifyOrDeleteScrollIfNeeded();
      this.createStep(this.event, { type: STEP_TYPE.CLICK, origType: this.event.type });
    };
  
    #isClickInterruptedBy = (stepType) => {
      if (this.hasLastStepType(stepType)) {
        const stepBeforeSwitch = takeLast(2, this.stepsList)[0];
        if (this.hasStepType(stepBeforeSwitch, STEP_TYPE.CLICK)) {
          if (
            !this.hasPreviousStepDifferentProp(stepBeforeSwitch, 'targetId') &&
            propEq('origType', EVENT_TYPE.MOUSEDOWN, stepBeforeSwitch)
          ) {
            return true;
          }
        }
      }
      return false;
    };
  
    processClick = () => {
      const {
        mouseOverClickedElement,
        tagName,
        isCovered,
        hasLabelTag,
        isOptionClick,
        tagAttributes,
      } = this.event;
  
      if (
        !mouseOverClickedElement ||
        tagName === HTMLTags.HTML ||
        isCovered ||
        isOptionClick ||
        tagAttributes?.type === HTMLInputTypes.RANGE
      ) {
        // mouseOverClickedElement -> exclude clicks emitted by ENTER in <form> tag
        return;
      }
  
      if (this.hasLastStepType(STEP_TYPE.DRAG_AND_DROP) && !this.hasPropChanged('targetId')) {
        return;
      }
  
      /*
        It handles scenario when after a user click a prompt or tab opens.
        Sometime an event race could happen (eg. prompt blocks js thread), so we need to check manually
        if click recording was interrupted by "answer prompt" or "switch context" step.
      */
      if (
        this.#isClickInterruptedBy(STEP_TYPE.ANSWER_PROMPT) ||
        this.#isClickInterruptedBy(STEP_TYPE.SWITCH_CONTEXT)
      ) {
        return;
      }
  
      if (this.hasLastStepType(STEP_TYPE.CLICK)) {
        const hasSameClientPosition =
          !this.hasPropChanged('clientX') && !this.hasPropChanged('clientY');
  
        if (hasSameClientPosition && hasLabelTag) {
          // click emitted by clicking on checkbox inside <label>
          return;
        }
  
        if (
          (hasSameClientPosition || !this.hasPropChanged('targetId')) &&
          propEq('origType', EVENT_TYPE.MOUSEDOWN, this.lastStep)
        ) {
          this.modifyStep(this.lastStep.frontId, { timestamp: this.event.timestamp });
          // click event after mousedown event so omit it
          return;
        }
      }
      this.createStep(this.event);
    };
  
    processDblClick = () => {
      if (this.hasLastStepType(STEP_TYPE.CLICK) && !this.hasPropChanged('targetId')) {
        this.deleteLastStep();
        this.modifyStep(this.lastStep.frontId, {
          type: STEP_TYPE.DOUBLE_CLICK,
          timestamp: this.event.timestamp,
        });
        return;
      }
      this.createStep({ ...this.event, type: STEP_TYPE.DOUBLE_CLICK });
    };
  
    processRightClick = () => {
      if (
        (this.hasLastStepType(STEP_TYPE.CLICK) || this.hasLastStepType(STEP_TYPE.RIGHT_CLICK)) &&
        !this.hasPropChanged('targetId')
      ) {
        this.modifyStep(this.lastStep.frontId, {
          type: STEP_TYPE.RIGHT_CLICK,
          timestamp: this.event.timestamp,
        });
        return;
      }
      this.createStep({ ...this.event, type: STEP_TYPE.RIGHT_CLICK });
    };
  
    hasPreviousStepDifferentProp = (step, name) => !eqProps(name, step || {}, this.event || {});
  
    hasPropChanged = (name) => this.hasPreviousStepDifferentProp(this.lastStep, name);
  
    shouldModifyPreviousTypeStep = () =>
      this.hasLastStepType(STEP_TYPE.TYPE) &&
      !this.hasPropChanged('targetId') &&
      !this.lastStep.enterOrTab;
  
    getTyping = () => {
      const eventWithRequiredFields = pick(
        ['oldValue', 'key', 'keyCode', 'sequence', 'isPasted'],
        this.event,
      );
      return this.shouldModifyPreviousTypeStep()
        ? [...(this.lastStep.typing || []), eventWithRequiredFields]
        : [eventWithRequiredFields];
    };
  
    getUsedVariablesNamesInType = () => {
      const curentVariables = this.shouldModifyPreviousTypeStep()
        ? this.lastStep.usedVariablesNames ?? []
        : [];
      return [...curentVariables, this.event.usedVariableName].filter(Boolean);
    };
  
    handleTypingWithSelection = () => {
      const hasTargetIdChanged = this.hasPropChanged('targetId');
      const lastScreenshot = this.lastStepScreenshot;
      const [oldValue, frameSrc, enterOrTab] = props(
        ['oldValue', 'frameSrc', 'enterOrTab'],
        this.lastStep,
      );
      const isTypeStep = this.hasLastStepType(STEP_TYPE.TYPE);
  
      if (isTypeStep && !hasTargetIdChanged && !enterOrTab) {
        this.deleteLastStep();
      }
  
      const isClearStep = this.hasLastStepType(STEP_TYPE.CLEAR);
  
      const isClearAfterEnterClick = isTypeStep && enterOrTab;
  
      if (
        isClearAfterEnterClick ||
        ((!isTypeStep || !!oldValue) && (!isClearStep || hasTargetIdChanged))
      ) {
        this.createClearStep({ screenshotData: lastScreenshot, frameSrc });
        this.event.oldValue = '';
      }
    };
  
    processKeyDown = () => {
      if (!this.event.keyCode) {
        return;
      }
  
      this.modifyOrDeleteScrollIfNeeded();
  
      if (this.event.isSelectActive) {
        this.handleTypingWithSelection();
  
        if (keyboardLayout.isBackspace(this.event.keyCode)) {
          return;
        }
      }
  
      this.event.sequence = keyboardLayout.getSequenceByKey(this.event.key);
      const { enterOrTab } = this.event;
  
      const typing = this.getTyping();
      const usedVariablesNames = this.getUsedVariablesNamesInType();
      const textData = processTypingEventsToText(typing);
      const hasTargetIdChanged = this.hasPropChanged('targetId');
  
      if (textData.clearBefore && !hasTargetIdChanged) {
        const isTypeStep = this.hasLastStepType(STEP_TYPE.TYPE);
        const lastScreenshot = this.lastStepScreenshot;
        const [oldValue, frameSrc] = props(['oldValue', 'frameSrc'], this.lastStep);
  
        if (isTypeStep) {
          this.deleteLastStep();
        }
  
        if ((!isTypeStep || !!oldValue) && !this.hasLastStepType(STEP_TYPE.CLEAR)) {
          this.createClearStep({
            screenshotData: lastScreenshot,
            frameSrc,
          });
        }
      }
  
      if (this.shouldModifyPreviousTypeStep() && !textData.clearBefore) {
        // User started typing and deleted everything at the end
        if (this.event.oldValue && isEmpty(textData.value)) {
          this.deleteLastStep();
        } else {
          // User is typing
          this.modifyStep(this.lastStep.frontId, {
            enterOrTab,
            value: textData.value,
            typing,
            frameSrc: this.event.frameSrc,
            sourceEventId: this.event.frontId,
            timestamp: this.event.timestamp,
            waitingConditions: this.getWaitingConditions(this.event),
            usedVariablesNames,
          });
        }
      } else if (textData.value) {
        this.createStep(this.event, {
          type: STEP_TYPE.TYPE,
          enterOrTab,
          typing,
          usedVariablesNames,
          value: textData.value,
          withScreenshot: true,
        });
        this.shouldCaptureEventScreenshot = true;
      }
    };
  
    processPaste = () => {
      if (this.event.isSelectActive) {
        this.handleTypingWithSelection();
      }
      this.event.sequence = this.event.value;
      this.event.isPasted = true;
      this.event.type = STEP_TYPE.TYPE;
      const typing = this.getTyping();
      const usedVariablesNames = this.getUsedVariablesNamesInType();
  
      if (this.shouldModifyPreviousTypeStep()) {
        const value = `${this.lastStep.value}${this.event.value}`;
  
        this.modifyStep(this.lastStep.frontId, {
          sequence: this.event.value,
          isPasted: true,
          value,
          typing,
          usedVariablesNames,
          frameSrc: this.event.frameSrc,
          sourceEventId: this.event.frontId,
          timestamp: this.event.timestamp,
        });
      } else {
        this.createStep(this.event, { typing, usedVariablesNames });
      }
    };
  
    processScroll = () => {
      if (this.hasLastStepType(STEP_TYPE.SCROLL) && !this.hasPropChanged('targetId')) {
        const isMultiAxis =
          this.event.scrollX !== this.lastStep.windowScrollX &&
          this.event.scrollY !== this.lastStep.windowScrollY;
        this.modifyStep(this.lastStep.frontId, {
          scrollX: this.event.scrollX,
          scrollY: this.event.scrollY,
          isMultiAxis,
        });
        return;
      }
  
      if (!this.event.isTargetDocument) {
        this.modifyOrDeleteScrollIfNeeded();
      }
  
      const isMultiAxis =
        this.event.scrollX !== this.event.windowScrollX &&
        this.event.scrollY !== this.event.windowScrollY;
      const scrollInside = this.event.isTargetDocument
        ? STEP_SCROLL_TARGET_TYPE.WINDOW
        : STEP_SCROLL_TARGET_TYPE.ELEMENT;
      const scrollTo = STEP_SCROLL_TO_TYPE.COORDS;
  
      this.createStep(this.event, { scrollInside, scrollTo, isMultiAxis });
    };
  
    processFileUpload = () => {
      if (this.hasLastStepType(STEP_TYPE.CLICK) && !this.hasPropChanged('targetId')) {
        this.deleteLastStep();
      }
  
      if (!this.event.value) {
        return;
      }
  
      const modifiers = {
        type: STEP_TYPE.UPLOAD_FILE,
        value: this.event.value.name,
      };
      const file = this.event.value;
      const step = this.createStep(this.event, modifiers);
      this.createArtifact(step.frontId, file);
    };
  
    processSelect = () => {
      if (
        (this.hasLastStepType(STEP_TYPE.CLICK) || this.hasLastStepType(STEP_TYPE.SELECT)) &&
        !this.hasPropChanged('targetId')
      ) {
        this.deleteLastStep();
      }
  
      this.modifyOrDeleteScrollIfNeeded();
      const modifiers = {
        type: STEP_TYPE.SELECT,
        selectType: SELECT_TYPE.TEXT,
        selectIsMultiple: this.event.value.includes('\n'),
      };
      this.createStep(this.event, modifiers);
    };
  
    processRangeChange = () => {
      if (this.hasLastStepType(STEP_TYPE.CLICK) && !this.hasPropChanged('targetId')) {
        this.deleteLastStep();
      }
  
      /*
        It is not merged with if-statement above bacause change event is emmited after mouse up (click)
        and we still want to avoid recording (one by one) change events on the same element.
      */
      if (this.hasLastStepType(STEP_TYPE.CHANGE) && !this.hasPropChanged('targetId')) {
        this.deleteLastStep();
      }
  
      this.modifyOrDeleteScrollIfNeeded();
      this.createStep(this.event);
    };
  
    processInputNumberChange = () => {
      if (this.hasLastStepType(STEP_TYPE.CLICK) && !this.hasPropChanged('targetId')) {
        this.deleteLastStep();
      }
  
      if (this.hasLastStepType(STEP_TYPE.CHANGE) && !this.hasPropChanged('targetId')) {
        this.deleteLastStep();
      }
  
      this.modifyOrDeleteScrollIfNeeded();
      this.createStep(this.event);
    };
  
    processCustomChange = () => {
      if (this.hasLastStepType(STEP_TYPE.TYPE) && !this.hasPropChanged('targetId')) {
        this.deleteLastStep();
      }
  
      if (this.hasLastStepType(STEP_TYPE.CHANGE) && !this.hasPropChanged('targetId')) {
        this.deleteLastStep();
      }
  
      this.modifyOrDeleteScrollIfNeeded();
      this.createStep(this.event);
    };
  
    processChange = () => {
      if (this.event.tagName === HTMLTags.SELECT) {
        this.processSelect();
        return;
      }
      if (this.event.fromFileUpload) {
        this.processFileUpload();
        return;
      }
  
      if (this.event?.tagAttributes?.type === HTMLInputTypes.RANGE) {
        this.processRangeChange();
        return;
      }
  
      if (this.event?.tagAttributes?.type === HTMLInputTypes.NUMBER) {
        this.processInputNumberChange();
        return;
      }
  
      if (this.event.isCustomChangeEvent) {
        this.processCustomChange();
        return;
      }
  
      if (this.event.fromAutosuggestion) {
        this.createStep(this.event);
      }
    };
  
    processPageNavigation = () => {
      const ignoredStepTypes = [
        STEP_TYPE.GOTO,
        STEP_TYPE.NEW_TAB,
        STEP_TYPE.CLOSE_TAB,
        STEP_TYPE.SWITCH_CONTEXT,
      ];
  
      if (!this.lastStep || ignoredStepTypes.includes(this.lastStep.type)) {
        return;
      }
  
      const hasSameTabNo = is(Number, this.lastStep.tabNo) && !this.hasPropChanged('tabNo');
      const hasPageNavigationCondition = !!this.lastStep.waitingConditions.find(
        propEq('type', WAITING_CONDITION_TYPE.PAGE_NAVIGATION_AFTER_EXECUTION),
      );
  
      if (hasSameTabNo && !hasPageNavigationCondition) {
        const waitingConditions = [
          ...this.lastStep.waitingConditions,
          {
            type: WAITING_CONDITION_TYPE.PAGE_NAVIGATION_AFTER_EXECUTION,
            isActive: true,
          },
        ];
        this.modifyStep(this.lastStep.frontId, { waitingConditions });
      }
    };
  
    processNewTab = () => {
      this.updateContext({
        tabNo: this.context.tabNo + 1,
        frameLocation: MAIN_FRAME_LOCATION,
      });
      this.createStep(this.event);
    };
  
    processCloseTab = () => {
      this.updateContext({
        tabNo: this.context.tabNo - 1,
        frameLocation: MAIN_FRAME_LOCATION,
      });
      this.createStep(this.event);
    };
  
    processAssert = () => {
      this.modifyOrDeleteScrollIfNeeded();
      this.createStep(this.event);
    };
  
    processHover = () => {
      this.modifyOrDeleteScrollIfNeeded();
      this.createStep(this.event);
    };
  
    processSwitchContext = () => {
      if (this.hasContextChanged()) {
        this.createSwitchContextStep();
      }
    };
  
    processSetLocalVariable = () => {
      this.createStep(this.event);
    };
  
    processInsertLocalVariable = () => {
      this.processPaste();
    };
  
    processAnswerPrompt = () => {
      this.createStep(this.event, {
        value: `${this.event.value ?? true}`,
      });
    };
  
    processDrop = () => {
      if (this.event?.tagAttributes?.type === HTMLInputTypes.RANGE || this.event.hasLabelTag) {
        return;
      }
  
      const extraProps = {
        type: STEP_TYPE.DRAG_AND_DROP,
        dragOn: DND_TARGET_TYPE.ELEMENT,
        dropOn: DND_TARGET_TYPE.ELEMENT,
        ...pick(
          [
            'dndDragY',
            'dndDragX',
            'dndDropY',
            'dndDropX',
            'dndDropSelectors',
            'dndDropInteractionPosition',
          ],
          this.event,
        ),
      };
      if (this.hasLastStepType(STEP_TYPE.CLICK)) {
        this.modifyStep(this.lastStep.frontId, extraProps);
        return;
      }
      this.createStep(this.event, extraProps);
    };
  }
  
  export default EventsProcessor;
  