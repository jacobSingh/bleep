require([
  'scripts/jquery',
  '$api/models',
  '$api/library#Library',
  '$views/buttons#Button',
  '$views/list#List'
], function(jQuery, models, Library, Button, List) {
  'use strict';
  
  var playlistsCollection;

  var init = function() {
    var l = Library.forCurrentUser();
    l.load('playlists').done(function() {
      playlistsCollection = l.playlists;
      playlistsCollection.snapshot().done(buildPlaylistInterface);
    });

    // setup a service to constantly check
    // How?  I dunno.
  };

  var getAllPlaylists = function(cb) {
    playlistsCollection.snapshot().done(function(snapshot) {
      return cb(snapshot.toArray());
    });
  };

  var getPlaylistName = function(name) {
    return '-KF-' + name;
  };

  var getKFPlaylist = function(name, allPlaylists) {
    var i;
    for (i=0; i< allPlaylists.length; i++) {
      if (allPlaylists[i] !== null) {
        if (getPlaylistName(name) == allPlaylists[i].name) {
          return allPlaylists[i];
        }
      }
    }
  };

  var makeKFPlaylist = function(playlist, cb) {
    models.Playlist.create(getPlaylistName(playlist.name)).done(function(kfPlaylist) {
      kfPlaylist.load('name', 'tracks').done(cb);
    });
  };

  var syncKidFriendlyList = function(playlist, kfPlaylist) {
    console.log(playlist);
    console.log(kfPlaylist);
    console.log(playlist.tracks);
    var track; //temp var for track
    var kfTrackLookup = {};
    var i;
    var tracksToAdd;

    kfPlaylist.load('tracks').done(function() {
      kfPlaylist.tracks.snapshot().done(function(kfTracks) {
        for (i=0; i < kfTracks.length; i++) {
          kfTrackLookup[kfTracks.get(i).uri] = kfTracks.get(i);
        }

        playlist.load('tracks').done(function() {
          tracksToAdd = [];
          playlist.tracks.snapshot().done(function(tracks) {
            for (i=0; i < tracks.length; i++) {
              track = tracks.get(i);
              if (!track.explicit) {
                if (!kfTrackLookup.hasOwnProperty(track.uri)) {
                  console.log('Adding', track);
                  tracksToAdd.push(track);
                } else {
                  console.log('Not Adding', track);
                }
                // Look it up in kfPlaylist and add if not there.
              }
            }
            console.log(tracks);
            console.log();
          });
          kfPlaylist.tracks.add(tracksToAdd);
        });
      });
    });
  };

  var syncKidFriendlyLists = function() {
    getAllPlaylists(function(allPlaylists) {
      var i;
      console.log(allPlaylists, "allPlaylists");
      var selectedPlaylists = getSelectedPlaylists();
      console.log(selectedPlaylists, "selectedPlaylists");

      var syncHandler = function(playlist) {
        return function(kfPlaylist) {
          syncKidFriendlyList(playlist, kfPlaylist);
        };
      };

      var playlists = models.Playlist.fromURIs(selectedPlaylists);

      for (i = 0; i < playlists.length; i++) {
          var kfPlaylist = getKFPlaylist(playlists[i].name, allPlaylists);
        if (!kfPlaylist) {
          makeKFPlaylist(playlists[i], syncHandler(playlists[i]));
        } else {
          syncKidFriendlyList(playlists[i], kfPlaylist);
        }
      }
    });
  };

  var getSelectedPlaylists = function() {
    if (localStorage['selectedPlaylists']) {
      return localStorage['selectedPlaylists'].split(':::');
    }
    return [];
  };

  var setSelectedPlaylists = function(uris) {
    localStorage.selectedPlaylists = uris.join(':::');
  };

  var buildPlaylistInterface = function(snapshot) {
    var $table = $('<table></table>');
    var $tr,$cb;
    var i = 0;
    var selectedPlaylists = getSelectedPlaylists();

    for (i=0; i < snapshot.length; i++) {
      var playlist = snapshot.get(i);
      if (playlist === null) {
        continue;
        //why?
      }
      $tr = $('<tr></tr>');
      $cb = $('<input name="playlists" type="checkbox" />')
        .prop('checked', selectedPlaylists.indexOf(playlist.uri) != -1)
        .val(playlist.uri)
        .prop('id', 'playlist-' + playlist.uri);

      $tr.append($('<td></td>').append($cb));

      $tr.append('<td>' + playlist.name +'</td>');
      $table.append($tr);
    }
    $('#playlistContainer').append($table);
    var b = Button.withLabel('Make kid friendly playlists');
    $('#playlistContainer').append(b.node);
    b.addEventListener('click', function() {
      selectedPlaylists = [];
      $('input[name="playlists"]:checked').each(function(elem) {
        selectedPlaylists.push(this.value);
      });
      
      setSelectedPlaylists(selectedPlaylists);
    });

    var b2 = Button.withLabel('sync');
    $('#playlistContainer').append(b2.node);
    b2.addEventListener('click', function() {
      syncKidFriendlyLists();
    });
  };
  exports.init = init;
});