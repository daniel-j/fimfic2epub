'use strict'

// import webpack from 'webpack'
import path from 'path'

let inProduction = process.env.NODE_ENV === 'production' || process.argv.indexOf('-p') !== -1

export default {
  entry: {
    fimfic2epub: ['./src/main']
  },
  output: {
    path: path.join(__dirname, '/'),
    filename: './extension/[name].js'
  },
  module: {
    loaders: [
      {
        test: /\.js$/, loader: 'babel', exclude: /node_modules/, query: {
          sourceMaps: inProduction,
          presets: ['es2015'],
          plugins: ['transform-strict-mode']
        }
      }
    ],
    noParse: [
      /[\/\\]node_modules[\/\\]tidy-html5[\/\\]tidy\.js$/
    ]
  },

  resolve: {
    extensions: ['', '.js', '.json'],
    root: [path.join(__dirname, '/src')]
  },

  plugins: [],

  devtool: 'inline-source-map',
  debug: true
}
