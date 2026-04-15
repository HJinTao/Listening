import { Router } from 'express';
import axios from 'axios';

const router = Router();

router.post('/', async (req, res) => {
  const { url, method = 'GET', headers, body } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const response = await axios({
      url,
      method,
      headers: {
        ...headers,
        // Remove headers that might cause issues when proxied
        host: undefined,
        origin: undefined,
        referer: undefined,
      },
      data: body,
      validateStatus: () => true, // resolve all status codes
    });

    res.status(200).json({
      statusCode: response.status,
      statusMessage: response.statusText,
      headers: response.headers,
      body: response.data,
    });
  } catch (error: any) {
    console.error('Proxy error:', error.message);
    res.status(200).json({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      headers: {},
      body: { error: error.message }
    });
  }
});

export default router;