'use strict'


// gulp and utilities
import gulp from 'gulp'
import gutil from 'gulp-util'
import del from 'del'
import mergeStream from 'merge-stream'
import Sequence from 'run-sequence'
import watch from 'gulp-watch'
import lazypipe from 'lazypipe'

// script
import eslint from 'gulp-eslint'
import webpack from 'webpack'
import webpackConfig from './webpack.config.babel.js'

const sequence = Sequence.use(gulp)

let inProduction = process.env.NODE_ENV === 'production' || process.argv.indexOf('-p') !== -1

let eslintOpts = {
	envs: ['browser', 'node'],
	rules: {
		'strict': 0,
		'semi': [1, 'never'],
		'quotes': [1, 'single'],
		'space-infix-ops': [0, {'int32Hint': true}],
		'no-empty': 0
	}
}


let watchOpts = {
	readDelay: 500,
	verbose: true
}

if (inProduction) {
	webpackConfig.plugins.push(new webpack.optimize.DedupePlugin())
	webpackConfig.plugins.push(new webpack.optimize.OccurenceOrderPlugin(false))
	webpackConfig.plugins.push(new webpack.optimize.UglifyJsPlugin({
		compress: {
			warnings: false,
			screw_ie8: true
		},
		comments: false,
		mangle: {
			screw_ie8: true
		},
		screw_ie8: true,
		sourceMap: false
	}))
}

let wpCompiler = webpack(Object.assign({}, webpackConfig, {
	cache: {},
	devtool: inProduction? null:'inline-source-map',
	debug: !inProduction
}))

function webpackTask(callback) {
	// run webpack
	wpCompiler.run(function(err, stats) {
		if(err) throw new gutil.PluginError('webpack', err)
		gutil.log('[webpack]', stats.toString({
			colors: true,
			hash: false,
			version: false,
			chunks: false,
			chunkModules: false
		}))
		callback()
	})
}


let lintESPipe = lazypipe()
	.pipe(eslint, eslintOpts)
	.pipe(eslint.format)

// Cleanup tasks
gulp.task('clean', () => del('build'))

gulp.task('clean:script', () => {
	return del('build/script')
})


// Main tasks
gulp.task('webpack', webpackTask)
gulp.task('script', ['webpack'])
gulp.task('watch:script', () => {
	return watch(['src/**/*.js'], watchOpts, function () {
		return sequence('script')
	})
})



gulp.task('lint', () => {
	return gulp.src(['src/**/*.js']).pipe(lintESPipe())
})
gulp.task('watch:lint', () => {
	return watch(['src/**/*.js'], watchOpts, function (file) {
		gulp.src(file.path).pipe(lintESPipe())
	})
})

// Default task
gulp.task('default', (done) => {
	sequence('clean', ['script', 'lint'], done)
})

// Watch task
gulp.task('watch', (done) => {
	sequence('default', ['watch:lint', 'watch:script'], done)
})