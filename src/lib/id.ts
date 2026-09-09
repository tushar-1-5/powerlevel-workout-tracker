import * as Crypto from 'expo-crypto';

/**
 * UUIDv4 primary key. Generated on-device so rows created offline on two
 * different phones can never collide when they eventually sync.
 */
export function newId(): string {
  return Crypto.randomUUID();
}
