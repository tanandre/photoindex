'use strict';

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
	}

	load(url) {
		let deferred = new Deferred();
		this.queue.push({
			url: url,
			fnc: function(data) {
				deferred.resolve(data);
			}
		});
		this.start();
		return deferred;
	}

	start() {
		function loadNext(worker, queue) {
			let item = queue.shift();
			if (item !== undefined) {
				let promise = worker.execute(item.url);
				promise.then((data) => {
					item.fnc(data);
					loadNext(worker, queue);
				});
			}
		}

		let queue = this.queue;
		this.workers.filter((worker) => worker.isAvailable()).forEach((worker) => {
			loadNext(worker, queue);
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
