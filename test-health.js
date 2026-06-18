import http from 'http';
http.get('http://0.0.0.0:3000/api/health', (res) => {
  console.log('Status:', res.statusCode);
}).on('error', e => console.error('Error:', e));
