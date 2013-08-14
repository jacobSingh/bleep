require([
  'scripts/underscore',
  'scripts/jquery',
  '$api/models',
  '$api/library#Library',
  'scripts/playlist-sync',
  '$views/buttons#Button',
  '$views/popup',
  '$views/utils/css'
], function(underscore, jQuery, models, Library, sync, Button, popup, css) {
  'use strict';
  
  var playlistsCollection;
  var log;
  var _ = underscore._;

  function deletePlaylists(toRemove) {
    console.log(toRemove);
    _.each(toRemove, function(pl) {
      l.playlists.snapshot(0,100).done(function(s) {
        l.playlists.remove(s.find(pl));
      })
      .fail(function(track, error) { console.log(error.message); });
    });
  }

  var unfuck = function() {
    var toRemove;
    l.playlists.snapshot(0,500).done(function(s) {
      toRemove = [];
      var i;
      for (i=0; i < s.length; i++) {
        var pl = s.get(i);
        if (pl === null) {
          continue;
        }
        if (pl.name == "Copy of f") {
          toRemove.push(pl);
        }
      }
      deletePlaylists(toRemove);
    });
  };

  var init = function() {
    
    var l = Library.forCurrentUser(); 
    var former = console.log;
    log = function(msg){
      $("#mylog").append("<div>" + msg + "</div>");
    };

    window.onerror = function(message, url, linenumber) {
      $("#mylog").append("JavaScript error: " + message + " on line " + 
                linenumber + " for " + url);
    };
    paint();
    setupDropPoint();

    models.application.addEventListener('dropped', function() {
      var dropped = models.application.dropped; // it contains the dropped elements
      dropped.forEach(function(obj) {
        // Just assume it is a playlist for now.
        // should add detection.
        console.log(obj);
        if (obj.uri) {
          addPlaylist(obj.uri);
        }
      });
      paint();
    });
    // setup a service to constantly check
    // How?  I dunno.
  };

  var paint = function() {
    var playlists = [];
    var selectedPlaylists = _.keys(getSelectedPlaylists());
    var i;
    var promises = [];

    playlists = models.Playlist.fromURIs(selectedPlaylists);

    for (i in playlists ) {
      promises.push(playlists[i].load('name', 'tracks'));
    }
    var wait = models.Promise.join(promises); // or join([p1, p2]);
    wait.done(buildPlaylistInterface);

  };

  var playlistSynced = function(result) {

    console.log('synced ' + result.count + " tracks from " + result.src.name + " to " + result.dst.name);
  };

  var syncKidFriendlyLists = function() {
    var playlists = getSelectedPlaylists();
    var options;
    var explicitFilter = function(track) {return track.explicit !== true;};

    var syncOptions = {
      'success': playlistSynced,
      'filters': [explicitFilter]
    };

    var createFinished = function(newPlaylist, original) {
      newPlaylist.name = newPlaylist.name.replace("Copy of", "-KF-");
      playlists[original.uri] = newPlaylist.uri;
      setSelectedPlaylists(playlists);
      sync.sync(original, newPlaylist, syncOptions);
    };

    var syncHandler = function(dstPlaylistUri) {
      return function(playlist) {
        if (dstPlaylistUri === null) {
          sync.createCopy(playlist, createFinished);
        } else {
          models.Playlist.fromURI(dstPlaylistUri).load('name', 'tracks').done(function(dstPlaylist) {
            sync.sync(playlist, dstPlaylist, syncOptions);
          });
        }
      };
    };

    if (playlists.length > 5) {
      return;
    }
    
    console.log(playlists);
    
    var fx;
    for (var uri in playlists) {
      if (!playlists.hasOwnProperty(uri)) {
        continue;
      }
      console.log(uri);
      fx = syncHandler(playlists[uri]);
      models.Playlist.fromURI(uri).load('name', 'tracks').done(fx);
    }
  };

  var getSelectedPlaylists = function() {
    if (localStorage['selectedPlaylists']) {
      return JSON.parse(localStorage['selectedPlaylists']);
    }
    return {};
  };

  var setSelectedPlaylists = function(uris) {
    localStorage.selectedPlaylists = JSON.stringify(uris);
  };

  function addPlaylist(uri) {
    var playlists = getSelectedPlaylists();
    if (playlists.hasOwnProperty(uri)) {
      // Playlist already exists
      // @todo: provide some type of feedback to the user.
      var p = document.createElement('p');
      css.addClass(p, "popup");
      p.textContent = 'This playlist has already been added';
      var info = popup.Popup.withContent(p, 200, 90);
      info.showFor(document.getElementById('syncedPlaylistsContainer'));
      return;
    }
    playlists[uri] = null;
    setSelectedPlaylists(playlists);
    paint();
  }

  var DragAndDropHandler = {};

  DragAndDropHandler.drop = function(e) {
    if (e.stopPropagation) {
      e.stopPropagation(); // stops the browser from redirecting.
    }

    e.preventDefault();
    addPlaylist(e.dataTransfer.getData('text'));
    css.removeClass(this, 'over');
    paint();
    return false;
  };

  DragAndDropHandler.dragend = function(e) {
     // this/e.target is the source node.
    
    return false;
  };

  DragAndDropHandler.dragover = function(e) {
    if (e.preventDefault) e.preventDefault(); // allows us to drop
    css.addClass(this, 'over');
    e.dataTransfer.dropEffect = 'copy';
    return false;
  };

  DragAndDropHandler.dragleave = function(e) {
    if (e.preventDefault) e.preventDefault(); // allows us to drop
    css.removeClass(this, 'over');
    return false;
  };


  var setupDropPoint = function() {
    var container = document.querySelectorAll('.dropzone')[0];
    container.addEventListener('drop', DragAndDropHandler.drop, false);
    container.addEventListener('dragend', DragAndDropHandler.dragend, false);
    container.addEventListener('dragover', DragAndDropHandler.dragover, false);
    container.addEventListener('dragleave', DragAndDropHandler.dragleave, false);

  };

  var buildPlaylistInterface = function(playlists) {
    $('.syncedPlaylists').empty();
    var $table = $('<table></table>');
    var $tr,$cb;
    var playlist;
    var i = 0;
    for (i=0; i < playlists.length; i++) {
      playlist = playlists[i];
      log(playlist);
      $tr = $('<tr></tr>');
      $cb = $('<input name="playlists" type="checkbox" />')
        .val(playlist.uri)
        .prop('id', 'playlist-' + playlist.uri);
      $tr.append($('<td></td>').append($cb));
      $tr.append('<td>' + playlist.name +'</td>');
      $table.append($tr);
    }

    $('.syncedPlaylists').append($table);

    var b2 = Button.withLabel('Sync now');
    $('.syncedPlaylists').append(b2.node);
    b2.addEventListener('click', function() {
      syncKidFriendlyLists();
    });
  };

  exports.init = init;
});