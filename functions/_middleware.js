export async function onRequest(context) {
  const { request, env } = context;
  const USER = env.BASIC_AUTH_USER;
  const PASS = env.BASIC_AUTH_PASS;
  const auth = request.headers.get('Authorization');
  if (auth && auth.startsWith('Basic ')) {
    const [user, pass] = atob(auth.slice(6)).split(':');
    if (user === USER && pass === PASS) {
      return context.next();
    }
  }
  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Meet Summary"',
    },
  });
}