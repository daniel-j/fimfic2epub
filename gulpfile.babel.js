
// gulp and utilities
import gulp from 'gulp'
import gutil from 'gulp-util'
import del from 'del'
import watch from 'gulp-watch'
import filter from 'gulp-filter'
import change from 'gulp-change'
import rename from 'gulp-rename'
import banner from 'gulp-banner'
import chmod from 'gulp-chmod'

import jsonedit from 'gulp-json-editor'
import zip from 'gulp-zip'
import removeNPMAbsolutePaths from 'removeNPMAbsolutePaths'

// import { execFile, exec } from 'child_process'

// script
import standard from 'gulp-standard'
import webpack from 'webpack'
import webpackConfig from './webpack.config.babel.js'

const inProduction = process.env.NODE_ENV === 'production' || process.argv.indexOf('-p') !== -1

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

// No need to bloat the build with a list of all tlds...
let replaceTlds = new webpack.NormalModuleReplacementPlugin(/^tlds$/, '../../src/false')

webpackConfig.forEach((c) => {
  c.plugins.push(webpackDefines)
  c.plugins.push(replaceTlds)
})

let wpCompiler = webpack(webpackConfig)

function webpackTask () {
  return new Promise((resolve, reject) => {
    if (webpackDefines.definitions.FIMFIC2EPUB_VERSION !== JSON.stringify(packageVersion)) {
      webpackDefines.definitions.FIMFIC2EPUB_VERSION = JSON.stringify(packageVersion)
      wpCompiler = webpack(webpackConfig)
    }

    let p = Promise.resolve()
    if (inProduction) {
      p = removeNPMAbsolutePaths('node_modules')
    }

    p.then((results) => {
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
        resolve()
      })
    }).catch((err) => { throw err })
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

function lintPipe (stream) {
  return stream
    .pipe(filter(['**/*', '!src/lib/**/*']))
    .pipe(standard())
    .pipe(standard.reporter('default', { breakOnError: false }))
}

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

gulp.task('version', () => {
  delete require.cache[require.resolve('./package.json')]
  packageVersion = require('./package.json').version
  return Promise.resolve()
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

gulp.task('binaries', gulp.series('version', function binariesTask () {
  return gulp.src(['build/fimfic2epub.js', 'build/fimfic2epub-static.js'])
    .pipe(rename({ extname: '' }))
    .pipe(banner('#!/usr/bin/env node\n// fimfic2epub ' + packageVersion + '\n'))
    .pipe(chmod(0o777))
    .pipe(gulp.dest('bin/'))
}))

gulp.task('pack:firefox', gulp.series('version', function packFirefox () {
  const manifest = filter('extension/manifest.json', { restore: true })

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
}))

gulp.task('pack:chrome', gulp.series('version', function packChrome () {
  const manifest = filter('extension/manifest.json', { restore: true })

  return gulp.src('extension/**/*')
    .pipe(manifest)
    .pipe(jsonedit({
      version: packageVersion
    }))
    .pipe(manifest.restore)
    .pipe(zip('extension.zip'))
    .pipe(gulp.dest('./'))
}))
gulp.task('pack', gulp.parallel('pack:firefox', 'pack:chrome'))

// Main tasks
gulp.task('webpack', gulp.series(gulp.parallel('version', 'fontawesome'), webpackTask, isStandalone ? 'binaries' : 'pack'))

gulp.task('watch:webpack', () => {
  return watch(['src/**/*.js', 'src/**/*.styl', './package.json'], watchOpts, gulp.series('webpack'))
})

gulp.task('lint', () => {
  return lintPipe(gulp.src(['gulpfile.babel.js', 'webpack.config.babel.js', 'src/**/*.js']))
})
gulp.task('watch:lint', () => {
  return watch(['src/**/*.js', 'gulpfile.babel.js', 'webpack.config.babel.js'], watchOpts, (file) => {
    return lintPipe(gulp.src(file.path))
  })
})

// Default task
gulp.task('default', gulp.series('clean', gulp.parallel('webpack', 'lint')))

gulp.task('watch:pack', () => {
  return watch(['extension/**/*', '!extension/build/**/*'], watchOpts, gulp.series('pack'))
})

// Watch task
gulp.task('watch', gulp.series('default', gulp.parallel('watch:lint', 'watch:pack', 'watch:webpack')))

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
