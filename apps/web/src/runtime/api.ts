/// <reference types="vite/client" />
import { API_BASE_PATH } from '@ronaldo/shared';

const trimTrailingSlash = (value: string) => value.replace(/\/$/, '');

const apiOrigin = trimTrailingSlash(import.meta.env.VITE_API_ORIGIN ?? 'http://localhost:4000');

export const toApiUrl = (path: string) => `${apiOrigin}${API_BASE_PATH}${path}`;
