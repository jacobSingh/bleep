require([
  'scripts/jquery',
  '$api/models',
  '$views/buttons#Button'
], function(jQuery, models, Button) {
  'use strict';

  var init = function() {
    console.log('making dirty list');
  };

  exports.init = init;
});