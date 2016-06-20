'use strict'

import webpack from 'webpack'

let inProduction = process.env.NODE_ENV === 'production' || process.argv.indexOf('-p') !== -1

export default {
	entry: {
		fimfic2epub: ['./src/main']
	},
	output: {
		path: __dirname + '/',
		filename: './extension/[name].js',
		chunkFilename: './build/[id].js'
	},
	module: {
		loaders: [
			{
				test: /\.js$/, loader: 'babel', exclude: /node_modules/, query: {
					sourceMaps: inProduction,
					//presets: ['es2015'],
					//plugins: ['transform-strict-mode']
				}
			}
		],
		noParse: [
			/[\/\\]node_modules[\/\\]tidy-html5[\/\\]tidy\.js$/
		]
	},

	resolve: {
		extensions: ['', '.js', '.json'],
		root: [__dirname+'/src']
	},

	plugins: [

		new webpack.ProvidePlugin({
			// Detect and inject
			//tidy: 'tidy-html5'
		}),
		new webpack.DefinePlugin({
			
		})
	],

	devtool: 'inline-source-map',
	debug: true
}
