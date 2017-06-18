'use strict';

class Timer {

	constructor() {
		this.date = new Date();
	}

	stamp() {
		return new Date().getTime() - this.date.getTime() + "ms.";
	}
}

if (module) {
	module.exports = Timer;
}