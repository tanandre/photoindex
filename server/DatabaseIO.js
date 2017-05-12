(function() {
	var mysql = require('mysql');

	var connection = mysql.createConnection({
		host: 'kanji',
		user: 'photoindex',
		password: 'dc0b5jjF7bNjarkA',
		database: 'photoindex'
	});

	function createDbHandle(logMessage, callback) {
		return function(error, result) {
			if (error) {
				throw error;
			}
			console.log(logMessage);
			callback();
		};
	}

	module.exports.createTables = function(done) {
		connection.connect(function(err) {
			if (err) {
				done(err);
			}
			console.log("Connnection with DB established");
			connection.query("DROP TABLE photo_tag");
			connection.query("DROP TABLE tag");
			connection.query("DROP TABLE photo");

			var sqlCreatePhotoTable = "CREATE TABLE if not exists photoindex.photo ( id INT NOT NULL AUTO_INCREMENT, date DATETIME NULL DEFAULT NULL , path VARCHAR(255) NOT NULL , description VARCHAR(255) NULL , PRIMARY KEY (id), INDEX IX_DATE (date), UNIQUE(path))";
			var sqlCreateTagTable = "CREATE TABLE if not exists photoindex.tag ( id INT NOT NULL AUTO_INCREMENT, description VARCHAR(255) NOT NULL , PRIMARY KEY (id))";
			var sqlCreateLinkTable = "CREATE TABLE if not exists photoindex.photo_tag ( photoid INT NOT NULL , tagid INT NOT NULL, INDEX IX_PHOTO_ID (photoid), INDEX IX_TAG_ID (tagid), FOREIGN KEY (photoid) REFERENCES photo(id), FOREIGN KEY (tagid) REFERENCES tag(id))";
			connection.query(sqlCreatePhotoTable, createDbHandle('table photo created', function() {
				connection.query(sqlCreateTagTable, createDbHandle('table tag created', function() {
					connection.query(sqlCreateLinkTable,
						createDbHandle('table photo_tag created', function() {
							done(null, connection);
						}));
				}));
			}));

		});
	};

	module.exports.addPhoto = function(file, date) {
		console.log('adding photo exif data to table', file);
		var sql = "INSERT INTO photo (date, path) VALUES ?";
		connection.query(sql, [[[date, file]]], function(err) {
			if (err) {
				console.error(err);
				return;
			}
		});
	};

	module.exports.readAllPhotos = function(done) {
		var sql = "SELECT * FROM photo ORDER BY date DESC";
		connection.query(sql, function(err, rows) {
			done(err, rows);
		});
	};
}());
