let fs = require('fs');
let path = require('path');
let getExif = require('exif-async');
let express = require("express");
let cache = require('memory-cache');
// let sharp = require('sharp');
let util = require('./public/lib/util');
let Deferred = require('./public/lib/Deferred');
let log = require('./public/lib/log');
let dbIO = require('./server/DatabaseIO');

let isCacheEnabled = true;
let cacheDir = "c:\\temp\\photoindex\\cache\\";
log('Starting');

let app = express();

function createHttpDeferred(response) {
	let httpDeferred = new Deferred();
	httpDeferred.then(function(data) {
		response.end(data);
	}, function(err) {
		console.error(err);
		response.status(500);
		response.end(err);
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
	deferred.then((data) => {
		cache.put(cacheId, data);
	});
	fnc(deferred);
}

dbIO.initialize((err, connection) => {
	if (err) {
		console.error(err);
		return;
	}
});

let server = app.listen(1337, () => {
	log('photoindex listening on port 1337!')
});

app.use(express.static('public'));
app.use('/node_modules', express.static('node_modules'));

function setCacheHeaders(response) {
	if (isCacheEnabled) {
		response.setHeader("Cache-Control", "public, max-age=31536000");
		response.setHeader("Expires", new Date(Date.now() + 31536000000).toUTCString());
	}
}

function optimizedImage(path, maxSize) {
	let deferred = new Deferred();
	// sharp(path)
	// 	.resize(maxSize, maxSize)
	// 	.max()
	// 	.rotate()
	// 	.toBuffer()
	// 	.then(data => deferred.resolve(data)).catch((err) => {
	// 	deferred.reject('error resizing: ' + path);
	// });
	let file = fs.readFileSync(path, 'binary');
	console.log('read optimized image');
	deferred.resolve(new Buffer(file, 'binary'));
	return deferred;
}

app.use('/photo/:id/:width', function(request, response) {
	response.setHeader('Content-Type', 'image/jpeg');
	setCacheHeaders(response);
	let deferred = createHttpDeferred(response);

	let subDir = Math.floor(parseInt(request.params.id) / 1000);
	let cacheSubDir = cacheDir + subDir;
	let cachedFile = cacheSubDir + '\\cache-' + request.params.id + '_' + request.params.width + '.jpg';

	if (fs.existsSync(cachedFile)) {
		let file = fs.readFileSync(cachedFile, 'binary');
		response.end(new Buffer(file, 'binary'));
		return;
	}

	dbIO.readPhotoById(request.params.id).then(function(row) {
		// TODO if original photo is smaller than requested param don't resize
		// TODO store exif dimensions in db to optimize calculation?
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
				if (!fs.existsSync(cacheSubDir)) {
					fs.mkdirSync(cacheSubDir);
				}
				fs.writeFile(cachedFile, data, 'binary');

			}, err => deferred.reject(err));
	}, (err) => {
		deferred.reject(JSON.stringify(err));
	});
});

app.use('/photo/:id', function(request, response) {
	response.setHeader('Content-Type', 'image/jpeg');
	setCacheHeaders(response);

	let deferred = createHttpDeferred(response);
	dbIO.readPhotoById(request.params.id).then((row) => {
		let file = fs.readFileSync(row.path, 'binary');
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
	response.setHeader('Content-Type', 'application/json');
	let cacheUrl = '/listing?' + JSON.stringify(request.query);
	wrapCache(cache, cacheUrl, createHttpDeferred(response), (deferred) => {
		dbIO.queryPhotos(request.query.tag).then((rows) => {
			rows.forEach((row) => {
				row.dateInMillis = Date.parse(row.date);
				row.dateObject = new Date(row.dateInMillis);
			});
			deferred.resolve(JSON.stringify(rows));
		}, (err) => {
			deferred.reject(JSON.stringify({
				images: [],
				error: err
			}));
		});
	});

});
