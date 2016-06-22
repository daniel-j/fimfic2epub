'use strict'

import path from 'path'

let inProduction = process.env.NODE_ENV === 'production' || process.argv.indexOf('-p') !== -1

export default {
  entry: {
    fimfic2epub: ['./src/main'],
    eventPage: ['./src/eventPage']
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
          presets: ['es2015-webpack']
        }
      },
      {
        test: /\.styl$/,
        loader: 'raw-loader!stylus-loader'
      }
    ],
    noParse: [
      /[\/\\]node_modules[\/\\]tidy-html5[\/\\]tidy\.js$/
    ]
  },

  resolve: {
    extensions: ['', '.js', '.json', '.styl'],
    modules: [
      path.resolve('./src'),
      'node_modules'
    ]
  },

  plugins: [],

  devtool: 'inline-source-map',
  debug: true
}
