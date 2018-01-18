'use strict';

let Deferred = require('../public/lib/Deferred');
let Timer = require('../public/lib/Timer');
let cache = require('memory-cache');

(function () {
	let mysql = require('mysql');

	let connection = mysql.createConnection({
		host: 'kanji',
		user: 'photoindex',
		password: 'dc0b5jjF7bNjarkA',
		database: 'photoindex'
	});

	function createDbHandle(logMessage, callback) {
		return function (error, result) {
			if (error) {
				throw error;
			}
			console.log(logMessage);
			callback(result);
		};
	}

	function query(sql, values, isSuppressErrorLog) {
		let timer = new Timer();
		let deferred = new Deferred();
		connection.query(sql, values, (err, result) => {
			if (err) {
				if (!isSuppressErrorLog) {
					if (err.code === 'ER_DUP_ENTRY') {
						console.error('-- duplicate entry');
					} else {
						console.error(sql, values, err);
					}
				}
				deferred.reject(err);
				return;
			}
			console.log('sql time:', timer.stamp(), ' - ', sql);
			deferred.resolve(result);
		});
		return deferred;
	}

	function createTables(connection, done) {
		console.log("Connection with DB established");
		// drop all tables
		connection.query("DROP TABLE IF EXISTS photo_tag");
		connection.query("DROP TABLE IF EXISTS tag");
		connection.query("DROP TABLE IF EXISTS photo");

		let sqlCreatePhotoTable = "CREATE TABLE if not exists photo " +
			"( id INT NOT NULL AUTO_INCREMENT, date DATETIME NOT NULL, path VARCHAR(255) NOT NULL, description VARCHAR(255) NULL, " +
			"PRIMARY KEY (id), INDEX IX_DATE (date), UNIQUE(path))";
		let sqlCreateTagTable = "CREATE TABLE if not exists tag ( id INT NOT NULL AUTO_INCREMENT, name VARCHAR(32) NOT NULL , PRIMARY KEY (id), UNIQUE(name) )";
		let sqlCreateLinkTable = "CREATE TABLE if not exists photo_tag ( photoid INT NOT NULL , tagid INT NOT NULL, " +
			"INDEX IX_PHOTO_ID (photoid), INDEX IX_TAG_ID (tagid), UNIQUE(photoid, tagid), FOREIGN KEY (photoid) REFERENCES photo(id), FOREIGN KEY (tagid) REFERENCES tag(id))";
		connection.query(sqlCreatePhotoTable, createDbHandle('table photo created', () => {
			connection.query(sqlCreateTagTable, createDbHandle('table tag created', () => {
				connection.query(sqlCreateLinkTable, createDbHandle('table photo_tag created', () => {
					done(null, connection);
				}));
			}));
		}));
	}

	module.exports.initialize = function (done) {
		connection.connect((err) => {
			if (err) {
				done(err, connection);
				return;
			}
			done(null, connection);
			// createTables(connection, done);
		});
	};

	module.exports.createTables = createTables;

	module.exports.addPhotoBatch = function (rows) {
		return query("INSERT INTO photo (date, path) VALUES ?;", [rows]).then((result) => {
			console.log('batch inserted: ', rows.length);
		});
	};

	module.exports.updatePhoto = function (row) {
		return query("UPDATE photo SET date = ? WHERE id = ?;", row).then((result) => {
			return result.insertId;
		});
	};
	module.exports.addPhoto = function (row) {
		return query("INSERT INTO photo (date, path) VALUES ?;", [[row]]).then((result) => {
			return result.insertId;
		});
	};

	module.exports.addPhotoTag = function (photoId, tagId) {
		return query("INSERT INTO photo_tag (photoId, tagId) VALUES ?;", [[[photoId, tagId]]])
			.then((result) => {
				return result.insertId;
			});

	};

	module.exports.addOrGetTag = function (tag) {
		let cacheUrl = 'tag/' + tag;
		let cachedResponse = cache.get(cacheUrl);
		if (cachedResponse) {
			// console.log('reading tag from cache');
			return Deferred.createResolved(cachedResponse);
		}

		let deferred = new Deferred();
		query("INSERT INTO tag (name) VALUES ?;", [[[tag]]], true).then((result) => {
			cache.put(cacheUrl, result.insertId);
			deferred.resolve(result.insertId)
		}, (err) => {
			if (err.code !== 'ER_DUP_ENTRY') {
				console.error('error while trying to insert tag: ', tag, err);
				deferred.reject(err);
				return;
			}
			//console.error('tag already exists will query', tag, err);
			query("SELECT id FROM tag WHERE name = ?", [[[tag]]]).then((row) => {
				cache.put(cacheUrl, row[0].id);
				deferred.resolve(row[0].id);
			}, (err) => {
				deferred.reject(err);
			})
		});

		return deferred;
	};

	function queryTag(tags) {
		let sqlMatch = tags.map(() => 'name like ?').join(' OR ');
		query("SELECT id FROM tag WHERE " + sqlMatch, [[tags]]);
	}

	module.exports.queryTag = queryTag;

	module.exports.readAllPhotos = function () {
		return query("SELECT * FROM photo ORDER BY date DESC LIMIT 1000");
	};

	function getSqlTagMatch(tagLabels) {
		if (tagLabels.length === 0) {
			return '';
		}

		return tagLabels.map(() => 't.name like ?').join(' OR ');
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

	function getSqlMatchCriteria(queryTags) {
		let tagDates = queryTags.filter(isDateTag);
		let tagLabels = queryTags.filter((tag) => !isDateTag(tag)).map((tag) => '%' + tag + '%');

		if (tagDates.length === 0) {
			return {
				sql: getSqlTagMatch(tagLabels),
				values: tagLabels,
				hasTagLabels: false
			};
		}

		let sqlMatchers = tagDates.map((date) => getSqlDateMatch(date, tagLabels));
		let sqlList = sqlMatchers.map((sqlMatch) => sqlMatch.sql);
		let values = sqlMatchers.map((sqlMatch) => sqlMatch.values);

		return {
			sql: sqlList.join(' OR '),
			values: [].concat.apply([], values),
			hasTagLabels: tagLabels.length > 0
		}
	}

	function isDateTag(tag) {
		return /^\d{4,8}$/.test(tag);
	}

	function fixPhotoPathsForLocalhost(rows) {
		return rows.map(row => {
			row.path = row.path.replace(/\\/g, '/').replace('//kanji', '/volume1');
			return row;
		});
	}

	module.exports.queryPhotos = function (queryTags) {
		if (queryTags === undefined || queryTags.length === 0) {
			return query("SELECT * FROM photo ORDER BY date DESC LIMIT 1000");
		}

		let sqlMatch = getSqlMatchCriteria(queryTags);
		let joinTagTable = !sqlMatch.hasTagLabels ? '' : // let joinTagTable =
			'LEFT JOIN photo_tag pt ON pt.photoId = p.id INNER JOIN tag t ON pt.tagId = t.id';
		let sql = "SELECT p.* FROM photo p " + joinTagTable + " WHERE " + sqlMatch.sql +
			" ORDER BY p.date DESC";

		console.log(sql, queryTags);
		return query(sql, sqlMatch.values).then(rows => {
			if (isOnKanji) {
				return fixPhotoPathsForLocalhost(rows);
			}
		});
	};

	module.exports.readAllPhotosPaths = function () {
		return query("SELECT id, path FROM photo").then(rows => {
			if (isOnKanji) {
				return fixPhotoPathsForLocalhost(rows);
			}
		});
	};

	module.exports.readTagsForPhoto = function (id) {
		return query(
			"SELECT tag.name FROM photo_tag INNER JOIN tag on photo_tag.tagId = tag.id WHERE photoId = ?;",
			[id]);
	};

	module.exports.readPhotoById = function (id) {
		let deferred = new Deferred();
		query("SELECT * FROM photo where id = ?", [id]).then((rows) => {
			if (rows.length === 0) {
				deferred.reject(new Error('could not find photo for id' + id));
				return;
			}
			if (isOnKanji) {
				deferred.resolve(fixPhotoPathsForLocalhost(rows)[0]);
			} else {
				deferred.resolve(rows[0]);
			}
		}, (err) => {
			deferred.reject(err);
		});

		return deferred;
	};
}());
