Vue.component('thumbnail', {
	props: ['photo'],
	template: "<div class='photoThumbnail action' :style=\"{ backgroundImage: 'url(/photo?path=' + encodeURIComponent(photo.path) + ')' }\"><div class='photoText'>{{photo.date}}</div></div>"
});

Vue.component('photoDetailView', {
	props: ['photo'],
	template: "<div class='photoDetailView'><div class='photo' @click='onClick()' :style=\"{ backgroundImage: 'url(/photo?path=' + encodeURIComponent(photo.path) + ')' }\"></div>",
	methods: {
		onClick: function() {
			this.$emit('close');
		}
	}
});

var app = new Vue({
	el: '#app',
	data: {
		title: 'Andre\'s Album',
		images: [],
		selectedImage: null,
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
