const webpack = require('webpack');

module.exports = function override(config, env) {
  // Add polyfills for Node.js core modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "buffer": require.resolve("buffer/"),
    "url": require.resolve("url/"),
    "https": require.resolve("https-browserify"),
    "querystring": require.resolve("querystring-es3"),
    "stream": require.resolve("stream-browserify"),
    "http": require.resolve("stream-http"),
    "crypto": require.resolve("crypto-browserify"),
    "zlib": require.resolve("browserify-zlib"),
    "assert": require.resolve("assert/"),
    "path": require.resolve("path-browserify"),
    "util": require.resolve("util/"),
    "fs": false,
    "os": require.resolve("os-browserify/browser"),
    "net": false,
    "tls": false,
    "child_process": false
  };

  // Add buffer polyfill
  config.plugins.push(
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    })
  );

  // Add process polyfill
  config.plugins.push(
    new webpack.ProvidePlugin({
      process: 'process/browser',
    })
  );

  return config;
};
