var thumbnailLoader = LoaderFactory.createImageLoader(1);
var exifLoader = LoaderFactory.createExifLoader(1);

function getPhotoUrl(photo, width) {
	return "/photo/" + photo.id + (width === undefined ? '' : '/' + width);
}

Vue.component('thumbnailPhoto', {
	props: ['photo'],
	template: "<div ref='thumbnail'><slot></slot></div>",
	mounted: function() {
		var photoUrl = getPhotoUrl(this.photo, 300);
		var thumbnail = this.$refs['thumbnail'];
		thumbnailLoader.load(photoUrl).then(function() {
			thumbnail.style.backgroundImage = 'url(' + photoUrl + ')';
		});
	}
});

Vue.component('thumbnail', {
	props: ['photo'],
	template: "<div class='photoThumbnailBox action' :title='photo.key.date' >" +
	"<thumbnail-photo v-on:click.native='onClick' class='photoThumbnail' v-bind:photo='photo.key'>" +
	"<b-popover  :triggers='[\"click\"]' :placement='\"bottom\"' v-if='photo.series.length > 1'><div class='popoverContent' slot='content'>" +
	"<thumbnail-photo v-for='img in photo.series' v-bind:photo='img' class='seriesThumbnail'></thumbnail-photo></div>" +
	"<b-badge>{{photo.series.length}}</b-badge></b-popover></thumbnail-photo>" + "</div>",
	methods: {
		onClick: function() {
			this.$emit('select', this.photo);
		}
	}
});

function stackTrace() {
	var err = new Error();
	return err.stack;
}

Vue.component('photoDetails', {
	props: ['photo', 'exif', 'index', 'size'],
	template: "<div class='exifView'><div>{{index + 1}} / {{size}}</div><div>Date: {{photo ? photo.date : ''}}</div><div class='exifFile' :title='photo ? photo.path: \"\"'>{{photo ? photo.path: \"\"}}</div>" +
	"<div v-for='(exifSection, key) in exif'><div class='exifHeader'>{{key}}</div><table><tbody><tr v-for='(value, key) in exifSection'><td class='key'>{{key}}</td><td>{{value}}</td></tr></tbody></table></div></div></div>"
});

Vue.component('photoSeries', {
	props: ['photo', 'indexSeries'],
	template: "<div class='photoSeries'><div class='seriesContainer'><thumbnail-photo class='seriesThumbnail action' v-for='(img, index) in photo.series' " +
	"@click.native='select(img, index)' :class='[indexSeries == index ? \"selected\" : \"\" ]' v-bind:photo='img'></thumbnail-photo></div></div>",
	methods: {
		select: function(img, index) {
			this.$emit('select', img, index);
		}
	}
});

Vue.component('photoDetailView', {
	props: ['photo', 'size'],
	data: function() {
		return {
			exif: null,
			index: -1,
			indexSeries: 0,
			selectedPhoto: null,
			showLeft: false,
			showRight: false
		};
	},
	template: "<div class='photoDetailView'><div class='photoView action loading' @click='onClick()' ref='photoView'>" +
	"<div @click.stop='onNavigate(\"prev\")' class='navigationPane left' title='navigate to previous' @mousemove='showLeft = true' @mouseover='showLeft = true' @mouseleave='showLeft = false'><div v-show='showLeft' class='navigation left'></div></div>" +
	"<div @click.stop='onNavigate(\"next\")' class='navigationPane right' title='navigate to next' @mousemove='showRight = true' @mouseover='showRight = true' @mouseleave='showRight = false'><div v-show='showRight' class='navigation right'></div></div></div>" +
	"<photo-details v-bind:photo='selectedPhoto' v-bind:exif='exif' v-bind:index='index' v-bind:size='size'></photo-details>" +
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
			this.loadExif(img);
		},

		loadPhoto: function(photoToDisplay) {
			this.selectedPhoto = photoToDisplay;

			this.index = this.$parent.imageItems.indexOf(this.photo);

			var photoView = this.$refs['photoView'];
			photoView.style.backgroundImage = '';
			photoView.classList.add('loading');
			var photoUrl = getPhotoUrl(photoToDisplay, 1000);

			thumbnailLoader.load(photoUrl).then(function() {
				photoView.classList.remove('loading');
				photoView.style.backgroundImage = "url(" + photoUrl + ")";
			});
		},

		loadExif: function(photoToDisplay) {
			// clear exif might still contain previous info
			this.exif = {};
			var _this = this;
			exifLoader.load('/exif/' + photoToDisplay.id)
				.then(function(data) {
					_this.exif = data;
				});
		}
	},

	mounted: function() {
		document.body.classList.add("noScroll");
		this.indexSeries = 0;
		this.loadPhoto(this.photo.key);
		this.loadExif(this.photo.key);
	},

	watch: {
		photo: function(photo, previousPhoto) {
			var index = this.$parent.imageItems.indexOf(photo);
			var oldIndex = this.$parent.imageItems.indexOf(previousPhoto);
			// preserve left/right button visibility
			this.showLeft = index < oldIndex;
			this.showRight = index > oldIndex;
			this.loadPhoto(this.photo.key);
			this.loadExif(this.photo.key);
		}
	}
});

Vue.component('searchTags', {
	props: ['search', 'tags'],
	template: "<div><b-form-input v-model='search' type='text' placeholder='Enter search criteria' v-on:keyup.enter='addSearchString' autofocus></b-form-input>" +
	"<b-badge class='label action' v-for='tag in tags' :title='tag' v-on:click.native='removeTag(tag)'>{{tag}} </b-badge></div>",
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
			var found = this.tags.indexOf(tag);
			if (found > -1) {
				this.tags.splice(found, 1);
			}
			this.$emit('tags', this.tags);
		}
	}
});

