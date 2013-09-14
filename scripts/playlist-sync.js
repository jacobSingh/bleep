require([
  'scripts/underscore',
  'scripts/overriden_models',
], function(underscore, overrides) {
  'use strict';

  var models = overrides.models;

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
    models.Playlist.create(getPlaylistName(playlist.getName()))
      .done(function(newPlaylist) {
        cb(playlist, newPlaylist);
      });
  };

  var fullSync = function(playlistSrc, playlistDst, filters, cb) {
    playlistDst.tracks.snapshot().done(function(dstTracks) {
      lookup = getUriLookupForTrackCollection(dstTracks);

      var getExistingFilter = function (lookup) {
        return function(track) {
          // This filter checks if it exists
          if (lookup.indexOf(track.uri) == -1) {
            return true;
          }
          return false;
        };
      };
      filters.push(getExistingFilter());
      doSync.apply(this, arguments);
    });
  };

  var cheapSync = function(playlistSrc, playlistDst, filters, cb) {
    playlistDst.tracks.clear();
    doSync.apply(this, arguments);
  };

  var doSync = function(playlistSrc, playlistDst, filters, cb) {
    var j;
    var lookup;
    var tracksToAdd = [];

    playlistSrc.tracks.snapshot().done(function(snapshot) {
      var tracks = snapshot.toArray();
      tracks.reverse();

      var next = _.after(tracks.length, cb);
      tracks.forEach(function(track) {
        for (var j = 0; j < filters.length; j++) {
          if (filters[j](track) === false) {
            return next(tracksToAdd);
          }
        }
        tracksToAdd.push(track);
        next(tracksToAdd);
        });
    });
  };

  var sync = function(playlistSrc, playlistDst, options) {
    var track;
    var filters = options.hasOwnProperty('filters') ? options.filters : [];
    
    if (typeof options['success'] != 'function') {
      throw "You must provide a callback function (options[success])";
    }

    models.Promise.join(playlistSrc.load(['name', 'tracks']), playlistDst.load(['name', 'tracks']))
      .done(function() {
        var finished = function(tracksToAdd) {
          if (tracksToAdd.length <= 0) {
            options.success({'src': playlistSrc, 'dst': playlistDst, 'count': tracksToAdd.length});
            return;
          }
          playlistDst.tracks.add(tracksToAdd).done(function() {
            options.success({'src': playlistSrc, 'dst': playlistDst, 'count': tracksToAdd.length});
          });
        };

        if (options['delete'] === true) {
          // Wipe out the original and just rebuild it.
          cheapSync(playlistSrc, playlistDst, filters, finished);
        } else {
          fullSync(playlistSrc, playlistDst, filters, finished);
        }
      });
  };

  exports.sync = sync;
  exports.createCopy = createCopy;
});