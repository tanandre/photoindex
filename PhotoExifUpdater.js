"use strict";

let log = require('./public/lib/log');
let Deferred = require('./public/lib/Deferred');
let dbIO = require('./server/DatabaseIO');
let getExif = require('exif-async');

log('start reading exif data')

function isImage(row) {
	let fileName = row.path.toLowerCase();
	return fileName.endsWith('.jpg') || fileName.endsWith('.jpeg');
}

function updatePhotoExifData(photoId, exif) {
	return new Promise((resolve, reject) => {

		let deviceTag = exif.image.Model ? exif.image.Model.replace(/\0/g, '') : null;
		let exifDate = exif.exif.CreateDate;
		log('updating photo date: ' + photoId + ' ' + exifDate)

		let deferred1 = dbIO.updatePhoto([exifDate, photoId])
		let deferredAll = [deferred1]
		if (deviceTag) {
			deferredAll.push(dbIO.addOrGetTag(deviceTag).then((tagId) => {
				dbIO.addPhotoTag(photoId, tagId);
			}));
		}
		Deferred.all(deferredAll).then(resolve).catch(reject)
	});
}

function updateExif() {
	let promise = new Promise(function (resolve, reject) {
		dbIO.readAllPhotos().then(data => {
			log('found photos: ' + data.length)

			let promiseList = data.filter(row => isImage(row)).map(row => {
				//console.log('starting to read exif for: ', row.path)
				return new Promise((internResolve, internReject) => {
					getExif(row.path).then(exif => {
						//		console.log('read exif for: ', row.path)
						// 	def.resolve([row, exif])
						// internResolve({row: row, exif: exif});
						internResolve([exif.exif.CreateDate, row.id]);
					}).catch(err => {
						console.error('error reading exif for ', row.path)
						internResolve(null)
					})
				})
			})
			Promise.all(promiseList).then((results) => {
				// console.log(results)
				let validResults = results.filter(result => result !== null);
				let promises = validResults.map(result => {
					return updatePhotoExifData(result.row.id, result.exif)
					// console.log()
				})
				Promise.all(promises).then(resolve).catch(reject)
			}).catch(reject)
		}).catch(reject)
	})
	return promise
}


dbIO.initialize().then(connection => {
	// dbIO.recreateTables(connection).then(() => {
	updateExif().then(() => {
		// indexFolder(folder).then(() => {
		process.exit(0)
	}).catch(err => {
		console.error(err)
		process.exit(1)
	})
	// });
}, console.error);

