Vue.use(VueMaterial);

function getThumbnailLoader(id) {
	if (id === 0) {
		return thumbnailLoader0;
	}
	return thumbnailLoader1;

}
let thumbnailLoader0 = LoaderFactory.createImageLoader(4);
let thumbnailLoader1 = LoaderFactory.createImageLoader(4);
let imageLoader = LoaderFactory.createReversedImageLoader(1);
let jsonLoader = LoaderFactory.createReversedJsonLoader(2);

const RANGE = {
	OFF: 'Off',
	MINUTE: 'Minute',
	HOUR: 'Hour',
	DAY: 'Day',
	MONTH: 'MONTH',
	YEAR: 'YEAR'
};

function createRangeFnc(range) {
	if (range === RANGE.HOUR) {
		return function(imgA, imgB) {
			return imgA.date.substring(0, 13) === imgB.date.substring(0, 13);
		}
	}
	if (range === RANGE.DAY) {
		return function(imgA, imgB) {
			return imgA.date.substring(0, 10) === imgB.date.substring(0, 10);
		}
	}
	if (range === RANGE.MONTH) {
		return function(imgA, imgB) {
			return imgA.date.substring(0, 7) === imgB.date.substring(0, 7);
		}
	}
	if (range === RANGE.YEAR) {
		return function(imgA, imgB) {
			return imgA.date.substring(0, 4) === imgB.date.substring(0, 4);
		}
	}
	if (range === RANGE.MINUTE) {
		return function(imgA, imgB) {
			return (imgA.dateInMillis - imgB.dateInMillis) < 60000;
		}
	}

	return function() {
		return false;
	}
}

let app = new Vue({
	el: '#app',
	data: {
		title: 'dre\'s album',
		images: [],
		imageItems: [],
		selectedImage: null,
		currentPage: 1,
		imagesPerPage: 70,
		currentRoute: window.location.pathname,
		search: '',
		isBusy: true,
		millisPerMinute: 60000,
		groupRange: RANGE.MINUTE,
		groupRangeOptions: RANGE,
		tags: [],
		handle: null
	},
	mounted: function() {
		setTimeout(() => {
			this.fetchImages({});
		});
		document.onkeypress = function(key) {
			// TODO close image on escape
			// TODO use arrow keys to navigate
			console.log('key', key)
		};
	},

	watch: {
		groupRange: function(value) {
			this.groupImageItems(value);
		},

		tags: function(tags) {
			this.currentPage = 1;
			this.fetchImages({tag: tags});
		}

	},

	methods: {
		pauseThumbnailView: function() {
			thumbnailLoader0.stop();
			thumbnailLoader1.start();
		},

		pauseDetailedView: function() {
			thumbnailLoader1.stop();
			thumbnailLoader0.start();
		},

		getPageCount: function() {
			return Math.ceil(this.imageItems.length / this.imagesPerPage);
		},

		fetchImages: function(data) {
			this.isBusy = true;
			this.images = [];
			this.imageItems = [];
			if (this.currentHandle) {
				this.currentHandle.cancel();
			}
			this.currentHandle = jsonLoader.load('/listing', {params: data}).then(data => {
				this.currentHandle = null;
				this.isBusy = false;
				this.images = data;

				this.groupImageItems(this.groupRange);
			}, err => {
				this.currentHandle = null;
				this.isBusy = false;
				console.error(err);
			});
		},

		groupImageItems: function(range) {
			let isWithinRange = createRangeFnc(range);
			let imageItems = [];
			let index = 0;
			this.images.forEach((img) => {
				if (index++ === 0) {
					imageItems.push({
						key: img,
						series: [img]
					});
					return;
				}

				let previousItem = imageItems[imageItems.length - 1];
				let previousImg = previousItem.series[previousItem.series.length - 1];
				if (isWithinRange(previousImg, img)) {
					previousItem.series.push(img);
				} else {
					imageItems.push({
						key: img,
						series: [img]
					});
				}
			});
			this.imageItems = imageItems;
		},

		getIndexOf: function(img) {
			return this.imageItems.indexOf(img);
		},

		addTag: function(tag) {
			let found = this.tags.indexOf(tag);
			if (found === -1) {
				this.tags.push(tag);
			}
		},

		onClickThumbnail: function(img) {
			this.pauseThumbnailView();
			this.displayPhoto(img);
		},

		displayPhoto: function(img) {
			this.selectedImage = img;
		},

		clearSelection: function() {
			this.pauseDetailedView();
			this.selectedImage = null;
		},

		getImagesForPage: function(currentPage) {
			let startIndex = (currentPage - 1) * this.imagesPerPage;
			return this.imageItems.slice(startIndex, startIndex + this.imagesPerPage);
		},

		selectPrevious: function(item) {
			let index = this.imageItems.indexOf(item);
			if (index > 0) {
				this.selectedImage = this.imageItems[index - 1];
			}
		},

		selectNext: function(item) {
			let index = this.imageItems.indexOf(item);
			if (index < (this.imageItems.length - 1)) {
				this.selectedImage = this.imageItems[index + 1];
			}
		}
	}
});
