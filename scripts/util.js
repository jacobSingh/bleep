require([
  'scripts/underscore'
], function(underscore) {
  'use strict';

  exports.getUriLookupForTrackCollection = function(tracks) {
    var lookup = [];
    var i;
    tracks = tracks.toArray();
    for (i = 0; i < tracks.length; i++) {
      lookup.push(tracks[i].uri);
    }
    return lookup;
  };

});