"use strict";

global.isOnKanji = require('os').hostname() === 'kanji';

let fs = require('fs');
let path = require('path');
let getExif = require('exif-async');
let util = require('./public/lib/util');
let Deferred = require('./public/lib/Deferred');
let log = require('./public/lib/log');
let dbIO = require('./server/DatabaseIO');
let photoCrawler = require('./server/PhotoCrawler');

log('starting');

function isImageFile(file) {
	return file.toLowerCase().indexOf('.jpg') !== -1 || file.toLowerCase().indexOf('.jpeg') !== -1;
}

function isVideoFile(file) {
	return file.toLowerCase().indexOf('.mp4') !== -1 || file.toLowerCase().indexOf('.avi') !== -1;
}

// '2013:05:28 21:26:28'.replace(':', '-').replace(':', '-')
function parseDate(dateStr) {
	return new Date(Date.parse(dateStr.replace(':', '-').replace(':', '-')));
}

function getLatestDate(dates) {
	return new Date(Math.max.apply(null, dates));
}

function getOldestDate(dates) {
	return new Date(Math.min.apply(null, dates));
}

function parseDateFileName(fileNamePart) {
	return fileNamePart.slice(0, 4) + "-" + fileNamePart.slice(4, 6) + "-" + fileNamePart.slice(6);
}

function parseTimeFileName(fileNamePart) {
	return fileNamePart.slice(0, 2) + ":" + fileNamePart.slice(2, 4) + ":" + fileNamePart.slice(4);
}

function getDateTimeFromFileName(fileName) {
	if (/(19|20)\d{6}.\d{6}/.test(fileName)) {
		let regex = /((?:19|20)\d{6}).{0,1}?(\d{6})/.exec(fileName);
		let dateStr = parseDateFileName(regex[1]);
		let timeStr = parseTimeFileName(regex[2]);

		let date = new Date(Date.parse(dateStr + ' ' + timeStr));
		return date;
	}
	let dateStr = /((?:19|20)\d{6})/.exec(fileName)[1];
	return new Date(Date.parse(parseDateFileName(dateStr)));
}

function readDateFromFile(file, done) {
	let deferred = new Deferred();
	fs.stat(file, function(err, stats) {
		if (err) {
			console.error(err);
			deferred.reject(err);
			return;
		}
		let fileName = path.basename(file);
		let dates = [stats.ctime, stats.mtime];
		if (/(19|20)\d{6}/.test(fileName)) {
			// let dateStr = /((?:19|20)\d{6})/.exec(fileName)[1];
			// // TODO add time parsing to improve precision of date
			// //console.log(dateStr.slice(0, 4) + "-" + dateStr.slice(4, 6) + "-" + dateStr.slice(6), fileName);
			// let dateString = dateStr.slice(0, 4) + "-" + dateStr.slice(4, 6) + "-" + dateStr.slice(6);
			// let date = new Date(Date.parse(dateString));
			// console.log('parsed date: ', dateString, date);
			// dates.push(date);

			dates.push(getDateTimeFromFileName(fileName));
		}

		//done(getOldestDate(dates));
		deferred.resolve(getOldestDate(dates));
	});
	return deferred.promise;
}
let dateUnconfirmedTag = 'dateUnconfirmed';

function updatePhotoInfoUsingExif(max) {
	dbIO.readAllPhotosPaths().then((rows) => {
		let paths = rows.map(row => row.path);
		paths.forEach(path => {
			getExif(file).then((exif) => {
				process.stdout.write(".");
				let deviceTag = exif.image.Model ? exif.image.Model.replace(/\0/g, '') : null;
				let exifDate = exif.exif.CreateDate;
				if (exifDate) {
					dbIO.updatePhoto([exifDate, path]).then((photoId) => {
						if (deviceTag) {
							dbIO.addOrGetTag(deviceTag).then((tagId) => {
								dbIO.addPhotoTag(photoId, tagId);
							});
						}
					});
				} else {
					readDateFromFile(file).then((date) => {
						let estimateDate = date;
						if (exif.image.ModifyDate) {
							estimateDate = getOldestDate([date, parseDate(exif.image.ModifyDate)]);
						}

						dbIO.updatePhoto([estimateDate, path]).then((photoId) => {
							// console.log('----- adding 2 tags for photo ', file, photoId);
							if (deviceTag) {
								dbIO.addOrGetTag(deviceTag).then((tagId) => {
									dbIO.addPhotoTag(photoId, tagId);
								});
							}
							dbIO.addOrGetTag(dateUnconfirmedTag).then((tagId) => {
								dbIO.addPhotoTag(photoId, tagId);
							});
						});
					});
				}

			}, (err) => {
				// console.error('no exif header found reading date from file', file);
				readDateFromFile(file).then(date => {
					dbIO.addPhoto(file, date).then((photoId) => {
						dbIO.addOrGetTag(dateUnconfirmedTag).then((tagId) => {
							dbIO.addPhotoTag(photoId, tagId);
						});
					});
				});
			});

		});
	});

}

function searchPhotos(dir, max) {
	let deferred = new Deferred();

	let count = max;
	dbIO.readAllPhotosPaths().then((rows) => {
		let paths = rows.map(row => row.path);

		photoCrawler.indexPhotosInFolder(dir).then((results) => {
			log('starting to search for photos');
			let exifLoadCount = 0;
			let isIndexingDone = false;
			let rows = results.filter(fileItem => paths.indexOf((fileItem.file)) === -1)
				.filter((fileItem) => isImageFile(fileItem.file))
				.map((fileItem) => {
					return [fileItem.stats.ctime, fileItem.file];
				});
			// console.log(rows);
			if (rows.length === 0) {
				console.log('nothing to add');
				deferred.resolve();
				return;
			}

			let batchSize = 1000;
			if (rows.length < batchSize) {
				dbIO.addPhotoBatch(rows).then(() => {
					deferred.resolve();
				});
				return;
			}

			let promiseList = [];
			let batchCount = Math.floor(rows.length / batchSize);

			for (let i = 0; i < batchCount; i++) {
				let promise = dbIO.addPhotoBatch(rows.slice(i * batchSize, (i + 1) * batchSize));
				promiseList.push(promise);
			}

			if (rows.length % batchSize !== 0) {
				let promise = dbIO.addPhotoBatch(rows.slice(batchCount * batchSize, rows.length));
				promiseList.push(promise);
			}
			let deferredAll = Deferred.all(promiseList);
			deferredAll.then((result) => {
				deferred.resolve(result);
			}, error => {
				deferred.reject(error);
			});
		});
	}, (err) => {
		console.error(err);
		deferred.reject(err);
	});

	return deferred.promise;

}

function readExif(row) {
	let deferred = new Deferred();
	let file = row.path.replace(/\\/g, '/').replace('//kanji', '/volume1');
	let photoId = row.id;
	getExif(file).then((exif) => {
		process.stdout.write(".");
		let deviceTag = exif.image.Model ? exif.image.Model.replace(/\0/g, '') : null;
		let exifDate = exif.exif.CreateDate;
		if (exifDate) {
			dbIO.updatePhoto([exifDate, photoId]);
			if (deviceTag) {
				dbIO.addOrGetTag(deviceTag).then((tagId) => {
					dbIO.addPhotoTag(photoId, tagId);
				});
			}
		} else {
			readDateFromFile(file).then(date => {
				let estimateDate = date;
				if (exif.image.ModifyDate) {
					estimateDate = getOldestDate([date, parseDate(exif.image.ModifyDate)]);
				}

				dbIO.updatePhoto([estimateDate, photoId]);
				if (deviceTag) {
					dbIO.addOrGetTag(deviceTag).then((tagId) => {
						dbIO.addPhotoTag(photoId, tagId);
					});
				}
				dbIO.addOrGetTag(dateUnconfirmedTag).then((tagId) => {
					dbIO.addPhotoTag(photoId, tagId);
				});
			});
		}
		deferred.resolve();

	}, (err) => {
		readDateFromFile(file).then(date => {
			dbIO.updatePhoto([date, photoId]);
			dbIO.addOrGetTag(dateUnconfirmedTag).then((tagId) => {
				dbIO.addPhotoTag(photoId, tagId);
			});
		});
		deferred.resolve();
	});
	return deferred;
}

function splitArray(arr, size) {
	if (arr.length <= size) {
		return [arr];
	}

	let chunks = [];
	for (let i = 0; i < arr.length; i += size) {
		chunks.push(arr.slice(i, i + size));
	}
	return chunks;
}

function readExifForPhotoBatch(batch) {
	let deferred = new Deferred();
	let deferredList = batch.map(row => {
		process.stdout.write("+");
		return readExif(row);
	});

	Deferred.all(deferredList).then(() => {
		deferred.resolve();
	}, () => {
		deferred.reject();
	});
	return deferred.promise;
}

function indexPhotos() {
	let deferred = new Deferred();

	dbIO.readAllPhotosPaths().then(rows => {
		log('starting to index photos');
		let filteredRows = rows.slice(11100, 15000);

		if (filteredRows.length === 0) {
			console.log('nothing to index');
			deferred.resolve();
			return;
		}

		let rowInChunks = splitArray(filteredRows, 1000);

		function readExifRecursive(chunks, index, deferred) {
			console.log('reading exif for batch:', index, '/', chunks.length);
			readExifForPhotoBatch(chunks[index]).then(() => {
				if (++index >= chunks.length) {
					console.log('done reading chunks', index, chunks.length);
					deferred.resolve();
					return;
				}
				setTimeout(() => {
					readExifRecursive(chunks, index, deferred);
				});
			})
		}

		readExifRecursive(rowInChunks, 0, deferred);
	}, (err) => {
		console.error(err);
		deferred.reject(err);
	});

	return deferred.promise;

}

dbIO.initialize((err, connection) => {
	if (err) {
		console.error(err);
		return;
	}

	// dbIO.createTables(connection, () => {
	// 	console.log('done creating tables');
	// 	indexPhotos(imageDir, 100);
	// });
	// indexPhotos(imageDir + '2001\\', 100).then(data => {
	// 	console.log('done 2001')
	// });
	indexPhotos().then(() => {
		log('--');
		log('done indexing')
	});

	// searchPhotos(imageDir + '2003\\', 100);
	// searchPhotos(imageDir + '2002\\', 100);
	// searchPhotos(imageDir + '2005\\', 100);
});

