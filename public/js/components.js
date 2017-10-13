function getPhotoUrl(photo, width) {
	return "/photo/" + photo.id + (width === undefined ? '' : '/' + width);
}

function isElementInViewport(el) {
	let rect = el.getBoundingClientRect();
	return rect.bottom > 0 && rect.right > 0 &&
		rect.top < (window.innerHeight || document.documentElement.clientHeight) &&
		rect.left < (window.innerWidth || document.documentElement.clientWidth);
}

function scrollIntoView(el) {
	el.scrollIntoView();
}

function setBackgroundImage(node, url) {
	node.style.backgroundImage = 'url(' + url + ')';
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
			isDone: false,
			promise: null,
		};
	},
	template: "<div ref='thumbnail' class='highlightable' :class='status'><md-progress v-if='status == \"loading\"' md-indeterminate></md-progress><slot></slot></div>",

	mounted: function() {
		['DOMContentLoaded', 'load', 'scroll', 'resize'].forEach((event) => {
			window.addEventListener(event, this.loadImageIfInViewport, false);
		});
		this.loadImageIfInViewport();
	},

	updated: function() {
		this.loadImageIfInViewport();
	},

	methods: {
		loadImageIfInViewport: function() {
			if (this.isDone) {
				return;
			}

			if (!isElementInViewport(this.$el)) {
				console.log('not in viewport');
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
				console.log('already promised');
				return;
			}

			this.status = 'in queue';
			let photoUrl = getPhotoUrl(this.photo, 300);
			let thumbnail = this.$refs['thumbnail'];

			this.promise = getThumbnailLoader(this.loaderId).load(photoUrl).then((data) => {
				this.status = 'done';
				this.isDone = true;
				setBackgroundImage(thumbnail, data);
			}, (err) => {
				this.status = 'error';
				this.isDone = true;
			}, (progress) => {
				this.status = 'loading';
			});
		},
	},
	beforeDestroy: function() {
		this.status = 'destroyed';
		['DOMContentLoaded', 'load', 'scroll', 'resize'].forEach((event) => {
			window.removeEventListener(event, this.loadImageIfInViewport, false);
		});
		safeCancel(this.promise);
	}
});

let monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
	'October', 'November', 'December'];

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
		return new Date(date).toDateString();
	}

	return '';
}

Vue.component('thumbnail', {
	props: ['photo', 'dateRange', 'showDetails'],
	template: "<div class='photoThumbnailBox action' :title='photo.key.date' >" +
	"<thumbnail-photo v-on:click.native='onClick' class='photoThumbnail' v-bind:loader-id='0' v-bind:photo='photo.key'>" +
	"<md-chip v-if='showDetails && photo.series.length > 1'>{{photo.series.length}}</md-chip>" +
	"<div class='photoInfo' v-on:click.stop='onClickInfo' v-if='showDetails && dateRange !== \"Minute\" && dateRange !== \"Off\"'><span class='thumbnailDate'>{{dateToDisplay}}</span></div></thumbnail-photo>" +
	"</div>",
	computed: {
		dateToDisplay: function() {
			return getDateDisplay(this.photo.key.date, this.dateRange);
		}
	},
	methods: {
		onClick: function() {
			this.$emit('select', this.photo);
		},

		onClickInfo: function() {
			let dateTag = getDateTag(this.photo.key.date, this.dateRange);
			if (dateTag !== null) {
				this.$emit('add-tag', dateTag);
			}
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
			promiseTags: null,
			downloadUrl: null
		}
	},
	template: "<div class='exifView'><div v-if='indexPosition != null'><span>{{indexPosition.image.index + 1}} / {{indexPosition.image.length}}</span>" +
	"<small> ({{indexPosition.imageItems.index + 1}} / {{indexPosition.imageItems.length}})</small></div><div :title='photo ? photo.date:\"\"'>Date: {{date}}</div>" +
	"<a :href='downloadUrl' download><md-button class='md-fab'><md-icon>get_app</md-icon></md-button></a>" +
	"<div class='exifFile' :title='photo ? photo.path: \"\"'>{{photo ? photo.path: \"\"}}</div>" +
	"<md-chip v-for='tag in tags' :key='tag'>{{tag}}</md-chip>" +
	"<div v-for='(exifSection, key) in exif'><div class='exifHeader'>{{key}}</div><table><tbody>" +
	"<tr v-for='(value, key) in exifSection'><td class='key'>{{key}}</td><td>{{value}}</td></tr></tbody></table></div></div></div>",
	watch: {
		photo: function() {
			this.downloadUrl = getPhotoUrl(this.photo);
			safeCancel([this.promise, this.promiseTags]);
			this.exif = {};
			this.tags = {};
			this.date = new Date(this.photo.date).toLocaleString();
			this.promise = jsonLoader.load('/exif/' + this.photo.id)
				.then(data => {
					this.exif = data;
				});
			this.promiseTags = jsonLoader.load('/tags/' + this.photo.id)
				.then(data => {
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
	"@click.native='select(index)' :class='[indexSeries == index ? \"selected\" : \"\" ]' v-bind:loader-id='1' v-bind:photo='img'></thumbnail-photo></div></div>",
	methods: {
		select: function(index) {
			this.$emit('select', index);
		},

		onScroll: function() {
			this.$refs['thumbnails'].forEach(thumbnail => {
				thumbnail.loadImageIfInViewport();
			});
		}
	},
	watch: {
		indexSeries: function(value) {
			let seriesThumbnail = this.$refs['thumbnails'][value];
			if (!isElementInViewport(seriesThumbnail.$el)) {
				scrollIntoView(seriesThumbnail.$el);
			}

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
		};
	},
	template: "<div class='photoDetailView'>" +
	"<photo-display @click.native='onClick()' v-bind:photo='selectedPhoto'>" +
	"<div @click.stop='onNavigate(\"prev\")' class='navigationPane action left' title='navigate to previous' @mousemove='showLeft = true' @mouseover='showLeft = true' @mouseleave='showLeft = false'><div v-show='showLeft' class='navigation left'></div></div>" +
	"<div @click.stop='onNavigate(\"next\")' class='navigationPane action right' title='navigate to next' @mousemove='showRight = true' @mouseover='showRight = true' @mouseleave='showRight = false'><div v-show='showRight' class='navigation right'></div></div>" +
	"</photo-display>" +
	"<photo-details v-bind:photo='selectedPhoto' v-bind:index='index' v-bind:size='size' v-bind:indexPosition='indexPosition'></photo-details>" +
	"<photo-series v-if='photo.series.length > 1' v-on:select='selectSeriesPhoto' v-bind:photo='photo' v-bind:indexSeries='indexSeries'></photo-series></div>",
	methods: {
		onNavigate: function(direction) {
			this.$emit(direction, this.photo);
		},
		onClick: function() {
			this.$emit('close');
		},

		selectSeriesPhoto: function(indexSeries) {
			this.indexSeries = indexSeries;
		},

		loadPhoto: function(photoToDisplay) {
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
		},
		onKeyDown: function(key) {
			if (key.keyCode === 27) {
				this.$emit('close');
			} else if (key.keyCode === 37) {
				this.$emit('prev', this.photo);
			} else if (key.keyCode === 39) {
				this.$emit('next', this.photo);
			} else if (key.keyCode === 38) {
				this.selectPreviousInSeries();
			} else if (key.keyCode === 40) {
				this.selectNextInSeries();
			}
		},

		selectNextInSeries: function() {
			if (this.indexSeries < this.photo.series.length - 1) {
				this.indexSeries++;
			}
		},

		selectPreviousInSeries: function() {
			if (this.indexSeries > 0) {
				this.indexSeries--;
			}
		}
	},

	mounted: function() {
		this.indexSeries = 0;
		this.loadPhoto(this.photo.key);
		window.addEventListener('keydown', this.onKeyDown);
	},

	watch: {
		photo: function(photo, previousPhoto) {
			this.indexSeries = 0;
			let index = this.$parent.imageItems.indexOf(photo);
			let oldIndex = this.$parent.imageItems.indexOf(previousPhoto);
			// preserve left/right button visibility
			this.showLeft = index < oldIndex;
			this.showRight = index > oldIndex;
			this.loadPhoto(this.photo.key);
		},

		indexSeries: function(value) {
			this.loadPhoto(this.photo.series[value]);
		}
	},
	beforeDestroy: function() {
		window.removeEventListener('keydown', this.onKeyDown);
	}

});

Vue.component('photoDisplay', {
	props: ['photo'],
	data: function() {
		return {
			status: 'idle',
			promise: null
		};
	},
	template: "<div class='photoDisplay' ref='photoDisplay'>" +
	"<md-progress v-if='status == \"loading\"' md-indeterminate></md-progress><slot></slot></div></div>",
	watch: {
		photo: function(value) {
			this.status = 'idle';
			let photoView = this.$refs['photoDisplay'];
			//photoView.style.backgroundImage = "";
			if (value === null) {
				return;
			}

			if (this.promise && !this.promise.isDone()) {
				this.promise.cancel();
			}

			let thumbUrl = getPhotoUrl(this.photo, 300);
			if (imageLoader.isInCache(thumbUrl)) {
				setBackgroundImage(photoView, thumbUrl);
			}

			let photoUrl = getPhotoUrl(this.photo, 1000);
			this.promise = imageLoader.load(photoUrl);
			this.promise.then(() => {
				setBackgroundImage(photoView, photoUrl);
				this.status = 'done';
			}, err => {
				this.status = 'error';
				console.error('error loading image', err);
			}, progress => {
				this.status = 'loading';
			});
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
