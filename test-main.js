import http from 'http';
http.get('http://0.0.0.0:3000/src/main.tsx', (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log('Response status:', res.statusCode));
}).on('error', e => console.error('Error:', e));
