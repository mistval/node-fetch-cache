import fetch from './src/index';

let request = new Request(`http://httpbin.org/post`, { body: 'test', method: 'POST' });

const response1 = await fetch(request);
console.log(await response1.text());

const response2 = await fetch(request);
console.log(await response2.text());
