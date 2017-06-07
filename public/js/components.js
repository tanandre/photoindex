let thumbnailLoader = LoaderFactory.createImageLoader(4);
let imageLoader = LoaderFactory.createImageLoader(1);
let jsonLoader = LoaderFactory.createJsonLoader(1);

function getPhotoUrl(photo, width) {
	return "/photo/" + photo.id + (width === undefined ? '' : '/' + width);
}

Vue.component('thumbnailPhoto', {
	props: ['photo'],
	template: "<div ref='thumbnail'><slot></slot></div>",
	mounted: function() {
		let photoUrl = getPhotoUrl(this.photo, 300);
		let thumbnail = this.$refs['thumbnail'];
		thumbnailLoader.load(photoUrl).then(() => {
			thumbnail.style.backgroundImage = 'url(' + photoUrl + ')';
		});
	}
});

Vue.component('thumbnail', {
	props: ['photo'],
	template: "<div class='photoThumbnailBox action' :title='photo.key.date' >" +
	"<thumbnail-photo v-on:click.native='onClick' class='photoThumbnail' v-bind:photo='photo.key'>" + /*"<b-popover  :triggers='[\"click\"]' :placement='\"bottom\"' v-if='photo.series.length > 1'><div class='popoverContent' slot='content'>" +
	 "<thumbnail-photo v-for='img in photo.series' :key='img.id' v-bind:photo='img' class='seriesThumbnail'></thumbnail-photo></div>" +
	 "<b-badge>{{photo.series.length}}</b-badge></b-popover>" +*/
	"<md-chip v-if='photo.series.length > 1'>{{photo.series.length}}</md-chip>" + "</thumbnail-photo>" +
	"</div>",
	methods: {
		onClick: function() {
			this.$emit('select', this.photo);
		}
	}
});

Vue.component('photoDetails', {
	props: ['photo', 'index', 'size', 'indexPosition'],
	data: function() {
		return {
			exif: null,
			tags: [],
			date: null
		}
	},
	template: "<div class='exifView'><div v-if='indexPosition != null'><span>{{indexPosition.image.index + 1}} / {{indexPosition.image.length}}</span>" +
	" <small>({{indexPosition.imageItems.index + 1}} / {{indexPosition.imageItems.length}})</small></div><div>Date: {{date}}</div>" +
	"<div class='exifFile' :title='photo ? photo.path: \"\"'>{{photo ? photo.path: \"\"}}</div>" +
	"<md-chip v-for='tag in tags' :key='tag'>{{tag}}</md-chip>" +
	"<div v-for='(exifSection, key) in exif'><div class='exifHeader'>{{key}}</div><table><tbody>" +
	"<tr v-for='(value, key) in exifSection'><td class='key'>{{key}}</td><td>{{value}}</td></tr></tbody></table></div></div></div>",
	watch: {
		photo: function() {
			let _this = this;
			this.exif = {};
			this.tags = {};
			let d = new Date(this.photo.date);
			this.date = d.toLocaleString();
			jsonLoader.load('/exif/' + this.photo.id)
				.then((data) => {
					_this.exif = data;
				});
			jsonLoader.load('/tags/' + this.photo.id)
				.then((data) => {
					console.log('tags', data);
					_this.tags = data.tags;
				});
		}
	}
});

Vue.component('photoSeries', {
	props: ['photo', 'indexSeries'],
	template: "<div class='photoSeries'><div class='seriesContainer'><thumbnail-photo class='seriesThumbnail action' v-for='(img, index) in photo.series' :key='img.id' " +
	"@click.native='select(img, index)' :class='[indexSeries == index ? \"selected\" : \"\" ]' v-bind:photo='img'></thumbnail-photo></div></div>",
	methods: {
		select: function(img, index) {
			this.$emit('select', img, index);
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
			showRight: false
		};
	},
	template: "<div class='photoDetailView'><div class='photoView action loading' @click='onClick()' ref='photoView'>" +
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
			photoView.classList.add('loading');
			let photoUrl = getPhotoUrl(photoToDisplay, 1000);

			imageLoader.load(photoUrl).then(() => {
				photoView.classList.remove('loading');
				photoView.style.backgroundImage = "url(" + photoUrl + ")";
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
	}
});

Vue.component('searchTags', {
	data: function() {
		return {
			search: '',
			tags: []
		}
	},
	template: "<div><input class='searchToolbar' v-model='search' placeholder='Enter search criteria' v-on:keyup.enter='addSearchString' autofocus></input>" +
	"<md-chip class='label action' v-for='tag in tags' :key='tag' :title='tag' v-on:click.native='removeTag(tag)'>{{tag}} </md-chip></div>",
	methods: {
		addSearchString: function() {
			if (this.tags === undefined) {
				this.tags = [];
			}
			this.tags.push(this.search);
			this.search = '';
			this.$emit('tags', this.tags);
		},
		removeTag: function(tag) {
			let found = this.tags.indexOf(tag);
			if (found > -1) {
				this.tags.splice(found, 1);
			}
			this.$emit('tags', this.tags);
		}
	}
});

