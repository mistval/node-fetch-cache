/* This is a bit of a hack to deal with the case when the user
 * consumes the response body in their `shouldCacheResponse` delegate.
 * The response body can only be consumed once, so if the user consumes
 * it then we wouldn't be able to read it again to write it to the cache.
 * This shim allows us to intercept the parsed body in that case and repackage
 * it into a fresh stream to cache. This of course doesn't work if the user
 * reads response.body directly, but that's not going to be likely.
 * My initial inclination was to use Response.prototype.clone() for this,
 * but the problems with backpressure seem significant. */
export function shimResponseToSnipeBody(
  response: Response,
  replaceBodyStream: (stream: ReadableStream) => void,
) {
  const origArrayBuffer = response.arrayBuffer;
  response.arrayBuffer = async function () {
    const arrayBuffer = await origArrayBuffer.call(this);
    replaceBodyStream(new Blob([arrayBuffer]).stream());
    return arrayBuffer;
  };

  const origJson = response.json;
  response.json = async function () {
    const json = await origJson.call(this);
    replaceBodyStream(new Blob([JSON.stringify(json)]).stream());
    return json;
  };

  const origText = response.text;
  response.text = async function () {
    const text = await origText.call(this);
    replaceBodyStream(new Blob([text]).stream());
    return text;
  };

  const origBlob = response.blob;
  response.blob = async function () {
    const blob = await origBlob.call(this);
    const text = await blob.text();
    replaceBodyStream(new Blob([text]).stream());
    return blob;
  };
}
