"use strict";

let log = require('./public/lib/log');
let dbIO = require('./server/DatabaseIO');
let getExif = require('exif-async');
global.isOnKanji = true;

log('start reading exif data')

let args = process.argv.filter(s => !s.startsWith('--'))
let database = args[2];


function isImage (row) {
	let fileName = row.path.toLowerCase();
	return fileName.endsWith('.jpg') || fileName.endsWith('.jpeg');
}

function getDeviceTag (exif) {
	let model = exif.image.Model ? exif.image.Model.replace(/\0/g, '') : null;
	if (model) {
		let make = exif.image.Make.replace(/\0/g, '')
		if (make) {
			if (model.toLowerCase().indexOf(make.toLowerCase()) !== -1) {
				return model.trim()
			}
			return make.trim() + ' ' + model.trim()
		}
		return model.trim()
	}
	return null
}

function updatePhotoExifData (photoId, exif, tagGroupId) {
	return new Promise((resolve, reject) => {

		let deviceTag = getDeviceTag(exif);
		let exifDate = exif.exif.CreateDate;

		let promiseAll = []
		if (exifDate) {
			promiseAll.push(dbIO.updatePhoto([exifDate, photoId]))
		}
		if (deviceTag) {
			let promise = new Promise((resolve, reject) => {
				dbIO.addOrGetTag(deviceTag, tagGroupId).then((tagId) => {
					dbIO.addPhotoTag(photoId, tagId).then(result => {
						resolve(result)
					}).catch(reject);
				}).catch(reject);
			})
			promiseAll.push(promise)
		}
		Promise.all(promiseAll).then(resolve).catch(reject)
	});
}

/**
 * calls a function on an array but only X at the same time
 * @param arr the array to iteratively call the function for
 * @param fnc must return a promise
 * @param batchSize the number to process simultaneously
 * @returns {Promise}
 */
function throttledProcess (arr, fnc, batchSize) {
	return new Promise((resolve, reject) => {
		function recurse () {
			let promiseList = arr.splice(0, batchSize).map(item => {
				return fnc(item)
			})
			Promise.all(promiseList).then(() => {
				console.log('processed batch', promiseList.length, ' arr: ', arr.length)
				if (arr.length === 0) {
					resolve()
					return;
				}
				recurse()
			}).catch(reject)
		}

		recurse()
	})
}


function updateExifInBatches () {
	let promise = new Promise(function (resolve, reject) {
		dbIO.getLastPhotoIdIndex().then(lastIndex => {
			dbIO.addOrGetTagGroup('Camera').then(tagGroupId => {
				dbIO.readAllPhotosFromLastIndex(lastIndex).then(data => {
					// dbIO.queryTag(['2014']).then(data => {
					log('found photos: ' + data.length)

					let lastDbIndex = data.length === 0 ? -1 : Math.max.apply(null, data.map(row => row.id))

					function fnc (row) {
						return new Promise((res, rej) => {
							getExif(row.path).then(exif => {
								updatePhotoExifData(row.id, exif, tagGroupId).then(res).catch(err => {
									console.error('error storing exif:', row.path, err)
									res()
								})
							}).catch(err => {
								console.error('error reading exif for ', row.path)
								res()
							})
						});
					}

					let promise = throttledProcess(data.filter(row => isImage(row)), fnc, 100);
					promise.then(() => {
						resolve(lastDbIndex)
					}).catch(reject)
				}).catch(reject)
			}).catch(reject)
		}).catch(reject)
	});
	return promise
}

dbIO.initialize(database).then(() => {
	updateExifInBatches().then(lastIndex => {
		log('-- all done --')
		if (lastIndex === -1) {
			process.exit(0)
		}
		dbIO.setLastPhotoIdIndex(lastIndex).then(() => {
			process.exit(0)
		}).catch(err => {
			console.error(err)
			process.exit(1)
		})
	}).catch(err => {
		console.error(err)
		process.exit(1)
	})
}).catch(console.error);

