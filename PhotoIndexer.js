"use strict";

let fs = require('fs');
let log = require('./public/lib/log');
let dbIO = require('./server/DatabaseIO');
let dateUtil = require('./server/DateUtil');
let fileCrawler = require('./server/FileCrawler');

if (process.argv.length < 3) {
	console.error('please specify the folder to index');
	return
}

let folder = process.argv[2];
log('start indexing folder: ' + folder)

function handleError(file) {
	return function (err) {
		console.log('file not processed: ', file)
		console.error(err)
	}
}

dbIO.initialize().then(connection => {
	// dbIO.recreateTables(connection).then(() => {
	dbIO.addOrGetTag('dateUnconfirmed').then(tagId => {
		log('--');
		fileCrawler.findFiles(folder).then(files => {
			log('inserting photos: ' + files.length);
			files.forEach(file => {
				// log(file)
				dateUtil.readDateFromFile(file).then(date => {
					dbIO.addPhoto([date, file]).then(photoId => {
						dbIO.addPhotoTag(photoId, tagId)
					}, handleError(file))
				}, handleError(file));
			})

			// process.exit(0)
		})
		log('--');
	});
	// });
}, console.error);

