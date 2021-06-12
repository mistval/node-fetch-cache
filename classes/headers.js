class Headers {
  constructor(rawHeaders) {
    this.rawHeaders = rawHeaders;
  }

  entries() {
    return Object.entries(this.rawHeaders)
      .sort((e1, e2) => e1[0].localeCompare(e2[0]))
      .map(([key, val]) => [key, val[0]]);
  }

  keys() {
    return this.entries().map((e) => e[0]);
  }

  values() {
    return this.entries().map((e) => e[1]);
  }

  get(name) {
    return (this.rawHeaders[name.toLowerCase()] || [])[0] || null;
  }

  has(name) {
    return !!this.get(name);
  }

  raw() {
    return this.rawHeaders;
  }
}

module.exports = Headers;
