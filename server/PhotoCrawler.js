(function() {
	let fs = require('fs');
	let path = require('path');

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
						fnc(file);
						if (!--pending) {
							done(null, results);
						}
					}
				});
			});
		});
	};

	module.exports.indexPhotosInFolder = function(folderToIndex, fnc) {
		crawl(folderToIndex, (err, results) => {
			console.log('*** done crawling photos: starting to index exif data ***', results.length);
		}, fnc)
	};

}());
