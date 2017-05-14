
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
var nfsimageDir2016 = "\\\\kanji\\photo\\2016\\";
var nfsimageDirOldPhone = "\\\\kanji\\photo\\phone\\phonedata";
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

app.use('/photo', function(request, responseres) {
	var file = fs.readFileSync(request.query.path, 'binary');
	responseres.setHeader('Content-Type', 'image/jpeg');
	responseres.write(file, 'binary');
	responseres.end();
});

app.use('/exif', function(request, response) {
	var file = fs.readFileSync(request.query.path, 'binary');
	response.setHeader('Content-Type', 'application/json');
	getExif(file, function(err, exif) {
		if (err) {
			throw err;
		}
		response.write(JSON.stringify(exif));
		response.end();
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
		response.write(JSON.stringify(rows));
		response.send();

	});
});

app.use(express.static('public'));

app.use('/node_modules', express.static('node_modules'));

io.on('connection', function(socket) {
	console.log('a user connected');
});

