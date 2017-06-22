"use strict";

(function() {
	let fs = require('fs');
	let path = require('path');
	let Deferred = require('../public/lib/Deferred');
	let log = require('../public/lib/log');

	let crawl = function(dir, done, fnc) {
		let results = [];
		fs.readdir(dir, function(err, list) {
			if (err) {
				return done(err);
			}
			let pending = list.length;
			if (!pending) {
				return done(null, results);
			}
			list.forEach(function(file) {
				file = path.resolve(dir, file);
				fs.stat(file, function(err, stat) {
					if (stat && stat.isDirectory()) {
						crawl(file, function(err, res) {
							results = results.concat(res);
							if (!--pending) {
								done(null, results);
							}
						}, fnc);
					} else {
						results.push(file);
						fnc(file, stat);
						if (!--pending) {
							done(null, results);
						}
					}
				});
			});
		});
	};

	let walk = function(dir, done) {
		let results = [];
		fs.readdir(dir, function(err, list) {
			if (err) {
				return done(err);
			}
			let i = 0;
			(function next() {
				process.stdout.write(".");
				let file = list[i++];
				if (!file) {
					return done(null, results);
				}
				file = dir + '/' + file;
				fs.stat(file, function(err, stat) {
					if (stat && stat.isDirectory()) {
						walk(file, function(err, res) {
							results = results.concat(res);
							next();
						});
					} else {
						results.push({
							file: file,
							stats: stat
						});
						next();
					}
				});
			})();
		});
	};

	function walkExp(dir) {
		let deferred = new Deferred();
		fs.readdir(dir, function(err, list) {
			if (err) {
				deferred.reject(err);
				return;
			}
			list.forEach((file) => {

			});
			deferred.resolve(list);
		});
		return deferred;
	}

	module.exports.indexPhotosInFolder = function(folderToIndex, fnc) {
		let deferred = new Deferred();
		log('* traversing folder: ' + folderToIndex);
		walk(folderToIndex, (err, results) => {
			if (err) {
				console.log('*** error traversing folder: ', new Date());
				deferred.reject(err);
				return;
			}
			console.log('done');
			deferred.resolve(results);
		});
		return deferred;
		// crawl(folderToIndex, (err, results) => {
		// 	console.log('*** done crawling photos: starting to index exif data ***', results.length);
		// }, fnc)
	};

}());
