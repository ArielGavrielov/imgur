import {
  AccessToken,
  isAccessToken,
  isClientId,
  isLogin,
} from './common/types';
import { ImgurClient } from './client';
import { IMGUR_API_PREFIX, AUTHORIZE_ENDPOINT } from './common/endpoints';

export async function getAuthorizationHeader(
  client: ImgurClient
): Promise<string> {
  if (isAccessToken(client.credentials)) {
    return `Bearer ${client.credentials.accessToken}`;
  }

  if (isClientId(client.credentials) && !isLogin(client.credentials)) {
    return `Client-ID ${client.credentials.clientId}`;
  }

  const { clientId, username, password } = client.credentials;

  const options: Record<string, unknown> = {
    url: AUTHORIZE_ENDPOINT,
    baseURL: IMGUR_API_PREFIX,
    params: {
      client_id: clientId,
      response_type: 'token',
    },
  };

  let response = await client.plainRequest(options);

  const cookies = Array.isArray(response.headers['set-cookie'])
    ? response.headers['set-cookie'][0]
    : response.headers['set-cookie'];

  if (!cookies) {
    throw new Error('No cookies were set during authorization');
  }

  const matches = cookies.match('(^|;)[s]*authorize_token=([^;]*)');

  if (!matches || matches.length < 3) {
    throw new Error('Unable to find authorize_token cookie');
  }

  const authorizeToken = matches[2];

  options.method = 'POST';
  options.data = {
    username,
    password,
    allow: authorizeToken,
  };

  options.followRedirect = false;
  options.headers = {
    cookie: `authorize_token=${authorizeToken}`,
  };

  response = await client.plainRequest(options);
  const location = response.headers.location;
  if (!location) {
    throw new Error('Unable to parse location');
  }

  const token = JSON.parse(
    '{"' +
      decodeURI(location.slice(location.indexOf('#') + 1))
        .replace(/"/g, '\\"')
        .replace(/&/g, '","')
        .replace(/=/g, '":"') +
      '"}'
  );

  const accessToken = token.access_token;
  (client.credentials as unknown as AccessToken).accessToken = accessToken;

  return `Bearer ${accessToken}`;
}
