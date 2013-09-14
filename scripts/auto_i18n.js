require([
  'scripts/jquery',
  '/strings/main.lang'
], function(jQuery, mainStrings) {
  'use strict';

  //Setup a short-hand to get translation
  var t = SP.bind(mainStrings.get, mainStrings);

  var init = function() {
    var strings = mainStrings.strings;
    for (var key in strings) {
      $('[data-i18n=' + key + ']').html(t(key));
    }
  };

  exports.init = init;
  
});
