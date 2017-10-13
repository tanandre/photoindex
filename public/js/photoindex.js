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

let URL = {
	listing: '/photoindex/listing.php',
	photo: '/photoindex/photo?',
};

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
		handle: null,
		pageCount: 1,
		showDetails: true
	},
	mounted: function() {
		setTimeout(() => {
			this.fetchImages({});
		});
		document.onkeydown = (key) => {
			console.log('key', key);

			if (this.selectedImage == null) {
				if (key.keyCode === 37) {
					this.selectPreviousPage();
				} else if (key.keyCode === 39) {
					this.selectNextPage();
				}
			}
		};
	},

	watch: {
		groupRange: function(value) {
			this.groupImageItems(value);
		},

		imageItems: function(value) {
			this.pageCount = Math.ceil(value.length / this.imagesPerPage);
		},

		pageCount: function(value) {
			if (this.currentPage > value) {
				this.currentPage = Math.max(value, 1);
			}
		},

		tags: function(tags) {
			this.fetchImages({tag: tags});
		},

		selectedImage: function(value) {
			if (value === null) {
				document.body.classList.remove("noScroll");
			} else {
				document.body.classList.add("noScroll");
			}
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

		fetchImages: function(data) {
			this.isBusy = true;
			this.images = [];
			this.imageItems = [];
			if (this.currentHandle) {
				this.currentHandle.cancel();
			}
			this.currentHandle = jsonLoader.load('listing', {params: data}).then(data => {
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

		selectPrevious: function() {
			let index = this.imageItems.indexOf(this.selectedImage);
			if (index > 0) {
				this.selectedImage = this.imageItems[index - 1];
			}
		},

		selectNext: function() {
			let index = this.imageItems.indexOf(this.selectedImage);
			if (index < (this.imageItems.length - 1)) {
				this.selectedImage = this.imageItems[index + 1];
			}
		},

		selectNextPage: function() {
			if (this.currentPage < this.pageCount) {
				this.currentPage++;
			}
		},

		selectPreviousPage: function() {
			if (this.currentPage > 1) {
				this.currentPage--;
			}
		}

	}
});
