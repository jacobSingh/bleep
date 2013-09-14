require([
  '$api/models',
  'scripts/filter-explicit',
  'scripts/playlist-maker',
  'scripts/auto_i18n',
], function(models, filterExplicit, playlistMaker,i18n) {
  'use strict';

  i18n.init();
  filterExplicit.init();
  playlistMaker.init();
});