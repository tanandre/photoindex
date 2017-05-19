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
var nfsimageDir = "\\\\kanji\\photo\\2009\\2009-04-30 Middelkerke\\";
var nfsimageDir2009 = "\\\\kanji\\photo\\2009\\";
var nfsimageDir2016 = "\\\\kanji\\photo\\2016\\";
var nfsimageDirOldPhone = "\\\\kanji\\photo\\phone\\phonedata";
//var nfsimageDir = "\\\\kanji\\photo\\collage\\";

var app = express();

function isImageFile(file) {
	return file.toLowerCase().indexOf('.jpg') !== -1 || file.toLowerCase().indexOf('.jpeg') !== -1
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

dbIO.createTables(function(err, connection) {
	if (err) {
		console.error(err);
		return;
	}
	photoCrawler.indexPhotosInFolder(imageDir, function(file) {
		process.stdout.write(".");
		if (!isImageFile(file)) {
			return;
		}
		getExif(file).then(function(exif) {
			if (exif.exif.CreateDate) {
				dbIO.addPhoto(file, exif.exif.CreateDate);
			} else {
				console.error('exif header present but no CreateDate attribute, reading date from file',
					file);
				readDateFromFile(file, function(date) {
					dbIO.addPhoto(file, date);
				});
			}
		}, function(err) {
			console.error('no exif header found reading date from file', file);
			readDateFromFile(file, function(date) {
				dbIO.addPhoto(file, date);
			});
		});
	});
});

var server = app.listen(1337, function() {
	console.log('Example app listening on port 1337!')
});

app.use(express.static('public'));
app.use('/node_modules', express.static('node_modules'));

function setCacheHeaders(response) {
	// response.setHeader("Cache-Control", "public, max-age=31536000");
	// response.setHeader("Expires", new Date(Date.now() + 31536000000).toUTCString());
}

app.use('/photo/:id/:width', function(request, response) {
	response.setHeader('Content-Type', 'image/jpeg');
	setCacheHeaders(response);

	dbIO.readPhotoById(request.params.id, function(err, row) {
		// TODO if original photo is smaller than requested param don't resize
		// TODO store exif dimensions in db to optimize calculation?
		// TODO check if modified since if we are reading the file from the cache
		// TODO store in cache, use cache headers

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
		console.log(file);
		response.write(file, 'binary');
		response.end();
	});
});

app.use('/exif/:id', function(request, response) {
	response.setHeader('Content-Type', 'application/json');

	dbIO.readPhotoById(request.params.id, function(err, row) {
		getExif(row.path).then(function(exif) {
			response.write(JSON.stringify(exif));
			response.end();
		}).catch(function(err) {
			console.log('error reading exif', row.path);
			response.write(JSON.stringify({error: err}));
			response.end();
		});
	});
});

app.get("/listing", function(request, response) {
	response.setHeader('Content-Type', 'application/json');
	var cachedResponse = cache.get('/listing');
	if (isCacheEnabled && cachedResponse) {
		console.log('*** returning cached response ***');
		response.write(cachedResponse);
		response.send();
		return;
	}

	dbIO.readAllPhotos(function(err, rows) {
		if (err) {
			console.error(err);
			return;
		}
		cache.put('/listing', JSON.stringify(rows));
		response.write(JSON.stringify(rows));
		response.send();
	});
});
