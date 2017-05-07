var express = require("express");
var fs = require('fs');
var path = require('path');

var app = express();
var imageDir = "c:\\andre\\afdruk\\";
var nfsimageDir = "\\\\kanji\\photo\\";

var diretoryTreeToObj = function(dir, done) {
	var results = [];

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
					diretoryTreeToObj(file, function(err, res) {
						results.push({
							name: path.basename(file),
							type: 'folder',
							children: res
						});
						if (!--pending) {
							done(null, results);
						}
					});
				} else {
					if (isImageFile(file)) {
						results.push({
							type: 'file',
							name: file.replace(imageDir, '')
						});
					}
					if (!--pending) {
						done(null, results);
					}
				}
			});
		});
	});
};

app.get("/images/:image", function(request, response) {
	var path = imageDir + request.params.image;

	console.log("fetching image: ", path);
	response.sendFile(path);
});

app.get("/listing", function(request, response) {
	response.setHeader('Content-Type', 'application/json');

	diretoryTreeToObj(imageDir, function(err, res) {
		if (err) {
			response.write(JSON.stringify(err));
		}

		response.write(JSON.stringify(res, null, 3));
		response.send();
	});

});

app.get("/listingnfs", function(request, response) {
	response.setHeader('Content-Type', 'application/json');

	diretoryTreeToObj(nfsimageDir, function(err, res) {
		if (err) {
			response.write(JSON.stringify(err));
		}

		response.write(JSON.stringify(res, null, 3));
		response.send();
	});

});

app.use(express.static('public'));

app.use('/node_modules', express.static('node_modules'));

app.listen(1337, function() {
	console.log('Example app listening on port 1337!')
});