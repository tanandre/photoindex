'use strict';

let Deferred = require('../public/lib/Deferred');
let cache = require('memory-cache');

(function() {
	let mysql = require('mysql');

	let connection = mysql.createConnection({
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
			callback(result);
		};
	}

	function query(sql, values) {
		let deferred = new Deferred();
		connection.query(sql, values, (err, result) => {
			if (err) {
				console.error(err);
				deferred.reject(err);
				return;
			}
			deferred.resolve(result);
		});
		return deferred;
	}

	function createTables(connection, done) {
		console.log("Connnection with DB established");
		// drop all tables
		connection.query("DROP TABLE IF EXISTS photo_tag");
		connection.query("DROP TABLE IF EXISTS tag");
		connection.query("DROP TABLE IF EXISTS photo");

		let sqlCreatePhotoTable = "CREATE TABLE if not exists photo " +
			"( id INT NOT NULL AUTO_INCREMENT, date DATETIME NOT NULL, path VARCHAR(255) NOT NULL, description VARCHAR(255) NULL, " +
			"PRIMARY KEY (id), INDEX IX_DATE (date), UNIQUE(path))";
		let sqlCreateTagTable = "CREATE TABLE if not exists tag ( id INT NOT NULL AUTO_INCREMENT, name VARCHAR(32) NOT NULL , PRIMARY KEY (id), UNIQUE(name) )";
		let sqlCreateLinkTable = "CREATE TABLE if not exists photo_tag ( photoid INT NOT NULL , tagid INT NOT NULL, " +
			"INDEX IX_PHOTO_ID (photoid), INDEX IX_TAG_ID (tagid), FOREIGN KEY (photoid) REFERENCES photo(id), FOREIGN KEY (tagid) REFERENCES tag(id))";
		connection.query(sqlCreatePhotoTable, createDbHandle('table photo created', () => {
			connection.query(sqlCreateTagTable, createDbHandle('table tag created', () => {
				connection.query(sqlCreateLinkTable, createDbHandle('table photo_tag created', () => {
					done(null, connection);
				}));
			}));
		}));
	}

	module.exports.initialize = function(done) {
		connection.connect((err) => {
			if (err) {
				done(err);
			}
			createTables(connection, done);
			done();

		});
	};

	module.exports.addPhoto = function(file, date) {
		//console.log('adding photo exif data to table', file);
		let sql = "INSERT INTO photo (date, path) VALUES ?;";
		let deferred = new Deferred();
		connection.query(sql, [[[date, file]]], (err, result) => {
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
		let sql = "INSERT INTO photo_tag (photoId, tagId) VALUES ?;";
		let deferred = new Deferred();
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
		let cacheUrl = 'tag/' + tag;
		let cachedResponse = cache.get(cacheUrl);
		if (cachedResponse) {
			console.log('reading tag from cache');
			return Deferred.createResolved(cachedResponse);
		}

		let deferred = new Deferred();
		let sql = "INSERT INTO tag (name) VALUES ?;";
		connection.query(sql, [[[tag]]], function(err, result) {
			if (err) {
				//console.error('tag already exists', tag);
				connection.query("SELECT id FROM tag WHERE name = ?", [[[tag]]], function(err, row) {
					if (err) {
						console.error(err);
						deferred.reject(err);
						return;
					}
					console.log('using existing tag id', tag, row[0].id);
					cache.put(cacheUrl, row[0].id);
					deferred.resolve(row[0].id);
				});
				return;
			}

			console.log('tag inserted', result.insertId);
			cache.put(cacheUrl, result.insertId);
			deferred.resolve(result.insertId);
		});
		return deferred;
	};

	function queryTag(tags) {
		let sqlMatch = tags.map(() => 'name like ?').join(' OR ');
		query("SELECT id FROM tag WHERE " + sqlMatch, [[tags]]);
	}

	module.exports.queryTag = queryTag;

	module.exports.readAllPhotos = function() {
		let sql = "SELECT * FROM photo ORDER BY date DESC";
		return query(sql);
	};

	function getSqlTagMatch(tagLabels) {
		if (tagLabels.length === 0) {
			return '';
		}

		return tagLabels.map(function() {
			return 't.name like ?';
		}).join(' OR ');
	}

	function getSqlDateMatch(dateStr, tagLabels) {
		let tagSqlMatch = tagLabels.length === 0 ? '' : ' AND (' + getSqlTagMatch(tagLabels) + ')';

		if (dateStr.length === 4) {
			return {
				sql: 'YEAR(date) = ? ' + tagSqlMatch,
				values: [dateStr].concat(tagLabels)
			};
		}
		if (dateStr.length === 5 || dateStr.length === 6) {
			return {
				sql: 'YEAR(date) = ? AND MONTH(date) = ? ' + tagSqlMatch,
				values: [dateStr.substring(0, 4), dateStr.substring(4, dateStr.length)].concat(tagLabels)
			};
		}
		return {
			sql: 'DATE(date) = ? ' + tagSqlMatch,
			values: [dateStr].concat(tagLabels)
		};
	}

	function getSqlMatchCriteria(tagDates, tagLabels) {
		if (tagDates.length === 0) {
			return {
				sql: getSqlTagMatch(tagLabels),
				values: tagLabels
			};
		}

		let sqlMatchers = tagDates.map(function(date) {
			return getSqlDateMatch(date, tagLabels);
		});

		let sqlList = sqlMatchers.map(function(sqlMatch) {
			return sqlMatch.sql;
		});

		let values = sqlMatchers.map(function(sqlMatch) {
			return sqlMatch.values;
		});
		return {
			sql: sqlList.join(' OR '),
			values: [].concat.apply([], values)
		}
	}

	function isDateTag(tag) {
		return /^\d{4,8}$/.test(tag);
	}

	module.exports.queryPhotos = function(queryTags) {

		let tagDates = queryTags.filter(isDateTag);
		let tagLabels = queryTags.filter((tag) => !isDateTag(tag)).map((tag) => '%' + tag + '%');

		let sqlMatch = getSqlMatchCriteria(tagDates, tagLabels);
		if (sqlMatch === null) {
			return Deferred.createRejected(
				new Error('cannot parse date expected search string length of 4,6 or 8'));
		}

		let joinTagTable = tagLabels.length === 0 ? '' :
			'LEFT JOIN photo_tag pt ON pt.photoId = p.id INNER JOIN tag t ON pt.tagId = t.id';

		let sql = "SELECT p.* FROM photo p " + joinTagTable + " WHERE " + sqlMatch.sql +
			" ORDER BY p.date DESC";

		console.log('query', sql);
		return query(sql, sqlMatch.values);
	};

	module.exports.readAllPhotosPaths = function(done) {
		let sql = "SELECT path FROM photo";
		connection.query(sql, function(err, rows) {
			done(err, rows);
		});
	};

	module.exports.readTagsForPhoto = function(id) {
		return query(
			"SELECT tag.name FROM photo_tag INNER JOIN tag on photo_tag.tagId = tag.id WHERE photoId = ?;",
			[id]);
	};

	module.exports.readPhotoById = function(id) {
		return query("SELECT * FROM photo where id = ?", [id]).then((rows) => {
			return rows[0];
		});
	};
}());
