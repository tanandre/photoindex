const Bar = {template: '<div>bar</div>'}
const Album = {template: '<div>Album</div>'}

const routes = [{
	path: '/bar',
	component: Bar
}, {
	path: '/album',
	component: Album
}]

const router = new VueRouter({
	routes // short for routes: routes
})

var app = new Vue({
	router,
	el: '#app',
	data: {
		title: 'dre\'s album',
		images: [],
		selectedImage: null,
		currentPage: 1,
		imagesPerPage: 100,
		currentRoute: window.location.pathname,
		search: ''
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

		addSearchString: function(msg) {
			console.log(msg);
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
}).$mount('#app');
