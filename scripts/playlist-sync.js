require([
  'scripts/underscore',
  '$api/models',
  '$api/library#Library',
], function(underscore, models, Library) {
  'use strict';

  var _ = underscore._;
  var getPlaylistName = function(name) {
    return "Copy of " + name;
  };

  var getUriLookupForTrackCollection = function(tracks) {
    var lookup = [];
    var i;
    tracks = tracks.toArray();
    console.log(tracks);
    for (i = 0; i < tracks.length; i++) {
      lookup.push(tracks[i].uri);
    }
    return lookup;
  };

  var createCopy = function(playlist, cb) {
    console.log(playlist.name, "Copying");
    models.Playlist.create(getPlaylistName(playlist.name))
      .done(function(newPlaylist) {
        cb(newPlaylist, playlist);
      });
  };

  var sync = function(playlistSrc, playlistDst, options) {
    console.log(playlistSrc.name, "syncing");
    
    if (typeof options['success'] != 'function') {
      throw "You must provide a callback function (options[success])";
    }

    models.Promise.join(playlistSrc.load(['name', 'tracks']), playlistDst.load(['name', 'tracks']))
      .done(function() {
        var lookup;
        var i, j;
        var tracksToAdd = [];
        var track;
        var skip = false;
        var limit = 100;
        var filters = options.hasOwnProperty('filters') ? options.filters : [];

        playlistDst.tracks.snapshot().done(function(dstTracks) {
          lookup = getUriLookupForTrackCollection(dstTracks);

          playlistSrc.tracks.snapshot().done(function(snapshot) {
            var tracks = snapshot.toArray();

            var finished = function(tracksToAdd) {
              if (tracksToAdd.length <= 0) {
                options.success({'src': playlistSrc, 'dst': playlistDst, 'count': tracksToAdd.length});
                return;
              }
              playlistDst.tracks.add(tracksToAdd).done(function() {
                options.success({'src': playlistSrc, 'dst': playlistDst, 'count': tracksToAdd.length});
              });
            };

            var next = _.after(tracks.length, finished);
            tracks.forEach(function(track) {
              var j;
              console.log(lookup.indexOf(track.uri));
              if (lookup.indexOf(track.uri) != -1) {
                // This is totally kludgy...
                // Should have a better way of passing along
                // the array of tracks to add and using _.after
                return next(tracksToAdd);
              }

              console.log(filters);

              for (j = 0; j<filters.length; j++) {
                if (filters[j](track) === false) {
                  return next(tracksToAdd);
                }
              }

              console.log(track);
              tracksToAdd.push(track);
              next(tracksToAdd);
              });
          });
        });
      });
  };

  exports.sync = sync;
  exports.createCopy = createCopy;
});