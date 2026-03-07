import { getItem, removeItem, setItem } from '@/lib/storage';
import { AUTH_TOKEN, TWO_FACTOR_TRUST_TOKEN } from './constants';

export function getClientAuthToken() {
  return getItem(AUTH_TOKEN);
}

export function setClientAuthToken(token: string) {
  setItem(AUTH_TOKEN, token);
}

export function removeClientAuthToken() {
  removeItem(AUTH_TOKEN);
}

export function getClientTwoFactorTrustToken() {
  return getItem(TWO_FACTOR_TRUST_TOKEN);
}

export function setClientTwoFactorTrustToken(token: string) {
  setItem(TWO_FACTOR_TRUST_TOKEN, token);
}

export function removeClientTwoFactorTrustToken() {
  removeItem(TWO_FACTOR_TRUST_TOKEN);
}
