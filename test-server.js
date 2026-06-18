import http from 'http';
http.get('http://0.0.0.0:3000/api/health', (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log('Response:', data));
}).on('error', e => console.error('Error:', e));
