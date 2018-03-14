
// gulp and utilities
import gulp from 'gulp'
import gutil from 'gulp-util'
import del from 'del'
import Sequence from 'run-sequence'
import watch from 'gulp-watch'
import lazypipe from 'lazypipe'
import filter from 'gulp-filter'
import change from 'gulp-change'
import rename from 'gulp-rename'
import banner from 'gulp-banner'
import chmod from 'gulp-chmod'

import jsonedit from 'gulp-json-editor'
import zip from 'gulp-zip'

// import { execFile, exec } from 'child_process'

// script
import standard from 'gulp-standard'
import webpack from 'webpack'
import webpackConfig from './webpack.config.babel.js'

const sequence = Sequence.use(gulp)

// const inProduction = process.env.NODE_ENV === 'production' || process.argv.indexOf('-p') !== -1

const isStandalone = process.argv.includes('--standalone')

if (isStandalone) {
  webpackConfig.shift()
  webpackConfig.shift()
  webpackConfig.shift()
} else {
  webpackConfig.pop()
}

let watchOpts = {
  readDelay: 500,
  verbose: true,
  read: false
}

let packageVersion = require('./package.json').version

let webpackDefines = new webpack.DefinePlugin({
  FIMFIC2EPUB_VERSION: JSON.stringify(packageVersion)
})

webpackConfig.forEach((c) => {
  c.plugins.push(webpackDefines)
})

let wpCompiler = webpack(webpackConfig)

function webpackTask (callback) {
  if (webpackDefines.definitions.FIMFIC2EPUB_VERSION !== JSON.stringify(packageVersion)) {
    webpackDefines.definitions.FIMFIC2EPUB_VERSION = JSON.stringify(packageVersion)
    wpCompiler = webpack(webpackConfig)
  }

  // run webpack compiler
  wpCompiler.run(function (err, stats) {
    if (err) throw new gutil.PluginError('webpack', err)
    gutil.log('[webpack]', stats.toString({
      colors: true,
      hash: false,
      version: false,
      chunks: false,
      timings: false,
      modules: false,
      chunkModules: false,
      cached: false,
      maxModules: 0
    }))
    if (!isStandalone) {
      sequence('pack', callback)
    } else {
      sequence('binaries', callback)
    }
  })
}

function convertFontAwesomeVars (contents) {
  let vars = {}
  let matchVar = /\$fa-var-(.*?): "\\(.*?)";/g
  let ma
  for (;(ma = matchVar.exec(contents));) {
    vars[ma[1]] = String.fromCharCode(parseInt(ma[2], 16))
  }
  return JSON.stringify(vars)
}

let lintPipe = lazypipe()
  .pipe(filter, ['**/*', '!src/lib/**/*'])
  .pipe(standard)
  .pipe(standard.reporter, 'default', { breakOnError: false })

// Cleanup task
gulp.task('clean', () => del([
  'bin/',
  'build/',
  'extension/build/',
  'dist/',
  'extension.zip',
  'extension.xpi',
  'extension.crx',
  'fimfic2epub.safariextension/'
]))

gulp.task('version', (done) => {
  delete require.cache[require.resolve('./package.json')]
  packageVersion = require('./package.json').version
  done()
})

// Main tasks
gulp.task('webpack', ['version', 'fontawesome'], webpackTask)
gulp.task('binaries', ['version'], () => {
  return gulp.src(['build/fimfic2epub.js', 'build/fimfic2epub-static.js'])
    .pipe(rename({ extname: '' }))
    .pipe(banner('#!/usr/bin/env node\n// fimfic2epub ' + packageVersion + '\n'))
    .pipe(chmod(0o777))
    .pipe(gulp.dest('bin/'))
})
gulp.task('watch:webpack', () => {
  return watch(['src/**/*.js', 'src/**/*.styl', './package.json'], watchOpts, () => {
    return sequence('webpack')
  })
})

gulp.task('lint', () => {
  return gulp.src(['gulpfile.babel.js', 'webpack.config.babel.js', 'src/**/*.js']).pipe(lintPipe())
})
gulp.task('watch:lint', () => {
  return watch(['src/**/*.js', 'gulpfile.babel.js', 'webpack.config.babel.js'], watchOpts, (file) => {
    return gulp.src(file.path).pipe(lintPipe())
  })
})

// Default task
gulp.task('default', (done) => {
  sequence('clean', ['webpack', 'lint'], done)
})

// Watch task
gulp.task('watch', (done) => {
  sequence('default', ['watch:lint', 'watch:pack', 'watch:webpack'], done)
})

gulp.task('fontawesome', () => {
  return gulp.src('node_modules/font-awesome/scss/_variables.scss')
    .pipe(change(convertFontAwesomeVars))
    .pipe(rename({
      basename: 'font-awesome-codes',
      extname: '.json',
      dirname: ''
    }))
    .pipe(gulp.dest('build/'))
})
gulp.task('pack', ['binaries'], (done) => {
  sequence(['pack:firefox', 'pack:chrome'], done)
})
gulp.task('watch:pack', () => {
  return watch(['extension/**/*', '!extension/build/**/*'], watchOpts, () => {
    return sequence('pack')
  })
})

gulp.task('pack:firefox', ['version'], () => {
  const manifest = filter('extension/manifest.json', {restore: true})

  return gulp.src('extension/**/*')
    .pipe(manifest)
    .pipe(jsonedit((json) => {
      json.version = packageVersion
      if (json.content_scripts) {
        // tweak the manifest so Firefox can read it
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

gulp.task('pack:chrome', ['version'], (done) => {
  const manifest = filter('extension/manifest.json', {restore: true})

  return gulp.src('extension/**/*')
    .pipe(manifest)
    .pipe(jsonedit({
      version: packageVersion
    }))
    .pipe(manifest.restore)
    .pipe(zip('extension.zip'))
    .pipe(gulp.dest('./'))
})

/*
gulp.task('pack:safari', (done) => {
  exec('rm -rf fimfic2epub.safariextension/; cp -r extension/ fimfic2epub.safariextension', [], (error, stdout, stderr) => {
    // gutil.log('[pack:safari]', stdout)
    if (error || stderr) {
      done(new gutil.PluginError('pack:safari', stderr, {showStack: false}))
      return
    }
    done()
  })
})
*/
