'use strict';

/**
 * TODO add promise api that allows a limited api
 */
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
		this._isResolved = false;
		this._isRejected = false;
		this._isCanceled = false;
		this._hasProgress = false;
		this.listeners = [];
		let _parent = this;
		this.promise = {
			then: _parent.then.bind(_parent),
			cancel: _parent.cancel.bind(_parent),
			isDone: _parent.isDone.bind(_parent),
			isResolved: _parent.isResolved.bind(_parent),
			isRejected: _parent.isRejected.bind(_parent),
			isCanceled: _parent.isCanceled.bind(_parent),
			hasProgress: _parent.hasProgress.bind(_parent)
		};
	}

	isResolved() {
		return this._isResolved;
	}

	isRejected() {
		return this._isRejected;
	}

	isCanceled() {
		return this._isCanceled;
	}

	hasProgress() {
		return this._hasProgress;
	}

	then(onOk, onError, onProgress) {
		let listener = [onOk, onError, onProgress];
		this.listeners.push(listener);

		if (this._isResolved) {
			onOk(this.data);
		} else if (this._isRejected) {
			onError(this.data);
		}
		return this;
	}

	isDone() {
		return this._isResolved || this._isRejected || this._isCanceled;
	}

	progress(data) {
		this._hasProgress = true;
		this.signalListeners(data, 2);
	}

	resolve(data) {
		if (this._isResolved) {
			throw new Error('Cannot resolve, deferred already resolved');
		}
		if (this._isRejected) {
			throw new Error('Cannot resolve, Deferred already rejected');
		}
		this._isResolved = true;
		this.data = data;
		this.signalListeners(data, 0);
	}

	reject(data) {
		if (this._isResolved) {
			console.error(data);
			throw new Error('Cannot reject, deferred already resolved');
		}
		if (this._isRejected) {
			console.error(data);
			throw new Error('Cannot reject, Deferred already rejected');
		}
		this._isRejected = true;
		this.data = data;
		this.signalListeners(data, 1);
	}

	cancel() {
		this._isCanceled = true;
	}

	signalListeners(data, index) {
		if (this._isCanceled) {
			return;
		}

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

	/**
	 * wait for all promises to complete.
	 * TODO add progress update for each deferred that is complete.
	 * @param deferredList
	 * @returns {Deferred.constructor}
	 */
	static all(deferredList) {
		let globalDeferred = new Deferred();
		deferredList.forEach(deferred => {
			function onComplete(data) {
				deferred.__data = data;

				let isAllComplete = deferredList.every(d => d._isResolved || d._isRejected);

				if (isAllComplete) {
					let isRejected = deferredList.some(d => d._isRejected);
					if (isRejected) {
						globalDeferred.reject(deferredList.map(d => d.__data).filter(data => data !== undefined));
					} else {
						globalDeferred.resolve(deferredList.map(d => d.__data));
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