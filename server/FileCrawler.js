"use strict";

let Deferred = require('../public/lib/Deferred');
let recursive = require("recursive-readdir");
let log = require('../public/lib/log');

module.exports.findFiles = function (folder) {
	let deferred = new Deferred();
	recursive(folder, ['@eaDir', 'Thumbs.db'], function (err, files) {
		if (err) {
			deferred.reject(err)
			return
		}

		if (files === undefined) {
			log('no files found for folder: ' + folder);
			deferred.resolve([])
			return
		}

		log('indexed files for folder: ' + folder + ' files:' + files.length);
		deferred.resolve(files)
	});
	return deferred;
};
