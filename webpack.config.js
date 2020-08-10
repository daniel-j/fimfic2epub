
import path from 'path'
import nodeExternals from 'webpack-node-externals'

const inProduction = process.env.NODE_ENV === 'production' || process.argv.indexOf('-p') !== -1

const bundleExtensionConfig = {
  entry: {
    eventPage: ['./src/eventPage'],
    fimfic2epub: ['regenerator-runtime/runtime', './src/main']
  },

  output: {
    path: path.join(__dirname, '/extension/build'),
    filename: './[name].js'
  },

  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [['@babel/env', {
              targets: {
                browsers: ['chrome 50', 'firefox 47']
              },
              modules: false
            }]]
          }
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

  externals: ['node-fetch'],

  plugins: [
    // new (require('webpack-bundle-analyzer').BundleAnalyzerPlugin)()
  ],
  performance: {
    hints: false
  },
  optimization: {
    concatenateModules: inProduction,
    minimize: inProduction,
    splitChunks: {
      chunks: 'all',
      automaticNameDelimiter: '_'
    }
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
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            sourceMaps: !inProduction,
            presets: [['@babel/env', {
              targets: {
                node: '8.0.0'
              }
            }]]
          }
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
    extensions: ['.js', '.json', '.styl', '.node'],
    modules: [
      path.resolve('./src'),
      'node_modules'
    ]
  },

  node: {
    __dirname: false
  },

  externals: [nodeExternals({ allowlist: [/^babel-runtime/, /fontawesome-webfont\.ttf/] })],

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
    path: path.join(__dirname, '/build'),
    filename: './fimfic2epub.js'
  },

  target: 'node',

  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            sourceMaps: !inProduction,
            presets: [['@babel/env', {
              targets: {
                node: '8.0.0'
              }
            }]]
          }
        }
      }
    ]
  },

  resolve: {
    extensions: ['.js', '.json', '.node'],
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
    path: path.join(__dirname, '/build'),
    filename: './fimfic2epub.js'
  },

  target: 'node',

  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            sourceMaps: !inProduction,
            presets: [['@babel/env', {
              targets: {
                node: 'current'
              }
            }]]
          }
        }
      },
      {
        test: /\.styl$/,
        use: ['raw-loader', 'stylus-loader']
      },
      {
        test: /\.ttf$/,
        use: 'binary-loader'
      },
      {
        test: /\.node$/,
        loader: 'node-loader',
        options: {
          name: '[name].[ext]'
        }
      }
    ]
  },

  resolve: {
    extensions: ['.js', '.json', '.styl', '.node'],
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
