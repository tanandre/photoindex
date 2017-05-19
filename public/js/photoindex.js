function getPhotoUrl(photo, width) {
	return "/photo/" + photo.id + (width === undefined ? '' : '/' + width);
}

Vue.component('thumbnail', {
	props: ['photo'],
	template: "<div class='photoThumbnail action' :style=\"{ backgroundImage: 'url(/photo/' + photo.id + '/' + 300 + ')' }\"><div class='photoText'>{{photo.date}}</div></div>"
});

Vue.component('photoDetailView', {
	props: ['photo', 'exif'],
	template: "<div class='photoDetailView'><div class='photoView action loading' @click='onClick()'></div><div class='exifView'>{{exif}}</div></div>",
	methods: {
		onClick: function() {
			this.$emit('close');
			document.body.classList.remove("noScroll");
		}
	},
	mounted: function() {
		var _this = this;
		document.body.classList.add("noScroll");
		// TODO display exif data nicely
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
		selectedImage: null
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

		displayPhoto: function(img) {
			this.selectedImage = img;
			console.log('selected image', img);
		}

	}
});
