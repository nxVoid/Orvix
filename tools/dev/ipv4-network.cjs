// SPDX-License-Identifier: AGPL-3.0-or-later
// Opt-in workaround for Docker DNS/network-family selection in this dev workspace.
const dns = require('node:dns');
const net = require('node:net');
const services = new Set(['postgres', 'nats', 'meilisearch', 'valkey', 'livekit', 'mailpit']);
const lookup = dns.lookup.bind(dns);
net.setDefaultAutoSelectFamily(false);
dns.lookup = function(host, options, callback) {
  if (!services.has(host)) return lookup(host, options, callback);
  if (typeof options === 'function') return lookup(host, {family: 4}, options);
  if (typeof options === 'number') return lookup(host, options || 4, callback);
  return lookup(host, {...options, family: options?.family || 4}, callback);
};
const promiseLookup = dns.promises.lookup.bind(dns.promises);
dns.promises.lookup = function(host, options) {
  if (!services.has(host)) return promiseLookup(host, options);
  return promiseLookup(host, typeof options === 'number' ? options || 4 : {...options, family: options?.family || 4});
};
