"use strict";

let Deferred = require('../public/lib/Deferred');
let log = require('../public/lib/log');
let fs = require('fs');
let path = require('path');

function parseDateFileName(fileNamePart) {
	return fileNamePart.slice(0, 4) + "-" + fileNamePart.slice(4, 6) + "-" + fileNamePart.slice(6);
}

function parseTimeFileName(fileNamePart) {
	return fileNamePart.slice(0, 2) + ":" + fileNamePart.slice(2, 4) + ":" + fileNamePart.slice(4);
}


function getOldestDate(dates) {
	return new Date(Math.min.apply(null, dates));
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


module.exports.readDateFromFile = function (file) {
	let deferred = new Deferred();
	fs.stat(file, function (err, stats) {
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

		deferred.resolve(getOldestDate(dates));
	});
	return deferred.promise;
}
