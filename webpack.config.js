// @ts-check
'use strict';
const path = require('path')
const fs = require('fs')

var nodeModules = {}
fs.readdirSync('node_modules')
  .filter(x => ['.bin'].indexOf(x) === -1)
  .forEach(mod => nodeModules[mod] = 'commonjs ' + mod)

module.exports = {
  context: __dirname,
  devtool: 'inline-source-map',
  entry: './src/index.ts',
  output: { filename: 'index.js', path: path.resolve(__dirname, 'build') },
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  target: 'node',
  // externals: nodeModules,
  module: {
    rules: [
      {
        test: /\.(ts|js)$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.tlsp$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[path][name].[ext]'
            },
          },
        ]
      },
    ]
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js']
  },
  optimization: {
    usedExports: true
  }
}
