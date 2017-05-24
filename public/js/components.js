function getPhotoUrl(photo, width) {
	return "/photo/" + photo.id + (width === undefined ? '' : '/' + width);
}

Vue.component('thumbnailPhoto', {
	props: ['photo'],
	template: "<div :style=\"{ backgroundImage: 'url(/photo/' + photo.id + '/' + 300 + ')' }\"><slot></slot></div>"
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

Vue.component('photoDetails', {
	props: ['photo', 'exif', 'index', 'size'],
	template: "<div class='exifView'><div>{{index + 1}} / {{size}}</div><div>Date: {{photo.key.date}}</div><div class='exifFile' :title='photo.key.path'>{{photo.key.path}}</div>" +
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
	},
	created: function() {
		console.log('created!');
	},
	beforeUpdate: function() {
		console.log('update!');
	}

});

Vue.component('photoDetailView', {
	props: ['photo', 'exif', 'showLeft', 'showRight', 'index', 'size', 'indexSeries'],
	template: "<div class='photoDetailView'><div class='photoView action loading' @click='onClick()' ref='photoView'>" +
	"<div @click.stop='onNavigate(\"prev\")' class='navigationPane left' title='navigate to previous' @mousemove='showLeft = true' @mouseover='showLeft = true' @mouseleave='showLeft = false'><div v-show='showLeft' class='navigation left'></div></div>" +
	"<div @click.stop='onNavigate(\"next\")' class='navigationPane right' title='navigate to next' @mousemove='showRight = true' @mouseover='showRight = true' @mouseleave='showRight = false'><div v-show='showRight' class='navigation right'></div></div></div>" +
	"<photo-details v-bind:photo='photo' v-bind:exif='exif' v-bind:index='index' v-bind:size='size'></photo-details>" +
	"<photo-series v-if='photo.series.length > 1' v-on:select='selectSeriesPhoto' v-bind:photo='photo' v-bind:indexSeries='indexSeries'></photo-series>",
	methods: {
		onNavigate: function(direction) {
			this.$emit(direction, this.photo);
		},
		onClick: function() {
			this.$emit('close');
			document.body.classList.remove("noScroll");
		},

		selectSeriesPhoto: function(img, indexSeries) {
			// TODO also update path, maybe create a selectedPhoto prop?
			// TODO highlight selected photo
			this.indexSeries = indexSeries;
			this.loadPhoto(img);
			this.loadExif(img);
		},

		loadPhoto: function(photoToDisplay) {
			this.index = this.$parent.imageItems.indexOf(this.photo);
			this.size = this.$parent.imageItems.length;

			var photoView = this.$refs['photoView'];
			photoView.style.backgroundImage = '';
			photoView.classList.add('loading');
			var photoUrl = getPhotoUrl(photoToDisplay, 1000);
			var img = new Image();
			img.onload = function() {
				photoView.classList.remove('loading');
				photoView.style.backgroundImage = "url(" + photoUrl + ")";
			};
			img.src = photoUrl;
		},

		loadExif: function(photoToDisplay) {
			// clear exif if take long
			this.exif = {};
			var _this = this;
			this.$http.get('/exif/' + photoToDisplay.id)
				.then(function(response) {
					_this.exif = response.body;
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