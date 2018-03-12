
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
    filename: './extension/build/[name].js'
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
    ]
  },

  node: {
    fs: 'empty'
  },

  externals: ['request'],

  plugins: [
    // new (require('webpack-bundle-analyzer').BundleAnalyzerPlugin)()
  ],
  performance: {
    hints: false
  },
  optimization: {
    concatenateModules: inProduction,
    minimize: inProduction
  },
  devtool: inProduction ? 'nosources-source-map' : 'source-map',
  mode: inProduction ? 'production' : 'development'
}

const bundleNpmModuleConfig = {
  entry: './src/FimFic2Epub',

  output: {
    path: path.join(__dirname, '/'),
    filename: './dist/fimfic2epub.js',
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
          presets: [['env', {
            targets: {
              node: '8.0.0'
            }
          }]]
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

  node: {
    __dirname: false
  },

  externals: [nodeExternals({whitelist: ['es6-event-emitter', /^babel-runtime/]})],

  plugins: [],
  performance: {
    hints: false
  },
  optimization: {
    concatenateModules: inProduction,
    minimize: inProduction
  },
  devtool: 'nosources-source-map',
  mode: inProduction ? 'production' : 'development'
}

export default [bundleExtensionConfig, bundleNpmModuleConfig]
