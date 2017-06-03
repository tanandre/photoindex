class Deferred {

	static createResolved(data) {
		var deferred = new Deferred();
		deferred.resolve(data);
		return deferred;
	}

	constructor() {
		this.isResolved = false;
		this.isRejected = false;
		this.listeners = [];
	}

	then(onOk, onError, onProgress) {
		var listener = [onOk, onError, onProgress];
		this.listeners.push(listener);

		if (this.isResolved) {
			onOk(this.data);
		} else if (this.isRejected) {
			onError(this.data);
		}
		return this;
	}

	progress(data) {
		this.signalListeners(data, 2);
	}

	resolve(data) {
		this.isResolved = true;
		this.data = data;
		this.signalListeners(data, 0);
	}

	signalListeners(data, index) {
		this.listeners.forEach(function(listener) {
			var callback = listener[index];
			if (callback) {
				callback(data);
			}
		});
	}

	reject(data) {
		this.isRejected = true;
		this.data = data;
		this.signalListeners(data, 1);
	}

	/**
	 * wait for all promises to complete. Does not signal reject yet...
	 * @param deferredList
	 * @returns {Deferred.constructor}
	 */
	static all(deferredList) {
		var globalDeferred = new Deferred();
		deferredList.forEach(function(deferred) {
			function onComplete(data) {
				deferred.__data = data;

				var isAllComplete = deferredList.every(function(d) {
					return d.isResolved || d.isRejected;
				});

				if (isAllComplete) {
					var isRejected = deferredList.some(function(d) {
						return d.isRejected;
					});
					if (isRejected) {
						globalDeferred.reject(deferredList.map(function(d) {
							return d.__data;
						}));
					} else {
						globalDeferred.resolve(deferredList.map(function(d) {
							return d.__data;
						}));
					}
				}
			}

			deferred.then(onComplete, onComplete);
		});
		return globalDeferred;
	}

}

(function() {
	var mysql = require('mysql');

	var connection = mysql.createConnection({
		host: 'kanji',
		user: 'photoindex',
		password: 'dc0b5jjF7bNjarkA',
		database: 'photoindex2'
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

	function createTables(connection, done) {
		console.log("Connnection with DB established");
		// drop all tables
		connection.query("DROP TABLE IF EXISTS photo_tag");
		connection.query("DROP TABLE IF EXISTS tag");
		connection.query("DROP TABLE IF EXISTS photo");

		var sqlCreatePhotoTable = "CREATE TABLE if not exists photo " +
			"( id INT NOT NULL AUTO_INCREMENT, date DATETIME NOT NULL, path VARCHAR(255) NOT NULL, description VARCHAR(255) NULL, " +
			"PRIMARY KEY (id), INDEX IX_DATE (date), UNIQUE(path))";
		var sqlCreateTagTable = "CREATE TABLE if not exists tag ( id INT NOT NULL AUTO_INCREMENT, name VARCHAR(32) NOT NULL , PRIMARY KEY (id), UNIQUE(name) )";
		var sqlCreateLinkTable = "CREATE TABLE if not exists photo_tag ( photoid INT NOT NULL , tagid INT NOT NULL, " +
			"INDEX IX_PHOTO_ID (photoid), INDEX IX_TAG_ID (tagid), FOREIGN KEY (photoid) REFERENCES photo(id), FOREIGN KEY (tagid) REFERENCES tag(id))";
		connection.query(sqlCreatePhotoTable, createDbHandle('table photo created', function() {
			connection.query(sqlCreateTagTable, createDbHandle('table tag created', function() {
				connection.query(sqlCreateLinkTable,
					createDbHandle('table photo_tag created', function() {
						done(null, connection);
					}));
			}));
		}));
	}

	module.exports.initialize = function(done) {
		connection.connect(function(err) {
			if (err) {
				done(err);
			}
			createTables(connection, done);
			done();

		});
	};

	module.exports.addPhoto = function(file, date) {
		//console.log('adding photo exif data to table', file);
		var sql = "INSERT INTO photo (date, path) VALUES ?;";
		var deferred = new Deferred();
		connection.query(sql, [[[date, file]]], function(err, result) {
			if (err) {
				console.error(err);
				deferred.reject(err);
				return;
			}

			console.log('photo insertId', result.insertId);
			deferred.resolve(result.insertId);
		});

		return deferred;
	};

	module.exports.addPhotoTag = function(photoId, tagId) {
		var sql = "INSERT INTO photo_tag (photoId, tagId) VALUES ?;";
		var deferred = new Deferred();
		connection.query(sql, [[[photoId, tagId]]], function(err, result) {
			if (err) {
				console.error(err);
				deferred.reject(err);
				return;
			}
			deferred.resolve(result.insertId);
		});
		return deferred;
	};

	module.exports.addOrGetTag = function(tag) {
		var deferred = new Deferred();
		var sql = "INSERT INTO tag (name) VALUES ?;";
		connection.query(sql, [[[tag]]], function(err, result) {
			if (err) {
				console.error('tag already exists', tag);
				connection.query("SELECT id FROM tag WHERE name = ?", [[[tag]]], function(err, row) {
					if (err) {
						console.error(err);
						deferred.reject(err);
						return;
					}
					console.log('using existing tag id', tag, row[0].id);
					deferred.resolve(row[0].id);
				});
				return;
			}

			console.log('tag inserted', result.insertId);
			deferred.resolve(result.insertId);
		});
		return deferred;
	};

	module.exports.readAllPhotos = function() {
		var deferred = new Deferred();
		var sql = "SELECT * FROM photo ORDER BY date DESC";
		connection.query(sql, function(err, rows) {
			if (err) {
				deferred.reject(err);
				return;
			}
			deferred.resolve(rows);
		});
		return deferred;
	};

	function getSqlMatch(dateStr) {
		if (dateStr.length === 4) {
			// match year
			return {
				sql: 'YEAR(date) = ?',
				values: [dateStr]
			};
		}
		if (dateStr.length === 5 || dateStr.length === 6) {
			// match year+month
			return {
				sql: 'YEAR(date) = ? AND MONTH(date) = ?',
				values: [dateStr.substring(0, 4), dateStr.substring(4, dateStr.length)]
			};
		}
		if (dateStr.length === 8) {
			// match year+month+day
			return {
				sql: 'DATE(date) = ?',
				values: [dateStr]
			};
		}
		return null;
	}

	module.exports.getPhotosByDate = function(dateStr) {
		var deferred = new Deferred();
		var sqlMatch = getSqlMatch(dateStr);
		if (sqlMatch === null) {
			deferred.reject(new Error('cannot parse date expected search string length of 4,6 or 8'));
			return deferred;
		}

		var sql = "SELECT * FROM photo WHERE " + sqlMatch.sql + " ORDER BY date DESC";
		console.log('sql query', sql);
		connection.query(sql, sqlMatch.values, function(err, rows) {
			if (err) {
				deferred.reject(err);
				return;
			}
			deferred.resolve(rows);
		});
		return deferred;
	};

	module.exports.readAllPhotosPaths = function(done) {
		var sql = "SELECT path FROM photo";
		connection.query(sql, function(err, rows) {
			done(err, rows);
		});
	};

	module.exports.readTagsForPhoto = function(id) {
		var deferred = new Deferred();
		var sql = "SELECT tag.name FROM photo_tag INNER JOIN tag on photo_tag.tagId = tag.id WHERE photoId = ?;";
		connection.query(sql, [[[id]]], function(err, rows) {
			if (err) {
				console.error(err);
				deferred.reject(err);
				return;
			}

			deferred.resolve(rows);
		});
		return deferred;
	};

	module.exports.readPhotoById = function(id, done) {
		var sql = "SELECT * FROM photo where id = ?";
		connection.query(sql, [id], function(err, rows) {
			if (err) {
				done(err, rows);
				return;
			}

			if (rows.length !== 1) {
				done('incorrect ID photo not found: ' + id);
			} else {
				done(err, rows[0]);
			}
		});
	};
}());
