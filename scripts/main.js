require([
  '$api/models',
  'scripts/filter-explicit',
  'scripts/playlist-maker',
  'scripts/auto_i18n',
  //@todo: this needs to be rebuilt to be more modular.
  //'scripts/dirtylist'
], function(models, filterExplicit, playlistMaker,i18n,dirtyList) {
  'use strict';

  i18n.init();
  filterExplicit.init();
  playlistMaker.init();
  dirtyList.init();
});