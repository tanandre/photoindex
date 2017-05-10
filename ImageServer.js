var getExif = require('exif-async');
var express = require("express");
var cache = require('memory-cache');

var mysql      = require('mysql');
var connection = mysql.createConnection({
	host     : 'kanji',
	user     : 'root',
	password : 'appelflap',
	database : 'photoindex'
});

connection.connect(function() {
	var sqlCreatePhotoTable = "CREATE TABLE photo ( id INT NOT NULL , date DATE NULL DEFAULT NULL , path VARCHAR NOT NULL , description VARCHAR NULL , PRIMARY KEY (id), INDEX IX_DATE (date))";
	connection.query(sqlCreatePhotoTable, function (err, result) {
		if (err) throw err;
		console.log("Table created");
	});
});

/*
photo (id, date, path, description)
photo_tag (photoid, tagid)
tag (id, name)
*/
connection.query('SELECT * from photo', function (error, results, fields) {
	if (error) throw error;
	console.log('The solution is: ', results[0].solution);
});

connection.end();



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
//var nfsimageDir = "\\\\kanji\\photo\\collage\\";

var diretoryTreeToObj = function(dir, done, results) {

	function isImageFile(file) {
		return file.toLowerCase().indexOf('.jpg') !== -1 || file.toLowerCase().indexOf('.jpeg') !== -1
	}

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
						console.log('selecting image file: ', file);

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
				result.sort(function(a, b){
					function getDate(f) {
						if (f.attr.exif === undefined || f.attr.exif.CreateDate === undefined) {
							if (f.name.match(/(19|20)\d{6}/)) {
//								console.log('match date!', f.name, /((?:19|20)\d{6})/.exec(f.name)[1]);

								return /((?:19|20)\d{6})/.exec(f.name)[1];
							}
							return "1";
						}
						return f.attr.exif.CreateDate.replace(/\D/g,'');
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


app.use('/images', express.static(imageDir));
app.use('/imagesnfs', express.static(nfsimageDir));

app.get("/listing", function(request, response) {
	getImageList(response, imageDir, '/listing');
});

app.get("/listingnfs", function(request, response) {
	getImageList(response, nfsimageDir, '/listingnfs');
});

app.use(express.static('public'));

app.use('/node_modules', express.static('node_modules'));

io.on('connection', function(socket) {
	console.log('a user connected');
});

