const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: 'production',
  entry: './src/sdk/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '0g-sdk.bundle.js',
    library: 'ZeroGSDK',
    libraryTarget: 'umd',
    globalObject: 'this'
  },
  resolve: {
    extensions: ['.ts', '.js'],
    fallback: {
      fs: false,
      path: false,
      crypto: false
    },
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: 'tsconfig.sdk.json'
            }
          }
        ],
        exclude: /node_modules/
      }
    ]
  },
  plugins: [
    new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
      resource.request = resource.request.replace(/^node:/, '');
    })
  ]
}; 