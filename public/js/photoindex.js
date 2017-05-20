function getPhotoUrl(photo, width) {
	return "/photo/" + photo.id + (width === undefined ? '' : '/' + width);
}

Vue.component('thumbnail', {
	props: ['photo'],
	template: "<div class='photoThumbnailBox action' :title='photo.date' >" +
		"<div class='photoThumbnail' :style=\"{ backgroundImage: 'url(/photo/' + photo.id + '/' + 300 + ')' }\"></div>"+
	"</div>"
});

Vue.component('photoDetailView', {
	props: ['photo', 'exif'],
	template: "<div class='photoDetailView'><div class='photoView action loading' @click='onClick()'></div><div class='exifView'>" +
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
				console.log('exif', response.body);
				_this.exif = response.body;
			});
	}
});

var app = new Vue({
	el: '#app',
	data: {
		title: 'Andre\'s Album',
		images: [],
		selectedImage: null,
		currentPage: 1,
		imagesPerPage: 100
	},
	mounted: function() {
		this.fetchImages();
	},

	methods: {
		fetchImages: function() {
			this.$http.get('/listing').then(function(response) {
				this.images = response.body;
			});
		},

		onClickThumbnail: function(img) {
			this.displayPhoto(img);
		},

		displayPhoto: function(img) {
			this.selectedImage = img;
			console.log('selected image', img);
		},
		getImagesForPage: function() {
			var startIndex = (this.currentPage - 1) * this.imagesPerPage;
			return this.images.slice(startIndex, startIndex + this.imagesPerPage);
		}
	}
});
