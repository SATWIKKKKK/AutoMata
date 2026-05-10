import { createApp } from '../server';

const appPromise = createApp({ listen: false });

export default async function handler(request: any, response: any) {
  const app = await appPromise;
  return app(request, response);
}
