class Deferred {

	static createResolved(data) {
		var deferred = new Deferred();
		deferred.resolve(data);
		return deferred;
	}

	constructor() {
		this.isResolved = false;
		this.isRejected = false;
		this.listeners = [];
	}

	then(onOk, onError, onProgress) {
		var listener = [onOk, onError, onProgress];
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
		this.listeners.forEach(function(listener) {
			var callback = listener[index];
			if (callback) {
				callback(data);
			}
		});
	}

	reject(data) {
		this.isRejected = true;
		this.data = data;
		this.signalListeners(data, 1);
	}
}

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

		var deferred = new Deferred();
		this._isAvailable = false;
		var _this = this;
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
		var deferred = new Deferred();
		var _this = this;
		this._http.get(url).then(function(response) {
			_this._isAvailable = true;
			deferred.resolve(response.body);
		});
		return deferred;
	}
}

class QueuedLoader {
	static create(fnc, workerCount) {
		var workers = [];
		for (var i = 0; i < workerCount; i++) {
			workers.push(fnc());
		}
		return new QueuedLoader(workers);
	}

	constructor(workers) {
		this.queue = [];
		this.workers = workers;
	}

	load(url) {
		var deferred = new Deferred();
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
			var item = queue.shift();
			if (item !== undefined) {
				var promise = worker.execute(item.url);
				promise.then(function(data) {
					item.fnc(data);
					loadNext(worker, queue);
				});
			}
		}

		var queue = this.queue;
		this.workers.filter(function(worker) {
			return worker.isAvailable();
		}).forEach(function(worker) {
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
		var cache = this.cache;
		if (cache[url] !== undefined) {
			return Deferred.createResolved(cache[url]);
		}
		return this.loader.load(url).then(function(data) {
			cache[url] = data;
		});
	}
}

class LoaderFactory {

	static createJsonLoader(workerCount) {
		return new CachedLoader(QueuedLoader.create(function() {
			return new XhrWorker(Vue.http);
		}, workerCount));
	}

	static createImageLoader(workerCount) {
		return new CachedLoader(QueuedLoader.create(function() {
			return new ImageWorker();
		}, workerCount));
	}
}

