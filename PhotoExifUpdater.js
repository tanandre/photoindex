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

/**
 * calls a function on an array but only X at the same time
 * @param arr
 * @param fnc
 * @param batchSize
 * @returns {Promise}
 */
function throttledProcess(arr, fnc, batchSize) {
	return new Promise((resolve, reject) => {
		function doProcess(arr) {
			if (arr.length === 0) {
				resolve()
				return;
			}
			return arr.splice(0, batchSize).map(item => {
				return fnc(item)
			})
		}

		let promiseList = doProcess(arr)
		Promise.all(promiseList).then(() => {
			doProcess(arr)
		}).catch(reject)
	})
}


function updateExifInBatches() {
	let promise = new Promise(function (resolve, reject) {
		dbIO.readAllPhotos().then(data => {
			log('found photos: ' + data.length)

			function fnc(row) {
				return new Promise((res, rej) => {
					getExif(row.path).then(exif => {
						dbIO.updatePhoto([exif.exif.CreateDate, row.id]).then(res).catch(rej)
					}).catch(rej)
				});
			}

			let promise = throttledProcess(data.filter(row => isImage(row)), fnc, 10);
			promise.then(resolve).catch(reject)
		}).catch(reject)
	})
	return promise
}


function updateExif() {
	let promise = new Promise(function (resolve, reject) {
		dbIO.readAllPhotos().then(data => {
			log('found photos: ' + data.length)

			let promiseList = data.filter(row => isImage(row)).slice(0, 100).map(row => {
				//console.log('starting to read exif for: ', row.path)
				return new Promise((internResolve, internReject) => {
					getExif(row.path).then(exif => {
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
	updateExifInBatches().then(() => {
		// indexFolder(folder).then(() => {
		process.exit(0)
	}).catch(err => {
		console.error(err)
		process.exit(1)
	})
	// });
}, console.error);

