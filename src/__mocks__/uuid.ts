import crypto from 'node:crypto';

export const v4 = () => crypto.randomUUID();
export const v7 = () => crypto.randomUUID();

// v5 is a name-based UUID (SHA-1); approximate with MD5 for test purposes
export const v5 = (name: string, _namespace: string): string => {
  const hash = crypto.createHash('md5').update(name).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
};

v5.DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
v5.URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
