
import path from 'path'
import nodeExternals from 'webpack-node-externals'

let inProduction = process.env.NODE_ENV === 'production' || process.argv.indexOf('-p') !== -1

const bundleExtensionConfig = {
  entry: {
    eventPage: ['./src/eventPage'],
    fimfic2epub: ['regenerator-runtime/runtime', './src/main']
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
          presets: [['env', {
            targets: {
              browsers: ['chrome 50', 'firefox 47']
            },
            modules: false,
            useBuiltIns: true
          }]]
        }
      },
      {
        test: /\.styl$/,
        use: ['raw-loader', 'stylus-loader']
      },
      {
        test: /\.ttf$/,
        use: 'binary-loader'
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
  devtool: 'source-map',
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
      },
      {
        test: /\.ttf$/,
        use: 'binary-loader'
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

  externals: [nodeExternals({whitelist: [/^babel-runtime/, /fontawesome-webfont\.ttf/]})],

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

const bundleNpmBinaryConfig = {
  entry: './src/cli',

  output: {
    path: path.join(__dirname, '/'),
    filename: './build/fimfic2epub.js'
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
      }
    ]
  },

  resolve: {
    extensions: ['.js', '.json'],
    modules: [
      path.resolve('./src'),
      'node_modules'
    ]
  },

  node: {
    __dirname: false
  },

  externals: [nodeExternals(), {
    './FimFic2Epub': 'require(\'../dist/fimfic2epub\')',
    '../package.json': 'require(\'../package.json\')'
  }],

  plugins: [],
  performance: {
    hints: false
  },
  optimization: {
    concatenateModules: inProduction,
    minimize: inProduction
  },
  devtool: false,
  mode: inProduction ? 'production' : 'development'
}

const bundleStaticNpmModuleConfig = {
  entry: './src/cli',

  output: {
    path: path.join(__dirname, '/'),
    filename: './build/fimfic2epub-static.js'
  },

  target: 'node',

  module: {
    rules: [
      {
        test: /\.styl$/,
        use: ['raw-loader', 'stylus-loader']
      },
      {
        test: /\.ttf$/,
        use: 'binary-loader'
      }
    ]
  },

  resolve: {
    extensions: ['.js', '.json', '.styl'],
    modules: [
      path.resolve('./bin'),
      'node_modules'
    ]
  },

  node: {
    __dirname: false
  },

  plugins: [],
  performance: {
    hints: false
  },
  optimization: {
    concatenateModules: inProduction,
    minimize: inProduction
  },
  devtool: false,
  mode: inProduction ? 'production' : 'development'
}

export default [
  bundleExtensionConfig,
  bundleNpmModuleConfig,
  bundleNpmBinaryConfig,
  bundleStaticNpmModuleConfig
]
