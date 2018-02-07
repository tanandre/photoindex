"use strict";

let fs = require('fs');
let path = require('path');

let log = require('./public/lib/log');
let Deferred = require('./public/lib/Deferred');
let dbIO = require('./server/DatabaseIO');
let dateUtil = require('./server/DateUtil');
let fileCrawler = require('./server/FileCrawler');

if (process.argv.length < 3) {
	console.error('please specify the folder to index');
	return
}
let args = process.argv.filter(s => !s.startsWith('--'))
let folder = process.argv[2];
let database = args[3];
let recreateDb = process.argv.indexOf('--db') !== -1;
log('start indexing folder: ' + folder)

function handleError (file) {
	return function (err) {
		console.log('file not processed: ', file)
		console.error(err)
	}
}


function addPhotoToDb (file, tagId) {
	let deferred = new Deferred();
	let promise1 = dateUtil.readDateFromFile(file);
	promise1.then(date => {
		let promise2 = dbIO.addPhoto([date, file]);
		promise2.then(photoId => {
			let promise3 = dbIO.addPhotoTag(photoId, tagId)
			promise3.then(() => {
				deferred.resolve();
			}).catch((err) => {
				deferred.reject(new Error('could not add tag for photo: ' + file));
			})
		}).catch((err) => {
			handleError(file)
			deferred.reject(new Error('could not add photo: ' + file));
		})
	}).catch((err) => {
		handleError(file)
		deferred.reject(new Error('could not read date from photo: ' + file));
	});
	return deferred;
}

function indexFolder (folder) {
	log('indexFolder: ' + folder);
	let deferredIndexer = new Deferred();
	dbIO.addOrGetTag('dateUnconfirmed').then(tagId => {
		log('start indexing folder: ' + folder);
		fileCrawler.findFiles(folder).then(files => {
			// log('retrieving date for photos: ' + files.length);

			let datePromiseList = files.map(file => {
				let deferred = new Deferred();
				let readDateFromFile = dateUtil.readDateFromFile(file);
				readDateFromFile.then(date => {
					deferred.resolve([date, file])
				}, deferred.reject);
				return deferred;
			})
			Deferred.all(datePromiseList).then(results => {
				// log('starting batch insert: ' + results.length);

				dbIO.addPhotoBatchSafe(results).then(() => {
					log('batch insert completed: ' + folder + ' photos:' + results.length)
					deferredIndexer.resolve();
				}).catch(err => {
					console.error('error inserting', err)
					deferredIndexer.reject(err);
				})
			})
		})
	});
	return deferredIndexer;
}

function indexFolderRoot (rootFolder) {
	let findSubdirs = p => fs.readdirSync(p).filter(f => fs.statSync(path.join(p, f)).isDirectory())
	let subdirs = findSubdirs(rootFolder);
	let promises = subdirs.filter(s => s !== '@eaDir').map(subdir => {
		return indexFolder(path.join(rootFolder, subdir))
	})
	return Deferred.all(promises)
}


dbIO.initialize(database).then(connection => {
	if (recreateDb) {
		dbIO.recreateTables(connection).then(() => {
			indexFolderRoot(folder).then(() => {
				// indexFolder(folder).then(() => {
				process.exit(0)
			}).catch(err => {
				console.error(err)
				process.exit(1)
			})
		});
	} else {
		indexFolderRoot(folder).then(() => {
			// indexFolder(folder).then(() => {
			process.exit(0)
		}).catch(err => {
			console.error(err)
			process.exit(1)
		})
	}
}, console.error);

