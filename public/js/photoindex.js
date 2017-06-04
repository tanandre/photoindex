var app = new Vue({
	el: '#app',
	data: {
		title: 'dre\'s album',
		images: [],
		imageItems: [],
		selectedImage: null,
		currentPage: 1,
		imagesPerPage: 100,
		currentRoute: window.location.pathname,
		search: '',
		isBusy: false,
		millisPerMinute: 60000
	},
	mounted: function() {
		this.fetchImages({});
		document.onkeypress = function(key) {
			// TODO close image on escape
			// TODO use arrow keys to navigate
			console.log('key', key)
		};
	},

	methods: {
		fetchImages: function(data) {
			this.isBusy = true;
			this.$http.get('/listing', {params: data}).then(function(response) {
				this.isBusy = false;
				this.images = response.body;
				this.imageItems = [];
				var imageItems = this.imageItems;
				var _this = this;
				var index = 0;
				this.images.forEach(function(img) {
					if (index++ === 0) {
						imageItems.push({
							key: img,
							series: [img]
						});
						return;
					}
					var previousItem = imageItems[imageItems.length - 1];
					var datePrevious = previousItem.series[previousItem.series.length - 1].dateInMillis;
					if ((datePrevious - img.dateInMillis) < _this.millisPerMinute) {
						previousItem.series.push(img);
					} else {
						imageItems.push({
							key: img,
							series: [img]
						});
					}
				});
			}, function(err) {
				console.err(err);
				this.isBusy = false;
			});
		},

		getIndexOf: function(img) {
			console.log('getIndexOf', this.imageItems.indexOf(img));
			return this.imageItems.indexOf(img);
		},

		isThumbnailDisplay: function(img) {
			var index = this.images.indexOf(img);
			console.log('isThumbnailDisplay', index);
			if (index === 0) {
				return true;
			}

			var date1 = this.images[index - 1].dateInMillis;
			var date2 = this.images[index].dateInMillis;
			var millisPerMinute = 60000;
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
			this.displayPhoto(img);
		},

		displayPhoto: function(img) {
			this.selectedImage = img;
			// console.log('selected image', img);
		},

		clearSelection: function() {
			this.selectedImage = null;
		},

		getImagesForPage: function(currentPage) {
			var startIndex = (currentPage - 1) * this.imagesPerPage;
			return this.imageItems.slice(startIndex, startIndex + this.imagesPerPage);
		},

		selectPrevious: function(item) {
			var index = this.imageItems.indexOf(item);
			console.log('index', index);
			if (index > 0) {
				this.selectedImage = this.imageItems[index - 1];
			}
		},

		selectNext: function(item) {
			var index = this.imageItems.indexOf(item);
			console.log('index', index);
			if (index < (this.imageItems.length - 1)) {
				this.selectedImage = this.imageItems[index + 1];
			}
		}
	}
});
