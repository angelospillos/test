import overrides from './services/overrides';

overrides.setupLogsCatching();
overrides.setupBrowserData();
overrides.setupNativeDialogBoxesOverrides();
overrides.setupBeforePageLoadOverrides();
overrides.setupAfterPageLoadOverrides();
