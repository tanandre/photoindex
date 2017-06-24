function getPhotoUrl(photo, width) {
	return "/photo/" + photo.id + (width === undefined ? '' : '/' + width);
}

function isElementInViewport(el) {
	let rect = el.getBoundingClientRect();
	return rect.bottom > 0 && rect.right > 0 &&
		rect.top < (window.innerHeight || document.documentElement.clientHeight) &&
		rect.left < (window.innerWidth || document.documentElement.clientWidth);
}

function safeCancel(promise) {
	if (promise) {
		let pList = promise.constructor === Array ? promise : [promise];
		pList.forEach((p) => {
			if (p) {
				p.cancel();
			}
		});
	}
}

Vue.component('thumbnailPhoto', {
	props: ['photo', 'loaderId'],
	data: function() {
		return {
			status: 'idle',
			isLoading: false,
			isDone: false,
			promise: null,
			isError: false,
			progress: 0,
		};
	},
	template: "<div ref='thumbnail' :class='{ loading: isLoading, imgError: isError }'><slot></slot></div>", //
	// template: "<div ref='thumbnail'><slot></slot>{{status}}<md-spinner v-if='isLoading' :md-progress='progress' md-indeterminate></md-spinner></div>",
	mounted: function() {

		['DOMContentLoaded', 'load', 'scroll', 'resize'].forEach((event) => {
			window.addEventListener(event, () => {
				this.loadImageIfInViewport();
			}, false);
		});
		this.loadImageIfInViewport();
	},
	methods: {
		loadImageIfInViewport: function() {
			if (this.isDone) {
				return;
			}

			if (!isElementInViewport(this.$el)) {
				// cancel queued items that have not been started
				if (this.promise && !this.promise.hasProgress()) {
					this.status = 'canceled';
					this.promise.cancel();
					this.promise = null;
				}
				return;
			}

			// already on the queue
			if (this.promise) {
				return;
			}

			this.status = 'in queue';
			let photoUrl = getPhotoUrl(this.photo, 300);
			let thumbnail = this.$refs['thumbnail'];

			this.promise = getThumbnailLoader(this.loaderId).load(photoUrl).then((data) => {
				this.status = 'done';
				this.isLoading = false;
				this.isDone = true;
				thumbnail.style.backgroundImage = 'url(' + data + ')';
			}, (err) => {
				this.status = 'error';
				this.isLoading = false;
				this.isDone = true;
				this.isError = true;
			}, (progress) => {
				this.progress = progress;
				this.status = 'loading';
				this.isLoading = true;
			});
		},
	},
	beforeDestroy: function() {
		this.status = 'destroyed';
		safeCancel(this.promise);
	}
});

let monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
	'October', 'November', 'December'];

let dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getDateTag(date, dateRange) {
	if (dateRange === RANGE.YEAR) {
		return date.substring(0, 4);
	}

	if (dateRange === RANGE.MONTH) {
		return date.substring(0, 4) + date.substring(5, 7);
	}

	if (dateRange === RANGE.DAY) {
		return date.substring(0, 4) + date.substring(5, 7) + date.substring(8, 10);
	}

	return null;
}

function getDateDisplay(date, dateRange) {
	if (dateRange === RANGE.YEAR) {
		return date.substring(0, 4);
	}

	if (dateRange === RANGE.MONTH) {
		return monthNames[new Date(date).getMonth()] + ' \'' + date.substring(2, 4);
	}

	if (dateRange === RANGE.HOUR) {
		let beginHour = parseInt(date.substring(11, 13));
		let endHour = beginHour === 23 ? 0 : beginHour + 1;
		return beginHour + ':00-' + endHour + ':00';
	}

	if (dateRange === RANGE.DAY) {
		// return dayNames[new Date(date).getDay()];
		return new Date(date).toDateString();
	}

	return '';
}

Vue.component('thumbnail', {
	props: ['photo', 'dateRange'],
	template: "<div class='photoThumbnailBox action' :title='photo.key.date' >" +
	"<thumbnail-photo v-on:click.native='onClick' class='photoThumbnail' v-bind:loader-id='0' v-bind:photo='photo.key'>" +
	"<md-chip v-if='photo.series.length > 1'>{{photo.series.length}}</md-chip>" +
	"<div class='photoInfo' v-on:click.stop='onClickInfo' v-if='dateRange !== \"Minute\" && dateRange !== \"Off\"'><span class='thumbnailDate'>{{dateToDisplay}}</span></div></thumbnail-photo>" +
	"</div>",
	computed: {
		dateToDisplay: function() {
			return getDateDisplay(this.photo.key.date, this.dateRange);
		}
	},
	methods: {
		onClick: function(event) {
			console.log('event', event);
			this.$emit('select', this.photo);
		},

		onClickInfo: function(event) {
			let dateTag = getDateTag(this.photo.key.date, this.dateRange);
			if (dateTag !== null) {
				console.log('dateTag', dateTag);
				this.$emit('add-tag', dateTag);
			}

			// this.$emit('select', this.photo);
		}
	}
});

Vue.component('photoDetails', {
	props: ['photo', 'index', 'size', 'indexPosition'],
	data: function() {
		return {
			exif: null,
			tags: [],
			date: null,
			promise: null,
			promiseTags: null
		}
	},
	template: "<div class='exifView'><div v-if='indexPosition != null'><span>{{indexPosition.image.index + 1}} / {{indexPosition.image.length}}</span>" +
	"<small> ({{indexPosition.imageItems.index + 1}} / {{indexPosition.imageItems.length}})</small></div><div :title='photo ? photo.date:\"\"'>Date: {{date}}</div>" +
	"<div class='exifFile' :title='photo ? photo.path: \"\"'>{{photo ? photo.path: \"\"}}</div>" +
	"<md-chip v-for='tag in tags' :key='tag'>{{tag}}</md-chip>" +
	"<div v-for='(exifSection, key) in exif'><div class='exifHeader'>{{key}}</div><table><tbody>" +
	"<tr v-for='(value, key) in exifSection'><td class='key'>{{key}}</td><td>{{value}}</td></tr></tbody></table></div></div></div>",
	watch: {
		photo: function() {
			safeCancel([this.promise, this.promiseTags]);
			this.exif = {};
			this.tags = {};
			this.date = new Date(this.photo.date).toLocaleString();
			this.promise = jsonLoader.load('/exif/' + this.photo.id)
				.then((data) => {
					this.exif = data;
				});
			this.promiseTags = jsonLoader.load('/tags/' + this.photo.id)
				.then((data) => {
					this.tags = data.tags;
				});
		},
	},
	beforeDestroy: function() {
		safeCancel([this.promise, this.promiseTags]);
	}
});

Vue.component('photoSeries', {
	props: ['photo', 'indexSeries'],
	template: "<div class='photoSeries' v-on:scroll='onScroll'><div class='seriesContainer'>" +
	"<thumbnail-photo ref='thumbnails' class='seriesThumbnail action' v-for='(img, index) in photo.series' :key='img.id' " +
	"@click.native='select(img, index)' :class='[indexSeries == index ? \"selected\" : \"\" ]' v-bind:loader-id='1' v-bind:photo='img'></thumbnail-photo></div></div>",
	methods: {
		select: function(img, index) {
			this.$emit('select', img, index);
		},

		onScroll: function() {
			this.$refs['thumbnails'].forEach((thumbnail) => {
				thumbnail.loadImageIfInViewport();
			});
		}
	}
});

Vue.component('photoDetailView', {
	props: ['photo', 'size', 'sizeImageItems'],
	data: function() {
		return {
			exif: null,
			index: -1,
			indexPosition: null,
			indexSeries: 0,
			selectedPhoto: null,
			showLeft: false,
			showRight: false,
			isLoading: false,
			promise: null,
			progress: 0,
		};
	},
	template: "<div class='photoDetailView'><div class='photoView action' @click='onClick()' :class='{ loading: isLoading }' ref='photoView'>" +
	"<div @click.stop='onNavigate(\"prev\")' class='navigationPane left' title='navigate to previous' @mousemove='showLeft = true' @mouseover='showLeft = true' @mouseleave='showLeft = false'><div v-show='showLeft' class='navigation left'></div></div>" +
	"<div @click.stop='onNavigate(\"next\")' class='navigationPane right' title='navigate to next' @mousemove='showRight = true' @mouseover='showRight = true' @mouseleave='showRight = false'><div v-show='showRight' class='navigation right'></div></div></div>" +
	"<photo-details v-bind:photo='selectedPhoto' v-bind:index='index' v-bind:size='size' v-bind:indexPosition='indexPosition'></photo-details>" +
	"<photo-series v-if='photo.series.length > 1' v-on:select='selectSeriesPhoto' v-bind:photo='photo' v-bind:indexSeries='indexSeries'></photo-series></div>",
	methods: {
		onNavigate: function(direction) {
			this.$emit(direction, this.photo);
		},
		onClick: function() {
			this.$emit('close');
			document.body.classList.remove("noScroll");
		},

		selectSeriesPhoto: function(img, indexSeries) {
			this.indexSeries = indexSeries;
			this.loadPhoto(img);
		},

		loadPhoto: function(photoToDisplay) {
			this.isLoading = false;
			if (this.promise && !this.promise.isDone()) {
				this.promise.cancel();
			}

			this.progress = 0;
			this.selectedPhoto = photoToDisplay;
			this.index = this.$parent.imageItems.indexOf(this.photo);
			this.indexPosition = {
				image: {
					index: this.$parent.images.indexOf(photoToDisplay),
					length: this.size
				},
				imageItems: {
					index: this.$parent.imageItems.indexOf(this.photo),
					length: this.sizeImageItems
				}
			};

			let photoView = this.$refs['photoView'];
			photoView.style.backgroundImage = '';
			let photoUrl = getPhotoUrl(photoToDisplay, 1000);
			this.promise = imageLoader.load(photoUrl);
			this.promise.then(() => {
				this.isLoading = false;
				photoView.style.backgroundImage = "url(" + photoUrl + ")";
			}, (err) => {
				this.isLoading = false;
				console.error('error loading image', err);
			}, (progress) => {
				this.progress = progress;
				this.isLoading = true;
			});
		}
	},

	mounted: function() {
		document.body.classList.add("noScroll");
		this.indexSeries = 0;
		this.loadPhoto(this.photo.key);
	},

	watch: {
		photo: function(photo, previousPhoto) {
			let index = this.$parent.imageItems.indexOf(photo);
			let oldIndex = this.$parent.imageItems.indexOf(previousPhoto);
			// preserve left/right button visibility
			this.showLeft = index < oldIndex;
			this.showRight = index > oldIndex;
			this.loadPhoto(this.photo.key);
		}
	},
	beforeDestroy: function() {
		safeCancel(this.promise);
	}

});

Vue.component('searchTags', {
	props: ['value'],
	data: function() {
		return {
			search: ''
		};
	},
	template: "<div><input class='searchToolbar' v-model='search' placeholder='Enter search criteria' " +
	"v-on:keyup.enter='addSearchString' autofocus></input></div>",
	methods: {
		addSearchString: function() {
			this.value.push(this.search);
			this.$emit('input', this.value);
			this.search = '';
		}
	}
});

Vue.component('selectedTags', {
	props: ['value'],
	template: "<div><md-chip class='label action' v-for='tag in value' :key='tag' :title='tag' " +
	"v-on:click.native='removeTag(tag)' md-deletable>{{tag}}</md-chip></div>",
	methods: {
		removeTag: function(tag) {
			let found = this.value.indexOf(tag);
			if (found > -1) {
				this.value.splice(found, 1);
			}
			this.$emit('input', this.value);
		}
	}
});

Vue.component('pagination', {
	props: ['value', 'pageCount'],
	template: "<div class='pagination'><md-button @click.native='onClick(idx)' class='md-icon-button md-raised pageButton' " +
	"v-for='idx in pageCount' :key='idx' :class='getCssClass(idx)'>{{idx}}</md-button></div>",
	methods: {
		onClick: function(idx) {
			this.$emit('input', Number(idx));
		},

		getCssClass: function(idx) {
			if (idx === this.value) {
				return 'md-primary';
			}
			return '';
		}
	}
});
