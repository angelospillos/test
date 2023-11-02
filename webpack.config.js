const path = require('path');

module.exports = {
  entry: {
    background: './src/background/background.js',
    injection: './src/injection.js',
    offscreen: './src/offscreen/offscreen.js',
    popup: './src/popup/popup.js',
    recordingMessage: './src/content/executeScripts/recordingMessage.js',
    webappContent: './src/content/webappContent.js',
  },
  output: {
    filename: '[name].js', // '[name]' is replaced by the entry point name
    path: path.resolve(__dirname, 'dist'), // Output directory
  },
  module: {
    rules: [
      {
        test: /\.js$/, // Apply Babel to JavaScript files
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
    ],
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, 'src/'), // Assuming '~' should resolve to the 'src' directory
    },
  },
};
