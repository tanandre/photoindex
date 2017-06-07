let fs = require('fs');
let path = require('path');
let getExif = require('exif-async');
let util = require('./public/lib/util');
let Deferred = require('./public/lib/Deferred');
let log = require('./public/lib/log');
let dbIO = require('./server/DatabaseIO');
let photoCrawler = require('./server/PhotoCrawler');
// let imageDir = "c:\\andre\\afdruk\\";
<<<<<<< HEAD
let imageDir = "\\\\kanji\\photo\\phone\\jq\\galaxysii_1\\";
=======
let imageDir = "\\\\kanji\\photo\\phone\\dre\\galaxys1\\andre\\";
>>>>>>> efc7f4a37a7f286a3a5b14b199b05e1257afa465
let tempThumbnailDir = "c:\\andre\\afdruk\\temp\\";
let nfsimageDir = "\\\\kanji\\photo\\2006\\2006-03-11 Eerste date\\";
let nfsimageDir2009 = "\\\\kanji\\photo\\2009\\";
let nfsimageDir2016 = "\\\\kanji\\photo\\2016\\";
let nfsimageDirOldPhone = "\\\\kanji\\photo\\phone\\phonedata";
//let nfsimageDir = "\\\\kanji\\photo\\collage\\";

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
	console.log('sorting:', new Date(Math.min.apply(null, dates)), dates);
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
		console.log('parsed date time: ', dateStr + ' ' + timeStr, date);
		return date;
	}
	let dateStr = /((?:19|20)\d{6})/.exec(fileName)[1];
	return new Date(Date.parse(parseDateFileName(dateStr)));
}

function readDateFromFile(file, done) {
	fs.stat(file, function(err, stats) {
		if (err) {
			console.error(err);
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

		done(getOldestDate(dates));
	});
}
let dateUnconfirmedTag = 'dateUnconfirmed';
function indexPhotos(dir, max) {

	let count = max;
	dbIO.readAllPhotosPaths().then(function(rows) {
		let paths = rows.map(function(row) {
			return row.path;
		});

		photoCrawler.indexPhotosInFolder(dir).then(function(results) {
			log('starting to index');
			let exifLoadCount = 0;
			let isIndexingDone = false;

			results.forEach((file) => {
				if (isImageFile(file)) {
					if (paths.indexOf((file)) > -1) {
						// console.log('already indexed: ');
						return;
					}

					if (count-- < 1) {
						if (count === 0) {
							log('stopping indexing of files, max reached: ' + max);
						}
						return;
					}

					process.stdout.write("+");
					exifLoadCount++;
					getExif(file).then((exif) => {
						if (--exifLoadCount === 0 && isIndexingDone) {
							log('done indexing');
						}
						process.stdout.write(".");
						let deviceTag = exif.image.Model ? exif.image.Model.replace(/\0/g, '') : null;
						let exifDate = exif.exif.CreateDate;
						if (exifDate) {
							dbIO.addPhoto(file, exifDate).then((photoId) => {
								if (deviceTag) {
									dbIO.addOrGetTag(deviceTag).then((tagId) => {
										dbIO.addPhotoTag(photoId, tagId);
									});
								} else {
									console.log('photo has no deviceTag', file);
								}
							});
						} else {
							// console.error(
							// 	'exif header present but no CreateDate attribute, reading date from file',
							// 	file);
							readDateFromFile(file, function(date) {
								let estimateDate = date;
								if (exif.image.ModifyDate) {
									console.log('sorting for file: ', file);
									estimateDate =
										getOldestDate([date, parseDate(exif.image.ModifyDate)]);
								} else {
									console.log('')
								}

								dbIO.addPhoto(file, estimateDate).then((photoId) => {
									// console.log('----- adding 2 tags for photo ', file, photoId);
									if (deviceTag) {
										dbIO.addOrGetTag(deviceTag).then((tagId) => {
											dbIO.addPhotoTag(photoId, tagId);
										});
									} else {
										console.log('photo has no deviceTag', file);
									}
									dbIO.addOrGetTag(dateUnconfirmedTag).then((tagId) => {
										dbIO.addPhotoTag(photoId, tagId);
									});
								});
							});
						}

					}, (err) => {
						if (--exifLoadCount === 0 && isIndexingDone) {
							console.log('');
							log('done indexing');
						}
						// console.error('no exif header found reading date from file', file);
						readDateFromFile(file, function(date) {
							dbIO.addPhoto(file, date).then((photoId) => {
								dbIO.addOrGetTag(dateUnconfirmedTag).then((tagId) => {
									dbIO.addPhotoTag(photoId, tagId);
								});
							});
						});
					});
				}
			});
			isIndexingDone = true;
		});
	}, (err) => {
		console.error(err);
	});

}

dbIO.initialize((err, connection) => {
	if (err) {
		console.error(err);
		return;
	}

	dbIO.createTables(connection, () => {
		console.log('done creating tables');
		indexPhotos(imageDir, 500);
	});
	// indexPhotos(imageDir, 500);

});

