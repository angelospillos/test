import alarms from './alarms';
import * as details from './details';
import devTools from './devTools';
import downloads from './downloads/downloads';
import storage from './storage';
import { STORAGE_DATA_TYPE } from './storage/storage.constants';
import * as tabs from './tabs';
import webRequests from './webRequests';
import * as windows from './windows';

export default {
  windows,
  tabs,
  details,
  devTools,
  storage,
  alarms,
  webRequests,
  downloads,
  STORAGE_DATA_TYPE,
};
