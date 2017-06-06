
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
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        query: {
          sourceMaps: true,
          presets: ['es2015']
        }
      },
      {
        test: /\.styl$/,
        use: ['raw-loader', 'stylus-loader']
      }
    ]
  },

  resolve: {
    extensions: ['.js', '.json', '.styl'],
    modules: [
      path.resolve('./src'),
      'node_modules'
    ],
    alias: {
      fs: require.resolve('./src/false.js')
    }
  },

  externals: ['request'],

  plugins: [],
  devtool: 'source-map'
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
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        query: {
          sourceMaps: !inProduction,
          presets: ['es2015']
        }
      },
      {
        test: /\.styl$/,
        use: ['raw-loader', 'stylus-loader']
      }
    ]
  },

  resolve: {
    extensions: ['.js', '.json', '.styl'],
    modules: [
      path.resolve('./src'),
      'node_modules'
    ]
  },

  externals: [nodeExternals({whitelist: ['es6-event-emitter', /^babel-runtime/]})],

  plugins: [],
  devtool: 'source-map'
}

export default [bundleExtensionConfig, bundleNpmModuleConfig]
