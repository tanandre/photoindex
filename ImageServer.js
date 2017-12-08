"use strict";

global.isOnKanji = require('os').hostname() === 'kanji';
let fs = require('fs');
let os = require('os');
let path = require('path');
let getExif = require('exif-async');
let express = require("express");
let cache = require('memory-cache');
let util = require('./public/lib/util');
let Deferred = require('./public/lib/Deferred');
let Timer = require('./public/lib/Timer');
let log = require('./public/lib/log');
let dbIO = require('./server/DatabaseIO');
let photoOptimizer = require('./server/PhotoOptimizer');

let isCacheEnabled = false;
let isCacheHeadersEnabled = true;
let cacheDir = isOnKanji ? '/tmp/photoindex/' : "c:\\temp\\photoindex\\cache\\";
log('Starting');

let app = express();

function setResponseHeaders(response) {
	response.setHeader("Access-Control-Allow-Origin", "*");
}

function setCacheHeaders(response) {
	if (isCacheHeadersEnabled) {
		response.setHeader("Cache-Control", "public, max-age=31536000");
		response.setHeader("Expires", new Date(Date.now() + 31536000000).toUTCString());
	}
}

function createHttpDeferred(response) {
	let httpDeferred = new Deferred();
	httpDeferred.then(function(data) {
		setCacheHeaders(response);
		setResponseHeaders(response);
		response.end(data);
	}, function(err) {
		console.error(err);
		response.status(500);
		response.end(JSON.stringify(err));
	});
	return httpDeferred;
}

function wrapCache(cache, cacheId, deferred, fnc) {
	let cachedResponse = cache.get(cacheId);
	if (isCacheEnabled && cachedResponse) {
		console.log('** returning cached response', cacheId);
		deferred.resolve(cachedResponse);
		return;
	}
	if (isCacheEnabled) {
		deferred.then((data) => {
			cache.put(cacheId, data);
		});
	}
	fnc(deferred);
}

dbIO.initialize((err, connection) => {
	if (err) {
		console.error(err);
		return;
	}
});

let server = app.listen(1337, () => {
	log('photoindex listening on port 1337!');
});

app.use(express.static('public'));
app.use('/node_modules', express.static('node_modules'));

function optimizedImage(path, maxSize) {
	let timer = new Timer();
	return photoOptimizer.optimizeImage(path, maxSize).then(() => {
		console.log('image optimization: ', timer.stamp());
	});
}

app.use('/photo/:id/:width', function(request, response) {
	response.setHeader('Content-Type', 'image/jpeg');
	let deferred = createHttpDeferred(response);

	dbIO.readPhotoById(request.params.id).then(function(row) {
		// TODO check if modified since if we are reading the file from the cache

		if (request.params.width === undefined) {
			let file = fs.readFileSync(row.path, 'binary');
			response.end(new Buffer(file, 'binary'));
			return;
		}

		let maxSize = parseInt(request.params.width);
		optimizedImage(row.path, maxSize)
			.then(data => {
				deferred.resolve(new Buffer(data, 'binary'));
			}, err => deferred.reject(err));
	}, (err) => {
		deferred.reject(JSON.stringify(err));
	});
});

app.use('/photo/:id', function(request, response) {
	let deferred = createHttpDeferred(response);
	dbIO.readPhotoById(request.params.id).then((row) => {
		let file = fs.readFileSync(row.path, 'binary');
		response.setHeader('Content-Type', 'image/jpeg');

		let index = row.path.lastIndexOf('/');
		response.setHeader('Content-Disposition', 'attachment; filename=' + row.path.substring(index + 1));
		deferred.resolve(new Buffer(file, 'binary'));
	}, (err) => {
		deferred.reject(JSON.stringify(err));
	});
});

app.use('/exif/:id', function(request, response) {
	response.setHeader('Content-Type', 'application/json');
	let cacheUrl = '/exif/' + request.params.id;
	wrapCache(cache, cacheUrl, createHttpDeferred(response), (deferred) => {
		let promise = dbIO.readPhotoById(request.params.id);
		promise.then((row) => {
			getExif(row.path).then((exif) => {
				delete exif.thumbnail;
				delete exif.exif.MakerNote;
				deferred.resolve(JSON.stringify(exif));
			}).catch(() => {
				deferred.resolve('{}');
			});
		}, (err) => {
			deferred.reject(JSON.stringify(err));
		});
	});

});

app.use('/tags/:id', function(request, response) {
	response.setHeader('Content-Type', 'application/json');
	let cacheUrl = '/tags/' + request.params.id;
	wrapCache(cache, cacheUrl, createHttpDeferred(response), (deferred) => {
		dbIO.readTagsForPhoto(request.params.id).then((rows) => {
			let tags = rows.map((row) => row.name);
			deferred.resolve(JSON.stringify({tags: tags}));
		}, (err) => {
			deferred.reject(JSON.stringify({
				error: err,
				tags: []
			}));
		});
	});
});

app.get("/listing", function(request, response) {
	let alltimer = new Timer();
	response.setHeader('Content-Type', 'application/json');
	let cacheUrl = '/listing?' + JSON.stringify(request.query);
	wrapCache(cache, cacheUrl, createHttpDeferred(response), (deferred) => {
		dbIO.queryPhotos(request.query.tag).then((rows) => {
			let timer = new Timer();
			rows.forEach((row) => {
				row.dateInMillis = Date.parse(row.date);
				row.dateObject = new Date(row.dateInMillis);
			});
			console.log('patch date', timer.stamp());
			deferred.resolve(JSON.stringify(rows));
			console.log('all', alltimer.stamp());
		}, (err) => {
			deferred.reject(JSON.stringify({
				images: [],
				error: err
			}));
		});
	});

});
