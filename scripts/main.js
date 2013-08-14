require([
  '$api/models',
  'scripts/filter-explicit',
  'scripts/playlist-maker'
], function(models, filterExplicit, playlistMaker) {
  'use strict';
  
  filterExplicit.init();
  playlistMaker.init();
});