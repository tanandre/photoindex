(function() {
	"use strict";

	let sharp = require('sharp');
	let Jimp = require("jimp");
	let Deferred = require('../public/lib/Deferred');
	let fs = require('fs');

	function optimzeImageNone(path, maxSize) {
		let deferred = new Deferred();
		let file = fs.readFileSync(path, 'binary');
		deferred.resolve(new Buffer(file, 'binary'));
		return deferred;
	}

	function optimzeImageSharp(path, maxSize) {
		let deferred = new Deferred();
		sharp(path)
			.resize(maxSize, maxSize)
			.max()
			.rotate()
			.toBuffer()
			.then(data => deferred.resolve(data)).catch((err) => {
			deferred.reject('error resizing: ' + path);
		});
		return deferred;
	}

	function optimizeImageJimp(path, maxSize) {
		let deferred = new Deferred();
		Jimp.read(path, (err, img) => {
			if (err) {
				deferred.reject(err);
				return;
			}
			img.contain(maxSize, maxSize)            // resize
				.quality(60)                 // set JPEG quality
				.exifRotate()
				.getBuffer(img._originalMime, (err, buffer) => {
					if (err) {
						deferred.reject(err);
						return;
					}
					deferred.resolve(buffer);
				});
		});

		return deferred;
	}

	module.exports.optimizeImage = optimzeImageSharp;
}());
