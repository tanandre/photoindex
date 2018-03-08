'use strict';

let Timer = require('../public/lib/Timer');
let cache = require('memory-cache');

(function () {
	let mysql = require('mysql');

	let connection = null;

	function createDbHandle (logMessage, callback) {
		return function (error, result) {
			if (error) {
				throw error;
			}
			console.log(logMessage);
			callback(result);
		};
	}

	function query (sql, values, isSuppressErrorLog) {
		let timer = new Timer();
		if (connection === null) {
			return Promise.reject(new Error('call initialize first before doing DB queries'))
		}
		let promise = new Promise((resolve, reject) => {
			connection.query(sql, values, (err, result) => {
				if (err) {
					if (!isSuppressErrorLog) {
						if (err.code === 'ER_DUP_ENTRY') {
							console.error('-- duplicate entry');
						} else {
							console.error(sql, values, err);
						}
					}
					reject(err);
					return;
				}
				//console.log('sql time:', timer.stamp(), ' - ', sql);
				resolve(result);
			});
		});

		return promise;
	}

	function recreateTables (connection) {
		return new Promise((resolve, reject) => {
			console.log("Connection with DB established");
			// drop all tables
			query("DROP TABLE IF EXISTS photo_tag").catch(reject);
			query("DROP TABLE IF EXISTS tag").catch(reject);
			query("DROP TABLE IF EXISTS photo").catch(reject);
			query("DROP TABLE IF EXISTS tag_group").catch(reject);
			query("DROP TABLE IF EXISTS photo_stats").catch(reject);

			let sqlCreatePhotoStatsTable = "CREATE TABLE if not exists photo_stats " +
				"( listingLastUpdateTime DATETIME NOT NULL, tagLastUpdateTime DATETIME NOT NULL, indexLastUpdateTime DATETIME NOT NULL, photoIdLastIndex INT NOT NULL)";
			let sqlInsertPhotoStats = "INSERT INTO photo_stats (listingLastUpdateTime, tagLastUpdateTime, indexLastUpdateTime, photoIdLastIndex) VALUES (SYSDATE(), SYSDATE(), SYSDATE(), 0)";
			let sqlCreatePhotoTable = "CREATE TABLE if not exists photo " +
				"( id INT NOT NULL AUTO_INCREMENT, date DATETIME NOT NULL, path VARCHAR(255) NOT NULL, description VARCHAR(255) NULL, rating INT NOT NULL DEFAULT 3, " +
				"PRIMARY KEY (id), INDEX IX_DATE (date), UNIQUE(path))";
			let sqlCreateGroupTable = "CREATE TABLE if not exists tag_group ( id INT NOT NULL AUTO_INCREMENT, name VARCHAR(32) NOT NULL, PRIMARY KEY (id), UNIQUE(name) )";
			let sqlCreateTagTable = "CREATE TABLE if not exists tag ( id INT NOT NULL AUTO_INCREMENT, name VARCHAR(32) NOT NULL, groupid INT NOT NULL, " +
				"FOREIGN KEY (groupid) REFERENCES tag_group(id), PRIMARY KEY (id), UNIQUE(name) )";
			let sqlCreateLinkTable = "CREATE TABLE if not exists photo_tag ( photoid INT NOT NULL , tagid INT NOT NULL, " +
				"INDEX IX_PHOTO_ID (photoid), INDEX IX_TAG_ID (tagid), UNIQUE(photoid, tagid), FOREIGN KEY (photoid) REFERENCES photo(id), FOREIGN KEY (tagid) REFERENCES tag(id))";
			query(sqlCreatePhotoStatsTable, createDbHandle('table photo_stats created', () => {
				query(sqlInsertPhotoStats, createDbHandle('insert photo_stats', () => {
					query(sqlCreatePhotoTable, createDbHandle('table photo created', () => {
						query(sqlCreateGroupTable, createDbHandle('table tag_group created', () => {
							query(sqlCreateTagTable, createDbHandle('table tag created', () => {
								query(sqlCreateLinkTable, createDbHandle('table photo_tag created', () => {
									resolve(connection)
								})).catch(reject);
							})).catch(reject);
						})).catch(reject);
					})).catch(reject);
				})).catch(reject);
			})).catch(reject);
		})
	}

	module.exports.initialize = function (database) {
		let db = database ? database : 'photoindex2'
		connection = mysql.createConnection({
			host: 'kanji',
			user: 'photoindex',
			password: 'dc0b5jjF7bNjarkA',
			database: db
		});
		console.log('connecting to db: ', db)

		return new Promise((resolve, reject) => {
			connection.connect((err) => {
				if (err) {
					reject(err);
					return;
				}
				resolve(connection);
			});
		})
	};

	module.exports.recreateTables = recreateTables;

	function addPhotoBatch (rows) {
		return query("INSERT INTO photo (date, path) VALUES ?;", [rows]).then((result) => {
			// console.log('batch inserted: ', rows.length);
			// console.log('batch ids: ', result);
		});
	}

	function addPhotoBatchSafe (rows) {
		let batchSize = 10
		if (rows.length < batchSize) {
			return addPhotoBatch(rows)
		}
		let promise = addPhotoBatch(rows.splice(0, batchSize))
		if (rows.length === 0) {
			return promise
		}
		return addPhotoBatchSafe(rows)
	}

	module.exports.addPhotoBatchSafe = addPhotoBatchSafe
	module.exports.addPhotoBatch = addPhotoBatch

	module.exports.updatePhoto = function (row) {
		return query("UPDATE photo SET date = ? WHERE id = ?;", row).then((result) => {
			return result.insertId;
		});
	};

	module.exports.touchIndexDate = function () {
		return query("UPDATE photo_stats SET listingLastUpdateTime = SYSDATE()")
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

	function getTagGroup (tagGroup) {
		return new Promise((resolve, reject) => {
				query("SELECT id FROM tag_group WHERE name = ?;", [[[tagGroup]]]).then((row) => {
					if (row.length === 0) {
						resolve(null);
					}
					resolve(row[0].id);
				}).catch(reject)
			}
		);
	}

	function addTagGroup (tagGroup) {
		return new Promise((resolve, reject) => {
				query("INSERT INTO tag_group (name) VALUES ?;", [[[tagGroup]]], true).then((result) => {
					resolve(result.insertId)
				}).catch(reject)
			}
		);
	}

	module.exports.getTagGroup = getTagGroup

	module.exports.addTagGroup = addTagGroup

	function addOrGetTagGroup (tagGroup) {
		return new Promise((resolve, reject) => {
			addTagGroup(tagGroup).then(resolve).catch(err => {
				if (err.code !== 'ER_DUP_ENTRY') {
					console.error('error while trying to insert tag_group: ', tagGroup, err);
					reject(err);
					return;
				}
				getTagGroup(tagGroup).then(id => {
					if (id) {
						resolve(id);
						return;
					}
					reject(new Error('could not find tag group nor insert it'))
				});

			})
		});
	}

	function wrapFunctionInCache (fnc) {
		return function (arg) {
			let key = JSON.stringify(arguments)
			console.log('checking cache!')
			if (cache.get(key)) {
				console.log('cache hit!')
				return Promise.resolve(cache.get(key))
			}
			return fnc.apply(this, arguments).then(value => {
				console.log('populating cache', key)
				cache.put(key, value)
				return value
			})
		};
	}

	module.exports.addOrGetTagGroup = wrapFunctionInCache(addOrGetTagGroup)

	module.exports.addOrGetTag = function (tag, tagGroupId) {
		let cacheUrl = 'tag/' + tag;
		let cachedResponse = cache.get(cacheUrl);
		if (cachedResponse) {
			// console.log('reading tag from cache');
			return Promise.resolve(cachedResponse);
		}

		return new Promise((resolve, reject) => {
			query("INSERT INTO tag (name, groupid) VALUES ?;", [[[tag, tagGroupId]]], true).then((result) => {
				cache.put(cacheUrl, result.insertId);
				resolve(result.insertId)
			}).catch((err) => {
				if (err.code !== 'ER_DUP_ENTRY') {
					console.error('error while trying to insert tag: ', tag, err);
					reject(err);
					return;
				}
				//console.error('tag already exists will query', tag, err);
				query("SELECT id FROM tag WHERE name = ?", [[[tag]]]).then((row) => {
					if (row.length === 0) {
						console.error('cannot find tag: ', tag, err);
						reject(new Error('cannot find tag: ' + tag));
						return;
					}
					cache.put(cacheUrl, row[0].id);
					resolve(row[0].id);
				}).catch((err) => {
					reject(err);
				})
			}).catch(reject);
		})
	};

	function queryTag (tags) {
		let sqlMatch = tags.map(() => 'name like ?').join(' OR ');
		query("SELECT id FROM tag WHERE " + sqlMatch, [[tags]]);
	}

	module.exports.queryTag = queryTag;

	module.exports.readAllPhotos = function () {
		return query("SELECT * FROM photo ORDER BY date DESC");
	};

	module.exports.readAllPhotosReversed = function () {
		return query("SELECT * FROM photo ORDER BY date ASC");
	};

	module.exports.queryStats = function () {
		let promises = []
		promises.push(query("SELECT count(*) as photoCount FROM photo"))
		promises.push(query("SELECT name FROM tag"))
		return Promise.all(promises)
	};

	function getSqlTagMatch (tagLabels) {
		if (tagLabels.length === 0) {
			return '';
		}

		return tagLabels.map(() => 't.name like ?').join(' OR ');
	}

	function getSqlDateMatch (dateStr, tagLabels) {
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

	function getSqlMatchCriteria (queryTags) {
		let tagDates = queryTags.filter(isDateTag);
		let tagLabels = queryTags.filter((tag) => !isDateTag(tag)).map((tag) => '%' + tag + '%');
		if (tagDates.length === 0) {
			return {
				sql: getSqlTagMatch(tagLabels),
				values: tagLabels,
				hasTagLabels: tagLabels.length > 0
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

	function isDateTag (tag) {
		return /^\d{4,8}$/.test(tag);
	}

	function fixPhotoPathsForLocalhost (rows) {
		return rows.map(row => {
			row.path = row.path.replace(/\\/g, '/').replace('//kanji', '/volume1');
			return row;
		});
	}

	module.exports.queryPhotos = function (queryTags) {
		if (queryTags === undefined || queryTags.length === 0) {
			return query("SELECT * FROM photo ORDER BY date DESC");
		}

		let sqlMatch = getSqlMatchCriteria(queryTags);

		let joinTagTable = !sqlMatch.hasTagLabels ? '' : // let joinTagTable =
			'LEFT JOIN photo_tag pt ON pt.photoId = p.id INNER JOIN tag t ON pt.tagId = t.id';
		let sql = "SELECT p.* FROM photo p " + joinTagTable + " WHERE " + sqlMatch.sql +
			" ORDER BY p.date DESC";

		return query(sql, sqlMatch.values)
	};

	module.exports.readAllPhotosPaths = function () {
		return query("SELECT id, path FROM photo")
	};

	module.exports.readTagsForPhoto = function (id) {
		return query(
			"SELECT tag.name FROM photo_tag INNER JOIN tag on photo_tag.tagId = tag.id WHERE photoId = ?;",
			[id]);
	};

	module.exports.readPhotoById = function (id) {
		return new Promise((resolve, reject) => {
			query("SELECT * FROM photo where id = ?", [id]).then((rows) => {
				if (rows.length === 0) {
					reject(new Error('could not find photo for id' + id));
					return;
				}
				resolve(rows[0]);
			}).catch(err => {
				reject(err);
			});
		})
	};
}());
