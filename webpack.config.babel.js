
import path from 'path'
import nodeExternals from 'webpack-node-externals'

let inProduction = process.env.NODE_ENV === 'production' || process.argv.indexOf('-p') !== -1

const bundleExtensionConfig = {
  entry: {
    eventPage: ['./src/eventPage'],
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
          sourceMaps: true,
          presets: ['es2015']
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
    ],
    alias: {
      fs: require.resolve('./src/false.js')
    }
  },

  externals: ['request', 'tidy-html5'],

  plugins: [],
  devtool: 'source-map',
  debug: true,
  uglify: inProduction
}

const bundleNpmModuleConfig = {
  entry: './src/FimFic2Epub',

  output: {
    path: path.join(__dirname, '/'),
    filename: './fimfic2epub.js',
    libraryTarget: 'commonjs2'
  },

  target: 'node',

  module: {
    loaders: [
      {
        test: /\.js$/, loader: 'babel', exclude: /node_modules/, query: {
          sourceMaps: !inProduction,
          presets: ['es2015']
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

  externals: [nodeExternals(), 'exports?tidy_html5!tidy-html5'],

  plugins: [],
  devtool: 'source-map',
  debug: true,
  uglify: inProduction
}

export default [bundleExtensionConfig, bundleNpmModuleConfig]
