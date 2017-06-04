let fs = require('fs');
let path = require('path');
let getExif = require('exif-async');
let express = require("express");
let cache = require('memory-cache');
let sharp = require('sharp');
let util = require('./public/lib/util');
let Deferred = require('./public/lib/Deferred');
let dbIO = require('./server/DatabaseIO');
let photoCrawler = require('./server/PhotoCrawler');

let isCacheEnabled = true;
let imageDir = "c:\\andre\\afdruk\\";
let tempThumbnailDir = "c:\\andre\\afdruk\\temp\\";
let nfsimageDir = "\\\\kanji\\photo\\2006\\2006-03-11 Eerste date\\";
let nfsimageDir2009 = "\\\\kanji\\photo\\2009\\";
let nfsimageDir2016 = "\\\\kanji\\photo\\2016\\";
let nfsimageDirOldPhone = "\\\\kanji\\photo\\phone\\phonedata";
//let nfsimageDir = "\\\\kanji\\photo\\collage\\";

let app = express();

function isImageFile(file) {
	return file.toLowerCase().indexOf('.jpg') !== -1 || file.toLowerCase().indexOf('.jpeg') !== -1;
}

function isVideoFile(file) {
	return file.toLowerCase().indexOf('.mp4') !== -1 || file.toLowerCase().indexOf('.avi') !== -1;
}

function createHttpDeferred(response) {
	let httpDeferred = new Deferred();
	httpDeferred.then(function(data) {
		response.write(data);
		response.end();
	}, function(err) {
		response.write(err);
		response.end();
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

function readDateFromFile(file, done) {
	fs.stat(file, function(err, stats) {
		if (err) {
			console.error(err);
			return;
		}
		let fileName = path.basename(file);
		let dates = [stats.ctime, stats.mtime];
		if (fileName.match(/(19|20)\d{6}/)) {
			let dateStr = /((?:19|20)\d{6})/.exec(fileName)[1];
			// TODO add time parsing to improve precision of date
			//console.log(dateStr.slice(0, 4) + "-" + dateStr.slice(4, 6) + "-" + dateStr.slice(6), fileName);
			dates.push(new Date(Date.parse(
				dateStr.slice(0, 4) + "-" + dateStr.slice(4, 6) + "-" + dateStr.slice(8))));
		}

		dates.sort();
		done(dates[0]);
	});
}
let dateUnconfirmedTag = 'dateUnconfirmed';
function indexPhotos(dir, max) {
	let count = max;
	dbIO.readAllPhotosPaths(function(err, rows) {
		let paths = rows.map(function(row) {
			return row.path;
		});

		photoCrawler.indexPhotosInFolder(dir, function(file) {
			if (isImageFile(file)) {
				if (paths.indexOf((file)) > -1) {
					// console.log('already indexed: ');
					return true;
				}
				if (count-- === 0) {
					console.log('stopping indexing of files, exceeded max count: ', max, count);
					return false;
				}
				getExif(file).then(function(exif) {
					process.stdout.write(".");
					let deviceTag = exif.image.Model;
					if (exif.exif.CreateDate) {
						dbIO.addPhoto(file, exif.exif.CreateDate).then(function(photoId) {
							dbIO.addOrGetTag(deviceTag).then(function(tagId) {
								dbIO.addPhotoTag(photoId, tagId);
							});
						});
					} else {
						console.error(
							'exif header present but no CreateDate attribute, reading date from file',
							file);
						readDateFromFile(file, function(date) {
							dbIO.addPhoto(file, date).then(function(photoId) {
								console.log('----- adding 2 tags for photo ', file, photoId);
								dbIO.addOrGetTag(deviceTag).then(function(tagId) {
									dbIO.addPhotoTag(photoId, tagId);
								});
								dbIO.addOrGetTag(dateUnconfirmedTag).then(function(tagId) {
									dbIO.addPhotoTag(photoId, tagId);
								});
							});
						});
					}

				}, function(err) {
					console.error('no exif header found reading date from file', file);
					readDateFromFile(file, function(date) {
						dbIO.addPhoto(file, date).then(function(photoId) {
							dbIO.addOrGetTag(dateUnconfirmedTag).then(function(tagId) {
								dbIO.addPhotoTag(photoId, tagId);
							});
						});
					});
				});
			}
			return true;
		});
	});
}

dbIO.initialize(function(err, connection) {
	if (err) {
		console.error(err);
		return;
	}

	indexPhotos(imageDir, 100);
});

let server = app.listen(1337, function() {
	console.log('photoindex listening on port 1337!')
});

app.use(express.static('public'));
app.use('/node_modules', express.static('node_modules'));

function setCacheHeaders(response) {
	if (isCacheEnabled) {
		response.setHeader("Cache-Control", "public, max-age=31536000");
		response.setHeader("Expires", new Date(Date.now() + 31536000000).toUTCString());
	}
}

app.use('/photo/:id/:width', function(request, response) {
	response.setHeader('Content-Type', 'image/jpeg');
	setCacheHeaders(response);

	dbIO.readPhotoById(request.params.id).then(function(row) {
		// TODO if original photo is smaller than requested param don't resize
		// TODO store exif dimensions in db to optimize calculation?
		// TODO check if modified since if we are reading the file from the cache

		if (request.params.width === undefined) {
			let file = fs.readFileSync(row.path, 'binary');
			response.write(file, 'binary');
			response.end();
			return;
		}

		sharp(row.path)
			.resize(parseInt(request.params.width))
			.toBuffer()
			.then(function(data) {
				response.write(data, 'binary');
				response.end();
			}).catch(function(err) {
			console.log('error resizing: ', err);
			response.end();
		});
	}, function(err) {
		response.write(JSON.stringify({error: err}));
		response.end();
	});
});

app.use('/photo/:id', function(request, response) {
	response.setHeader('Content-Type', 'image/jpeg');
	setCacheHeaders(response);

	dbIO.readPhotoById(request.params.id).then(function(err, row) {
		let file = fs.readFileSync(row.path, 'binary');
		response.write(file, 'binary');
		response.end();
	}, function(err) {
		response.write(JSON.stringify({error: err}));
		response.end();
	});
});

app.use('/exif/:id', function(request, response) {
	response.setHeader('Content-Type', 'application/json');
	let cacheUrl = '/exif/' + request.params.id;
	let httpDeferred = createHttpDeferred(response);

	wrapCache(cache, cacheUrl, httpDeferred, function(deferred) {
		dbIO.readPhotoById(request.params.id).then((row) => {
			getExif(row.path).then((exif) => {
				delete exif.thumbnail;
				delete exif.exif.MakerNote;
				deferred.resolve(JSON.stringify(exif));
			}).catch((err) => {
				deferred.reject(JSON.stringify({error: err}));
			});
		}, (err) => {
			deferred.reject(JSON.stringify({error: err}));
		});
	});

});

app.use('/tags/:id', function(request, response) {
	response.setHeader('Content-Type', 'application/json');
	let cacheUrl = '/tags/' + request.params.id;
	let httpDeferred = createHttpDeferred(response);

	wrapCache(cache, cacheUrl, httpDeferred, function(deferred) {
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
	// request.query.search
	console.log(request.query);
	console.log(JSON.stringify(request.query));

	response.setHeader('Content-Type', 'application/json');
	let cacheUrl = '/listing?' + JSON.stringify(request.query);
	let cachedResponse = cache.get(cacheUrl);
	if (isCacheEnabled && cachedResponse) {
		console.log('*** returning cached response ***');
		response.write(cachedResponse);
		response.send();
		return;
	}

	if (request.query.tag !== undefined && request.query.tag.length > 0) {
		dbIO.queryPhotos(request.query.tag).then((rows) => {
			rows.forEach(function(row) {
				row.dateInMillis = Date.parse(row.date);
			});
			cache.put('/listing', JSON.stringify(rows));
			response.write(JSON.stringify(rows));
			response.send();
		}, (err) => {
			console.error(err);
			response.write(JSON.stringify({images: []}));
			response.send();
		});
		return;
	}

	dbIO.readAllPhotos().then(function(rows) {
		rows.forEach(function(row) {
			row.dateInMillis = Date.parse(row.date);
		});
		cache.put(cacheUrl, JSON.stringify(rows));
		response.write(JSON.stringify(rows));
		response.send();
	}, function(err) {
		console.error(err);
		response.write(JSON.stringify({images: []}));
		response.send();
	});
});
