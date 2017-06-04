'use strict';

class Deferred {

	static createResolved(data) {
		let deferred = new Deferred();
		deferred.resolve(data);
		return deferred;
	}

	static createRejected(err) {
		let deferred = new Deferred();
		deferred.reject(err);
		return deferred;
	}

	constructor() {
		this.isResolved = false;
		this.isRejected = false;
		this.listeners = [];
	}

	then(onOk, onError, onProgress) {
		let listener = [onOk, onError, onProgress];
		this.listeners.push(listener);

		if (this.isResolved) {
			onOk(this.data);
		} else if (this.isRejected) {
			onError(this.data);
		}
		return this;
	}

	progress(data) {
		this.signalListeners(data, 2);
	}

	resolve(data) {
		this.isResolved = true;
		this.data = data;
		this.signalListeners(data, 0);
	}

	signalListeners(data, index) {
		let dataChained = data;
		this.listeners.forEach((listener) => {
			let callback = listener[index];
			if (callback) {
				let responseData = callback(dataChained);
				if (responseData !== undefined) {
					dataChained = responseData;
				}
			}
		});
	}

	reject(data) {
		this.isRejected = true;
		this.data = data;
		this.signalListeners(data, 1);
	}

	/**
	 * wait for all promises to complete. Does not signal reject yet...
	 * @param deferredList
	 * @returns {Deferred.constructor}
	 */
	static all(deferredList) {
		let globalDeferred = new Deferred();
		deferredList.forEach(function(deferred) {
			function onComplete(data) {
				deferred.__data = data;

				let isAllComplete = deferredList.every((d) => d.isResolved || d.isRejected);

				if (isAllComplete) {
					let isRejected = deferredList.some((d) => d.isRejected);
					if (isRejected) {
						globalDeferred.reject(deferredList.map((d) => d.__data));
					} else {
						globalDeferred.resolve(deferredList.map((d) => d.__data));
					}
				}
			}

			deferred.then(onComplete, onComplete);
		});
		return globalDeferred;
	}
}

if (module) {
	module.exports = Deferred;
}