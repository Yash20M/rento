import { Injectable } from '@nestjs/common';
import { type Algorithm, hash, verify } from '@node-rs/argon2';

// OWASP Password Storage Cheat Sheet, Argon2id: m=19 MiB, t=2, p=1.
const PARAMS = {
  // `Algorithm` is an ambient const enum (unusable under isolatedModules): 2 = Argon2id. The unit tests
  // assert the resulting hashes start with the argon2id PHC prefix.
  algorithm: 2 as Algorithm,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordHasher {
  /** Returns a self-describing PHC string (`$argon2id$v=19$m=…,t=…,p=…$salt$hash`) with a fresh random salt. */
  hash(password: string): Promise<string> {
    return hash(password, PARAMS);
  }

  /** Constant-time verification. Malformed hashes and mismatches are both just `false`. */
  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }
}
