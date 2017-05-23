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
	"<b-popover  :triggers='[\"click\",\"hover\"]' :placement='\"bottom\"' v-if='photo.series.length > 1'><div class='popoverContent' slot='content'>" +
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

Vue.component('photoDetailView', {
	props: ['photo', 'exif', 'showLeft', 'showRight', 'index', 'size'],
	template: "<div class='photoDetailView'><div class='photoView action loading' @click='onClick()' ref='photoView'>" +
	"<div @click.stop='onNavigate(\"prev\")' class='navigationPane left' title='navigate to previous' @mousemove='showLeft = true' @mouseover='showLeft = true' @mouseleave='showLeft = false'><div v-show='showLeft' class='navigation left'></div></div>" +
	"<div @click.stop='onNavigate(\"next\")' class='navigationPane right' title='navigate to next' @mouseover='showRight = true' @mouseleave='showRight = false'><div v-show='showRight' class='navigation right'></div></div></div>" +
	"<photo-details v-bind:photo='photo' v-bind:exif='exif' v-bind:index='index' v-bind:size='size'></photo-details>",
	methods: {
		onNavigate: function(direction) {
			this.$emit(direction, this.photo);
		},
		onClick: function() {
			this.$emit('close');
			document.body.classList.remove("noScroll");
		},
		loadPhoto: function() {
			this.index = this.$parent.imageItems.indexOf(this.photo);
			this.size = this.$parent.imageItems.length;

			var photoView = this.$refs['photoView'];
			photoView.style.backgroundImage = '';
			photoView.classList.add('loading');
			var photoUrl = getPhotoUrl(this.photo.key, 1000);
			var img = new Image();
			img.onload = function() {
				photoView.classList.remove('loading');
				photoView.style.backgroundImage = "url(" + photoUrl + ")";
			};
			img.src = photoUrl;
		},

		loadExif: function() {
			var _this = this;
			this.$http.get('/exif/' + _this.photo.key.id)
				.then(function(response) {
					_this.exif = response.body;
				});
		}
	},

	mounted: function() {
		document.body.classList.add("noScroll");
		this.loadPhoto();
		this.loadExif();
	},

	watch: {
		photo: function() {
			this.loadPhoto();
			this.loadExif();
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