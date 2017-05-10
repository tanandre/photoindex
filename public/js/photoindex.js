var app = new Vue({
	el: '#app',
	data: {
		title: 'Andre\'s Album',
		images: []
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
			console.log('display 1 !');
		}

	}
});
