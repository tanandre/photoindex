"use strict";

let Deferred = require('../public/lib/Deferred');
let recursive = require("recursive-readdir");
let log = require('../public/lib/log');

module.exports.findFiles = function (folder) {
	let deferred = new Deferred();
	recursive(folder, function (err, files) {
		if (files === undefined) {
			log('no files found for folder: ' + folder);
		} else {
			log('indexed files: ' + files.length);
		}
		if (err) {
			deferred.reject(err)
			return
		}
		deferred.resolve(files)
	});
	return deferred;
};
