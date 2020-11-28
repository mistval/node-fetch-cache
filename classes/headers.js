class Headers {
  constructor(rawHeaders) {
    this.rawHeaders = rawHeaders;
  }

  entries() {
    return Object.entries(this.rawHeaders);
  }

  keys() {
    return Object.keys(this.rawHeaders);
  }

  values() {
    return Object.values(this.rawHeaders);
  }

  get(name) {
    return this.rawHeaders[name.toLowerCase()] || null;
  }

  has(name) {
    return !!this.get(name);
  }
}

module.exports = Headers;
