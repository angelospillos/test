import * as artifacts from './artifacts';
import * as auth from './auth';
import instance, { axiosFetch, sendFormData, getVersion } from './common';
import * as extension from './extension';
import * as logs from './logs';
import * as projects from './projects';
import * as recorder from './recorder';
import * as screenshots from './screenshots';
import * as testRuns from './testRuns';
import * as user from './user';

export default {
  instance,
  auth,
  projects,
  recorder,
  extension,
  user,
  logs,
  artifacts,
  testRuns,
  screenshots,
  fetch: axiosFetch,
  sendFormData,
  getVersion,
};
