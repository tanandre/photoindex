var getExif = require('exif-async');
var express = require("express");
var cache = require('memory-cache');
var dbIO = require('./server/DatabaseIO');
var photoCrawler = require('./server/PhotoCrawler');

function isImageFile(file) {
	return file.toLowerCase().indexOf('.jpg') !== -1 || file.toLowerCase().indexOf('.jpeg') !== -1
}

function readDateFromFile(file, done) {
	fs.stat(file, function(err, stats) {
		if (err) {
			console.error(err);
			return;
		}
		done(stats.mtime);
	});
}

dbIO.createTables(function(err, connection) {
	if (err) {
		console.error(err);
		return;
	}
	photoCrawler.indexPhotosInFolder(imageDir, function(file) {
		if (!isImageFile(file)) {
			return;
		}

		console.log('indexing file', file);
		getExif(file).then(function(exif) {
			if (exif.exif.CreateDate) {
				dbIO.addPhoto(file, exif.exif.CreateDate);
			} else {
				readDateFromFile(file, function(date) {
					dbIO.addPhoto(file, date);
				});
			}
		}, function(err) {
			console.error(err);
			readDateFromFile(file, function(date) {
				dbIO.addPhoto(file, date);
			});
		});
	});
});

var app = express();
var server = app.listen(1337, function() {
	console.log('Example app listening on port 1337!')
});

var isCacheEnabled = true;
var io = require('socket.io').listen(server);

var fs = require('fs');
var path = require('path');

var imageDir = "c:\\andre\\afdruk\\";
var nfsimageDir = "\\\\kanji\\photo\\2009\\2009-04-30 Middelkerke\\";
var nfsimageDir2009 = "\\\\kanji\\photo\\2009\\";
//var nfsimageDir = "\\\\kanji\\photo\\collage\\";

var diretoryTreeToObj = function(dir, done, results) {

	fs.readdir(dir, function(err, list) {
		if (err) {
			return done(err);
		}

		var pending = list.length;

		if (!pending) {
			return done(null, {
				name: path.basename(dir),
				type: 'folder',
				children: results
			});
		}

		list.forEach(function(file) {
			file = path.resolve(dir, file);
			fs.stat(file, function(err, stat) {
				if (stat && stat.isDirectory()) {
					diretoryTreeToObj(file, function() {
						if (!--pending) {
							done(null, results);
						}
					}, results);
				} else {
					if (isImageFile(file)) {
						// console.log('selecting image file: ', file);

						results.push(file);
					}
					if (!--pending) {
						done(null, results);
					}
				}
			});
		});
	});
};

function getImageList(response, dir, requestUrl) {
	response.setHeader('Content-Type', 'application/json');

	var cachedResponse = cache.get(requestUrl);
	if (isCacheEnabled && cachedResponse) {
		console.log('*** returning cached response ***');
		response.write(cachedResponse);
		response.send();
		return;
	}

	console.log('*** start selecting image files ***');
	console.time('readFiles');
	diretoryTreeToObj(dir, function(err, res) {
		console.log('*** done selecting image files ***', res.length);
		console.timeEnd('readFiles');
		if (err) {
			response.write(JSON.stringify(err));
		}

		var count = res.length;
		var result = [];

		function exifDataLoaded() {
			if (count < 1) {
				console.timeEnd('readExif');
				result.sort(function(a, b) {
					function getDate(f) {
						if (f.attr.exif === undefined || f.attr.exif.CreateDate === undefined) {
							if (f.name.match(/(19|20)\d{6}/)) {
								//								console.log('match date!', f.name, /((?:19|20)\d{6})/.exec(f.name)[1]);

								return /((?:19|20)\d{6})/.exec(f.name)[1];
							}
							return "1";
						}
						return f.attr.exif.CreateDate.replace(/\D/g, '');
					}

					return getDate(b).localeCompare(getDate(a));
				});

				cache.put(requestUrl, JSON.stringify(result));

				response.write(JSON.stringify(result, null, 3));
				response.send();
			}
		}

		console.time('readExif');
		res.forEach(function(file) {
			//console.log('reading exif data for file: ', file);
			getExif(file).then(function(exif) {
				count--;
				//	console.log('exif data loaded for file: ', file, count);
				result.push({
					path: file.replace(dir, '').replace('\\', '/'),
					name: path.basename(file),
					attr: exif
				});

				exifDataLoaded();
			}, function(err) {
				count--;
				result.push({
					path: file.replace(dir, '').replace('\\', '/'),
					name: path.basename(file),
					attr: {}
				});
				console.error(err, count);
				exifDataLoaded();
			});
		});
	}, []);
}

app.use('/photo', function(request, res) {
	var file = fs.readFileSync(request.query.path, 'binary');
	res.setHeader('Content-Type', 'image/jpeg');
	res.write(file, 'binary');
	res.end();
});

app.use('/images', express.static(imageDir));
app.use('/imagesnfs', express.static(nfsimageDir));

app.get("/listing", function(request, response) {
	response.setHeader('Content-Type', 'application/json');
	dbIO.readAllPhotos(function(err, rows) {
		if (err) {
			console.error(err);
			return;
		}
		response.write(JSON.stringify(rows));
		response.send();

	});
	//getImageList(response, imageDir, '/listing');
});

app.get("/listingnfs", function(request, response) {
	getImageList(response, nfsimageDir, '/listingnfs');
});

app.use(express.static('public'));

app.use('/node_modules', express.static('node_modules'));

io.on('connection', function(socket) {
	console.log('a user connected');
});

