const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add 'wasm' to the list of supported asset extensions
config.resolver.assetExts.push('wasm');

module.exports = config;
