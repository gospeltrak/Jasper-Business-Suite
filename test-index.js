import http from 'http';
http.get('http://0.0.0.0:3000/', (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log('Response status:', res.statusCode, '\nHeaders:', res.headers, '\nBody:', data.substring(0, 500)));
}).on('error', e => console.error('Error:', e));
