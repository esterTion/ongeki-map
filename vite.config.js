export default {
	base: './',
	build: {
		target: ['ios12'],
		minify: true,
		sourcemap: false,
		assetsDir: '',
		rollupOptions: {
			output: {
				manualChunks: {
					'chunk-threejs': ['three', 'three/addons'],
				},
			},
		},
	}
}
