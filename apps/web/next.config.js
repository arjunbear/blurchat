//@ts-check
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // monorepo root, so Next traces deps from the right place
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

module.exports = nextConfig;
