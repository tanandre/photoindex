'use strict';

// TODO share the cache of the different loaders;
class ImageWorker {
	constructor() {
		this.img = new Image();
		this._isAvailable = true;
	}

	isAvailable() {
		return this._isAvailable;
	}

	execute(url) {
		if (!this._isAvailable) {
			throw new Error('should not be called when not available');
		}
		// console.log('ImageWorker start loading url', url);

		let deferred = new Deferred();
		this._isAvailable = false;
		let _this = this;
		this.img.onload = function() {
			_this._isAvailable = true;
			// console.log('ImageWorker onload', url);
			deferred.resolve(url);
		};
		this.img.onerror = function() {
			_this._isAvailable = true;
			deferred.reject(url);
		};
		this.img.src = url;
		return deferred;
	}
}

class XhrWorker {
	constructor(http) {
		this._http = http;
		this._isAvailable = true;
	}

	isAvailable() {
		return this._isAvailable;
	}

	execute(url) {
		this._isAvailable = false;
		let deferred = new Deferred();
		let _this = this;
		this._http.get(url).then((response) => {
			this._isAvailable = true;
			deferred.resolve(response.body);
		}).catch((err) => {
			this._isAvailable = true;
			deferred.reject(err);
		});
		return deferred;
	}
}

class QueuedLoader {
	static create(fnc, workerCount) {
		let workers = [];
		for (let i = 0; i < workerCount; i++) {
			workers.push(fnc());
		}
		return new QueuedLoader(workers);
	}

	constructor(workers) {
		this.queue = [];
		this.workers = workers;
		this._stop = false;
	}

	load(url) {
		let deferred = new Deferred();
		this.queue.push({
			url: url,
			deferred: deferred
		});
		this.start();
		return deferred;
	}

	clear() {
		this.queue = [];
	}

	stop() {
		this._stop = true;
	}

	start() {
		this._stop = false;
		let _this = this;

		function loadNext(worker) {
			if (_this._stop) {
				return;
			}

			let item = _this.queue.shift();
			if (item === undefined) {
				return;
			}

			if (item.deferred.isCanceled) {
				loadNext(worker);
				return;
			}

			item.deferred.progress(1);
			let promise = worker.execute(item.url);
			promise.then((data) => {
				item.deferred.resolve(data);
				loadNext(worker, _this.queue);
			}, (err) => {
				item.deferred.reject(err);
				loadNext(worker, _this.queue);
			}, (progress) => {
				item.deferred.progress(progress);
			});
		}

		setTimeout(() => {
			this
				.workers
				.filter((worker) => worker
					.isAvailable()).forEach((worker) => {
				loadNext(worker);
			});
		});
	}
}

class CachedLoader {
	constructor(loader) {
		this.loader = loader;
		this.cache = [];
	}

	load(url) {
		let cache = this.cache;
		if (cache[url] !== undefined) {
			return Deferred.createResolved(cache[url]);
		}
		return this.loader.load(url).then((data) => {
			cache[url] = data;
		});
	}

	clear() {
		this.loader.clear();
	}

	stop() {
		this.loader.stop();
	}

	start() {
		this.loader.start();
	}
}

class LoaderFactory {

	static createJsonLoader(workerCount) {
		return new CachedLoader(QueuedLoader.create(() => {
			return new XhrWorker(Vue.http);
		}, workerCount));
	}

	static createImageLoader(workerCount) {
		return new CachedLoader(QueuedLoader.create(() => {
			return new ImageWorker();
		}, workerCount));
	}
}
