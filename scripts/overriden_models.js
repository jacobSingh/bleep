require([
  '$api/models',
], function(models) {
  'use strict';

	models.Playlist.prototype.getName = function() {
	// Returns static names... unlike normal spotify function.
		if (this.uri.indexOf("starred") != -1) {
		  return "Starred";
		}
		  return this.name;
	};

  exports.models = models;
});