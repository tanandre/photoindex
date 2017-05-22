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
	"<b-badge>{{photo.series.length}}</b-badge></b-popover></thumbnail-photo>" +
	"</div>",
	methods: {
		onClick: function() {
			console.log('test', this.photo.key);
			this.$emit('select', this.photo.key);
		}
	}
});

Vue.component('photoDetailView', {
	props: ['photo', 'exif'],
	template: "<div class='photoDetailView'><div class='photoView action loading' @click='onClick()'><div class='leftArrow'>Left</div><div class='rightArrow'>right</div></div><div class='exifView'>" +
	"<div>Date: {{photo.date}}</div><div class='exifFile' :title='photo.path'>File: {{photo.path}}</div>" +
	"<div v-for='(exifSection, key) in exif'><div class='exifHeader'>{{key}}</div><table><tbody><tr v-for='(value, key) in exifSection'><td class='key'>{{key}}</td><td>{{value}}</td></tr></tbody></table></div></div></div>",
	methods: {
		onClick: function() {
			this.$emit('close');
			document.body.classList.remove("noScroll");
		}
	},
	mounted: function() {
		var _this = this;
		document.body.classList.add("noScroll");
		var photoUrl = getPhotoUrl(_this.photo, 1000);
		var img = new Image();
		img.onload = function() {
			_this.$el.firstChild.classList.remove('loading');
			_this.$el.firstChild.style.backgroundImage = "url(" + photoUrl + ")";
		};
		img.src = photoUrl;

		_this.$http.get('/exif/' + _this.photo.id)
			.then(function(response) {
				_this.exif = response.body;
			});
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