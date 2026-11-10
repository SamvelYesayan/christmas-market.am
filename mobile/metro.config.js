// Metro config. The mobile app lives inside the website's repository, whose root node_modules holds the
// website's React 18 and other web packages. The app must only ever use mobile/node_modules, so the parent
// node_modules folder is blocked: a missing dependency fails loudly instead of silently using a web copy.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const escape = (s) => s.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
const parentModules = path.resolve(__dirname, '..', 'node_modules');

config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : config.resolver.blockList ? [config.resolver.blockList] : []),
  new RegExp(`^${escape(parentModules)}[\\\\/].*`),
];
config.watchFolders = [__dirname];

module.exports = config;
