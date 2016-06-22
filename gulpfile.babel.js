'use strict'

// gulp and utilities
import gulp from 'gulp'
import gutil from 'gulp-util'
import del from 'del'
import Sequence from 'run-sequence'
import watch from 'gulp-watch'
import lazypipe from 'lazypipe'
import filter from 'gulp-filter'

import jsonedit from 'gulp-json-editor'
import zip from 'gulp-zip'

import { execFile } from 'child_process'

// script
import standard from 'gulp-standard'
import webpack from 'webpack'
import webpackConfig from './webpack.config.babel.js'

const sequence = Sequence.use(gulp)

let inProduction = process.env.NODE_ENV === 'production' || process.argv.indexOf('-p') !== -1

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
  devtool: inProduction ? null : 'inline-source-map',
  debug: !inProduction
}))

function webpackTask (callback) {
  // run webpack
  wpCompiler.run(function (err, stats) {
    if (err) throw new gutil.PluginError('webpack', err)
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

let lintPipe = lazypipe()
  .pipe(standard)
  .pipe(standard.reporter, 'default', { breakOnError: false })

// Cleanup task
gulp.task('clean', () => del(['extension/fimfic2epub.js', 'extension/eventPage.js']))

// Main tasks
gulp.task('webpack', webpackTask)
gulp.task('watch:webpack', () => {
  return watch(['src/**/*.js', 'src/**/*.styl'], watchOpts, function () {
    return sequence('webpack')
  })
})

gulp.task('lint', () => {
  return gulp.src(['gulpfile.babel.js', 'webpack.config.babel.js', 'src/**/*.js']).pipe(lintPipe())
})
gulp.task('watch:lint', () => {
  return watch(['src/**/*.js'], watchOpts, function (file) {
    gulp.src(file.path).pipe(lintPipe())
  })
})

// Default task
gulp.task('default', (done) => {
  sequence('clean', ['webpack', 'lint'], done)
})

// Watch task
gulp.task('watch', (done) => {
  sequence('default', ['watch:lint', 'watch:webpack'], done)
})

// creates extensions for chrome and firefox
gulp.task('pack', (done) => {
  sequence('default', ['pack:firefox', 'pack:chrome'], done)
})

gulp.task('pack:firefox', () => {
  let manifest = filter('extension/manifest.json', {restore: true})

  return gulp.src('extension/**/*')
    .pipe(manifest)
    .pipe(jsonedit(function (json) {
      if (json.content_scripts) {
        json.applications = {
          gecko: {
            id: 'fimfic2epub@mozilla.org'
          }
        }
        delete json.background.persistent
      }
      return json
    }))
    .pipe(manifest.restore)
    .pipe(zip('extension.xpi'))
    .pipe(gulp.dest('./'))
})

gulp.task('pack:chrome', (done) => {
  execFile('./packchrome.sh', [], (error, stdout, stderr) => {
    // gutil.log('[pack:chrome]', stdout)
    if (error || stderr) {
      done(new gutil.PluginError('pack:chrome', stderr, {showStack: false}))
      return
    }
    done()
  })
})
