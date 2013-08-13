require([
  'scripts/jquery',
  '$api/models',
  '$views/buttons#Button'
], function(jQuery, models, Button) {
  'use strict';

  var getState = function() {
    if (localStorage['state'] != 'true') {
      return false;
    }
    return true;
  };

  var init = function() {
    var state = getState();
    $("input[name='state']").change(function() {
      state = $("input[name='state']:checked").val() == "true";
      localStorage['state'] = state;
    });
    $("input[name='state']").filter('[value=' + state + ']').prop('checked', true);

    models.player.addEventListener('change', filterForExplicit);
  };

  var filterForExplicit = function(e) {
    if (getState() === false) {
      return;
    }
    var track = models.player.track;
    if (track.explicit === true) {
      models.player.skipToNextTrack();
    }
  };

  exports.init = init;
});