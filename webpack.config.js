const path = require('path');

var mode = process.env.NODE_ENV || 'development';

module.exports = {
  entry: './src/index.ts',
  devtool: mode === 'development' ? 'inline-source-map' : false,
  mode: mode,
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  devServer: {
    contentBase: path.join(__dirname, 'dist'),
    compress: true,
    port: 8080
  },
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
  },
};