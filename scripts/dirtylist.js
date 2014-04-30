require([
  '$api/models',
  'scripts/util'
], function(models, util) {
  'use strict';

  var dirtyList = null;

  var init = function() {
    var dirtyListUri;
    dirtyListUri = localStorage['dirtylist'];
    if (typeof dirtyListUri == 'undefined') {
      console.log('creating the dirty list');
      models.Playlist.create("Bleep-Dirty-List")
        .done(function(newPlaylist) {
          dirtyList = newPlaylist;
          localStorage['dirtylist'] = dirtyList.uri;
        });
    } else {
      models.Playlist.fromURI(dirtyListUri).load()
        .done(function(playlist) {
          dirtyList = playlist;
        });
    }
  };

  var getDirtyListFilter = function() {

    dirtyList.tracks.snapshot().done(function(tracks) {
      var lookup = util.getUriLookupForTrackCollection(tracks);
      return function (lookup) {
        return function(track) {
          // This filter checks if it exists
          if (lookup.indexOf(track.uri) == -1) {
            return true;
          }
          return false;
        };
      }();
      

    });
  };

  exports.init = init;
  exports.dirtyList = dirtyList;
  exports.getDirtyListFilter = getDirtyListFilter; 
});