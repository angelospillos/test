import { KEYS } from '~/utils/keyboardLayout';

export const DEFAULT_CONTEXT = { tabNo: undefined, frameLocation: 'main' };

export const KEYDOWN_EXCLUDED_KEY_CODES = [
  KEYS.F12.keyCode,
  KEYS.Shift.keyCode,
  KEYS.AltRight.keyCode,
  KEYS.AltLeft.keyCode,
  KEYS.Alt.keyCode,
  KEYS.AltGraph.keyCode,
  KEYS.Control.keyCode,
  KEYS.Meta.keyCode,
  KEYS.MetaRight.keyCode,
  KEYS.CapsLock.keyCode,
  KEYS.Pause.keyCode,
  KEYS.Play.keyCode,
  KEYS.Clear.keyCode,
  KEYS.Cancel.keyCode,
  KEYS.ScrollLock.keyCode,
  KEYS.NumLock.keyCode,
  KEYS.Print.keyCode,
  KEYS.PrintScreen.keyCode,
  KEYS.Insert.keyCode,
  KEYS.AudioVolumeMute.keyCode,
  KEYS.AudioVolumeDown.keyCode,
  KEYS.AudioVolumeUp.keyCode,
  KEYS.MediaTrackNext.keyCode,
  KEYS.MediaTrackPrevious.keyCode,
  KEYS.MediaStop.keyCode,
  KEYS.MediaPlayPause.keyCode,
];

export const BATCH_UPDATES_INTERVAL = 200;
