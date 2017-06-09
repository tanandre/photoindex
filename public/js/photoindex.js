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
		imagesPerPage: 25,
		currentRoute: window.location.pathname,
		search: '',
		isBusy: false,
		millisPerMinute: 60000,
		groupRange: RANGE.MINUTE,
		groupRangeOptions: RANGE
	},
	mounted: function() {
		this.fetchImages({});
		document.onkeypress = function(key) {
			// TODO close image on escape
			// TODO use arrow keys to navigate
			console.log('key', key)
		};
	},

	watch: {
		groupRange: function(value) {
			this.groupImageItems(value);
		}
	},

	methods: {
		pauseThumbnailView: function() {
			thumbnailLoader0.stop();
			thumbnailLoader0.start();
		},

		pauseDetailedView: function() {
			thumbnailLoader0.start();
			thumbnailLoader0.stop();
		},

		fetchImages: function(data) {
			this.isBusy = true;
			this.$http.get('/listing', {params: data}).then(function(response) {
				this.isBusy = false;
				this.images = response.body;

				this.groupImageItems(this.groupRange);
			}, function(err) {
				console.error(err);
				this.isBusy = false;
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

		isThumbnailDisplay: function(img) {
			let index = this.images.indexOf(img);
			if (index === 0) {
				return true;
			}

			let date1 = this.images[index - 1].dateInMillis;
			let date2 = this.images[index].dateInMillis;
			let millisPerMinute = 60000;
			console.log(date1 - date2);
			return (date1 - date2) > millisPerMinute;
		},

		onMouseOverThumbnail: function(thumb) {
			console.log('onMouseOverthumb', thumb);
		},

		onTagsChanged: function(tags) {
			console.log('onTagsChanged', tags);
			this.fetchImages({tag: tags});
		},

		onClickThumbnail: function(img) {
			this.pauseThumbnailView();
			this.displayPhoto(img);
		},

		displayPhoto: function(img) {
			this.pauseDetailedView();
			this.selectedImage = img;
		},

		clearSelection: function() {
			this.pauseThumbnailView();
			this.selectedImage = null;
		},

		getImagesForPage: function(currentPage) {
			let startIndex = (currentPage - 1) * this.imagesPerPage;
			return this.imageItems.slice(startIndex, startIndex + this.imagesPerPage);
		},

		selectPrevious: function(item) {
			this.pauseThumbnailView();
			let index = this.imageItems.indexOf(item);
			if (index > 0) {
				this.selectedImage = this.imageItems[index - 1];
			}
		},

		selectNext: function(item) {
			this.pauseThumbnailView();
			let index = this.imageItems.indexOf(item);
			if (index < (this.imageItems.length - 1)) {
				this.selectedImage = this.imageItems[index + 1];
			}
		}
	}
});
