var fs = require('fs');
var path = require('path');
var getExif = require('exif-async');
var express = require("express");
var cache = require('memory-cache');
var sharp = require('sharp');
var dbIO = require('./server/DatabaseIO');
var photoCrawler = require('./server/PhotoCrawler');

var isCacheEnabled = true;
var imageDir = "c:\\andre\\afdruk\\";
var tempThumbnailDir = "c:\\andre\\afdruk\\temp\\";
var nfsimageDir = "\\\\kanji\\photo\\2006\\2006-03-11 Eerste date\\";
var nfsimageDir2009 = "\\\\kanji\\photo\\2009\\";
var nfsimageDir2016 = "\\\\kanji\\photo\\2016\\";
var nfsimageDirOldPhone = "\\\\kanji\\photo\\phone\\phonedata";
//var nfsimageDir = "\\\\kanji\\photo\\collage\\";

var app = express();

function isImageFile(file) {
	return file.toLowerCase().indexOf('.jpg') !== -1 || file.toLowerCase().indexOf('.jpeg') !== -1;
}

function isVideoFile(file) {
	return file.toLowerCase().indexOf('.mp4') !== -1 || file.toLowerCase().indexOf('.avi') !== -1;
}

function readDateFromFile(file, done) {
	fs.stat(file, function(err, stats) {
		if (err) {
			console.error(err);
			return;
		}
		var fileName = path.basename(file);
		var dates = [stats.ctime, stats.mtime];
		if (fileName.match(/(19|20)\d{6}/)) {
			var dateStr = /((?:19|20)\d{6})/.exec(fileName)[1];
			// TODO add time parsing to improve precision of date
			//console.log(dateStr.slice(0, 4) + "-" + dateStr.slice(4, 6) + "-" + dateStr.slice(6), fileName);
			dates.push(new Date(Date.parse(
				dateStr.slice(0, 4) + "-" + dateStr.slice(4, 6) + "-" + dateStr.slice(8))));
		}

		dates.sort();
		done(dates[0]);
	});
}
var dateUnconfirmedTag = 'dateUnconfirmed';
function indexPhotos(dir, max) {
	var count = max;
	dbIO.readAllPhotosPaths(function(err, rows) {
		var paths = rows.map(function(row) {
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
					var deviceTag = exif.image.Model;
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

var server = app.listen(1337, function() {
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

	dbIO.readPhotoById(request.params.id, function(err, row) {
		// TODO if original photo is smaller than requested param don't resize
		// TODO store exif dimensions in db to optimize calculation?
		// TODO check if modified since if we are reading the file from the cache
		if (err) {
			console.error(err);
			response.end();
			return;
		}

		if (request.params.width === undefined) {
			var file = fs.readFileSync(row.path, 'binary');
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
	});
});

app.use('/photo/:id', function(request, response) {
	response.setHeader('Content-Type', 'image/jpeg');
	setCacheHeaders(response);

	dbIO.readPhotoById(request.params.id, function(err, row) {
		var file = fs.readFileSync(row.path, 'binary');
		response.write(file, 'binary');
		response.end();
	});
});

app.use('/exif/:id', function(request, response) {
	response.setHeader('Content-Type', 'application/json');
	var cacheUrl = '/exif/' + request.params.id;
	var cachedResponse = cache.get(cacheUrl);
	if (isCacheEnabled && cachedResponse) {
		console.log('*** returning cached response ***');
		response.write(cachedResponse);
		response.send();
		return;
	}

	dbIO.readPhotoById(request.params.id, function(err, row) {
		getExif(row.path).then(function(exif) {
			delete exif.thumbnail;
			delete exif.exif.MakerNote;
			cache.put(cacheUrl, JSON.stringify(exif));
			response.write(JSON.stringify(exif));
			response.end();
		}).catch(function(err) {
			console.log('error reading exif', row.path);
			cache.put(cacheUrl, JSON.stringify({error: err}));
			response.write(JSON.stringify({error: err}));
			response.end();
		});
	});
});

app.use('/tags/:id', function(request, response) {
	response.setHeader('Content-Type', 'application/json');
	var cacheUrl = '/tags/' + request.params.id;
	var cachedResponse = cache.get(cacheUrl);
	if (isCacheEnabled && cachedResponse) {
		console.log('*** returning cached response ***');
		response.write(cachedResponse);
		response.send();
		return;
	}

	dbIO.readTagsForPhoto(request.params.id).then(function(rows) {
		var tags = rows.map(function(row) {
			return row.name;
		});
		cache.put(cacheUrl, JSON.stringify({tags: tags}));
		response.write(JSON.stringify({tags: tags}));
		response.end();
	}, function(err) {
		console.log('error reading tags', err);
		var value = JSON.stringify({
			error: err,
			tags: []
		});
		cache.put(cacheUrl, value);
		response.write(value);
		response.end();
	});
});

app.get("/listing", function(request, response) {
	// request.query.search
	console.log(request.query);
	console.log(JSON.stringify(request.query));

	response.setHeader('Content-Type', 'application/json');
	var cacheUrl = '/listing?' + JSON.stringify(request.query);
	var cachedResponse = cache.get(cacheUrl);
	if (isCacheEnabled && cachedResponse) {
		console.log('*** returning cached response ***');
		response.write(cachedResponse);
		response.send();
		return;
	}

	if (request.query.tag !== undefined && request.query.tag.length > 0) {
		dbIO.queryPhotos(request.query.tag).then(function(rows) {
			rows.forEach(function(row) {
				row.dateInMillis = Date.parse(row.date);
			});
			cache.put('/listing', JSON.stringify(rows));
			response.write(JSON.stringify(rows));
			response.send();
		}, function(err) {
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

app.get("/photo/query", function(request, response) {
	var filter = request.query.filter;

	response.setHeader('Content-Type', 'application/json');

	dbIO.getPhotosByDate(filter).then(function(err, rows) {
		if (err) {
			console.error(err);
			return;
		}
		rows.forEach(function(row) {
			row.dateInMillis = Date.parse(row.date);
		});
		cache.put('/listing', JSON.stringify(rows));
		response.write(JSON.stringify(rows));
		response.send();
	});
});
