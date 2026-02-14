export default {
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 정적 파일 서빙
    const files = {
      '/': 'text/html',
      '/index.html': 'text/html',
      '/clinical-skills.html': 'text/html',
      '/financial-advice.html': 'text/html',
      '/patient-management.html': 'text/html',
      '/team-relations.html': 'text/html',
    };

    // 요청 경로에 따라 파일 반환
    if (pathname === '/' || pathname === '/index.html') {
      return new Response('Welcome to Clinical Skills Platform', { 
        headers: { 'Content-Type': 'text/html' } 
      });
    }

    return new Response('404 Not Found', { status: 404 });
  },
};
