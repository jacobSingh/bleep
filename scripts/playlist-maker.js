require([
  'scripts/underscore',
  'scripts/jquery',
  'scripts/overriden_models',
  'scripts/playlist-sync',
  '$views/buttons#Button',
  '$views/popup',
  '$views/utils/css',
  '/strings/main.lang'
], function(underscore, jQuery, overrides, sync, Button, popup, css, mainStrings) {
  'use strict';
  
  var _ = underscore._;
  var t = SP.bind(mainStrings.get, mainStrings);

  // Custom model class to fix getName() bug in playlists.  
  // @see overriden_models.js
  var models = overrides.models;
  
  
  // Main controller function.
  var init = function() {

    // Configures the Dropzone in the app.
    setupDropzone();

    // Loads data from localStorage and builds interface
    start();

    // Sets up the drop handler for the app icon in the sidebar.
    models.application.addEventListener('dropped', function() {
      var dropped = models.application.dropped; // it contains the dropped elements
      dropped.forEach(function(obj) {
        if (obj.uri) {
          addPlaylist(obj.uri);
        }
      });
    });
  };

  var start = function() {

    // Map of playlists in the format {sourceURI:clonedListUri}
    var playlistMap = PlaylistDAO.get();

    // Just the source playlists
    var srcPlaylists = _.keys(playlistMap);

    // Get all the source playlists and load their names and tracks.
    var playlists = models.Playlist.fromURIs(srcPlaylists);
    var promises = [];
    for (var i in playlists) {
      promises.push(playlists[i].load('name', 'tracks'));
    }

    // When they are all loaded, build the interface
    models.Promise.join(promises).done(function(playlists) {
      buildPlaylistInterface(playlists);
      // Start watching for changes in the current playlists (which will trigger a resync)
      watchForChanges(playlists);
      EventMeister.on('playlistAdded', function(playlist) {
        watchForChanges([playlist]);
      });
    });

    // Kickoff a sync
    syncKidFriendlyLists(playlistMap);
  };


  var EventMeister = {

    // handles custom events for this app such as:
    /**
      'modifyTracks',
      'addSyncedPlaylist',
      'playlistSynced',
      'playlistDeleted'
    **/
    listeners: {},
    on: function (event, callback) {
      this.listeners[event] = this.listeners[event] || [];
      this.listeners[event].push(callback);
    },

    emit: function(event, args) {
      if (this.listeners.hasOwnProperty(event)) {
        this.listeners[event].forEach(function(v) {
          v.apply(EventMeister, args);
        });
      }
    }
  }

  // Not used currently, but useful function to delete playlists
  // @todo: potentially remove copy playlists when original is removed from
  // the app.
  function deletePlaylists(toRemove) {
    console.log(toRemove);
    _.each(toRemove, function(pl) {
      l.playlists.snapshot(0,100).done(function(s) {
        l.playlists.remove(s.find(pl));
      })
      .fail(function(track, error) { console.log(error.message); });
    });
  }

  var watchForChanges = function(playlists) {
    //@todo: removeEventListener doesn't actually work :(
    // So if someone adds 5 playlists, it will run sync for them everytime
    // Until they restart spotify.

    var fx = function(e) {
      var playlists = {};
      playlists[this.uri] = PlaylistDAO.get()[this.uri];
      syncKidFriendlyLists(playlists);
    };

    playlists.forEach(function(playlist) {
      playlist.removeEventListener('change', fx);
      playlist.addEventListener('change', fx);
      console.log(playlist);
    });
  };

  // Sync handling function
  var syncKidFriendlyLists = function(playlistUris, cb) {
    var options;
    var explicitFilter = function(track) {return track.explicit !== true;};

    if (typeof cb != "function") {
      cb = function(result) {
        EventMeister.emit('playlistSynced', [result.src, result.dst, result.count]);
        console.log('synced ' + result.count + " tracks from " + result.src.getName() + " to " + result.dst.getName());
      };
    }

    // Callback from sync.createCopy
    // Renames the new playlist, saves the association in the database
    // It then fires off a sync between the original and the new playlist
    var createFinished = function(original, newPlaylist) {
      newPlaylist.setName(newPlaylist.name.replace("Copy of", "---"));
      PlaylistDAO.update(original.uri, newPlaylist.uri);
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

    var syncOptions = {
      'success': cb,
      'filters': [explicitFilter],
      'delete': true
    };

    var fx;
    for (var uri in playlistUris) {
      if (!playlistUris.hasOwnProperty(uri)) {
        continue;
      }
      fx = syncHandler(playlistUris[uri]);
      models.Playlist.fromURI(uri).load('name', 'tracks').done(fx);
    }
  };

  var PlaylistDAO = {};

  PlaylistDAO.get = function() {
    if (localStorage['playlists']) {
      return JSON.parse(localStorage['playlists']);
    }
    return {};
  };

  PlaylistDAO.update = function(srcUri, dstUri) {
    var playlists = this.get();
    playlists[srcUri] = dstUri;
    this.set(playlists);
    return true;
  };

  PlaylistDAO.add = function (srcUri) {
    var playlists = this.get();
    if (playlists.hasOwnProperty(srcUri)) {
      throw {"code": "PLAYLIST_EXISTS"};
    }

    playlists[srcUri] = null;
    this.set(playlists);
    return true;
  };

  PlaylistDAO.set = function(uris) {
    localStorage.playlists = JSON.stringify(uris);
  };

  PlaylistDAO.remove = function(srcUri) {
    var playlists = this.get();
    delete playlists[srcUri];
    this.set(playlists);
  };

  // Adds a new playlist to local storage
  // kicks off a sync for the new playlist
  function addPlaylist(uri) {
    try {
      PlaylistDAO.add(uri);
    } catch(err) {
      if (err.code == "PLAYLIST_EXISTS") {
        showFeedback(t('already_added'));
        return;
      } else {
        throw err;
      }
    }

    var newPlaylists = {};
    newPlaylists[uri] = null;
    syncKidFriendlyLists(newPlaylists);
    
    models.Playlist.fromURI(uri).load('name').done(function(playlist) {
      EventMeister.emit('playlistAdded', [playlist]);
    });
  }

  // Removes the synced playlist from localStorage
  // CURRENTLY DOES NOT REMOVE THE SYNCED PLAYLIST.
  var removePlaylist = function(uri) {
    PlaylistDAO.remove(uri);
    EventMeister.emit('playlistRemoved', [uri]);
  };

  // Configure the Drop zone 
  var setupDropzone = function() {
    var container = document.querySelectorAll('.dropzone')[0];
    var DragAndDropHandler = {};

    DragAndDropHandler.drop = function(e) {
      if (e.stopPropagation) {
        e.stopPropagation(); // stops the browser from redirecting.
      }

      e.preventDefault();
      addPlaylist(e.dataTransfer.getData('text'));
      css.removeClass(this, 'over');
      return false;
    };

    DragAndDropHandler.dragend = function(e) {
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

    container.addEventListener('drop', DragAndDropHandler.drop, false);
    container.addEventListener('dragend', DragAndDropHandler.dragend, false);
    container.addEventListener('dragover', DragAndDropHandler.dragover, false);
    container.addEventListener('dragleave', DragAndDropHandler.dragleave, false);
  };

  // Main UI function
  // Builds the table, sets up event handlers to update it.
  var buildPlaylistInterface = function(playlists) {
    if (playlists.length === 0) {
      return;
    }
    var playlistUris = PlaylistDAO.get();

    // Empty out the playlist container
    $('.syncedPlaylists').empty();

    // Creates the table structure
    PlaylistTable.init($('.syncedPlaylists'));

    var updateSyncStatus = function(srcPlaylist, dstPlaylist, changed) {
      PlaylistTable.updateStatusText(srcPlaylist.uri, 'synced');
    };

    // configure events to update the UI
    EventMeister.on('playlistSynced', updateSyncStatus);
    EventMeister.on('playlistAdded', function(playlist) {
      PlaylistTable.addRow(playlist.uri, playlist.getName(), 'syncing');
    });
    EventMeister.on('playlistRemoved', function(uri) {
      PlaylistTable.removeRow(uri);
    });

    var playlist;
    for (var i=0; i < playlists.length; i++) {
      playlist = playlists[i];
      PlaylistTable.addRow(playlist.uri, playlist.getName(), 'syncing');
    }
  };

  // Simple object that contains the table building / modifying functions.
  var PlaylistTable = {
    elem: null,

    updateStatus: function(uri, status) {
      $('tr#uri-' + uri + ' td.statusCol', this.elem).html(this.getStatusText(status));
    },

    init: function(parentElement) {
      this.elem = $('<table class="playlists"></table>');
      this.elem.append($('<thead></thead>'));
      this.elem.append($('<tbody></tbody>'));
      this.addHeaders([t('playlist'), t('status'), '']);
      parentElement.append(this.elem);
    },

    addHeaders: function(headers) {
      var self = this;
      _.each(headers, function(v) {
        $('thead', self.elem).append('<th>' + v +'</th>');
      });
    },

    addRow: function(uri, name, status) {
      var $tr = $('<tr></tr>');
      $tr.attr('id', 'uri-' + encodeURIComponent(uri));
      $tr.data('uri', uri);

      $tr.addClass(($('tr', this.elem).length % 2) === 0 ? "even" : "odd");
      $tr.append('<td>' + name +'</td>');
      $tr.append($('<td class="statusCol"></td>').append(this.getStatusText(status)));

      var fx = function(uri) {
        return function() {
          removePlaylist(uri);
        };
      }(uri);
      var deleteButton = Button.withLabel(t('remove'));
      deleteButton.addEventListener('click', fx);
      $tr.append($('<td class="action"></td>').append(deleteButton.node));
      this.elem.append($tr);
    },

    removeRow: function(uri) {
      this.getRow(uri).remove();
    },

    updateStatusText: function(uri, status) {
      $('.statusCol', this.getRow(uri)).html(this.getStatusText(status));
    },

    getRow: function(uri) {
      return $('tr[id="uri-' + encodeURIComponent(uri) + '"]', this.elem);
    },

    getStatusText: function(status) {
      var $statusTxt;
      if (status == "synced") {
        $statusTxt = '<span class="status-done">' + t('synced') + '</span>';
      } else if(status == "syncing") {
        $statusTxt = '<span class="status-inprogress">' + t('syncing') + '</span>';
      }
      return $statusTxt;
    }
  };

  // Utility class to show a popup.
  var showFeedback = function(content) {
    var p = document.createElement('p');
    css.addClass(p, "popup");
    p.textContent = content;
    var info = popup.Popup.withContent(p, 200, 90);
    info.showFor(document.getElementById('syncedPlaylistsContainer'));
    return;
  };


  exports.init = init;
});