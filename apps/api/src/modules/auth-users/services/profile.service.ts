import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { mediaRef } from '../../../common/media/images';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { UserRepository } from '../data/user.repository';
import { accountUnavailable, emailTaken, fieldInvalid } from '../domain/auth-errors';
import { AuthMailService } from './auth-mail.service';
import { EmailVerificationService } from './email-verification.service';

export interface ProfileInput {
  name?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
}

export interface Profile {
  id: string;
  email: string | null;
  displayName: string | null;
  phone: string | null;
  emailVerified: boolean;
  avatarUrl: string | null;
  needsProfileCompletion: Array<'email' | 'phone'>;
}

/** The signed-in user's own profile (README §14.3). Changing an existing email is the account lifecycle task (P2-32). */
@Injectable()
export class ProfileService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    private readonly users: UserRepository,
    private readonly mail: AuthMailService,
    private readonly emailVerification: EmailVerificationService,
  ) {}

  async update(userId: string, input: ProfileInput): Promise<Profile> {
    if (input.name === undefined && input.phone === undefined && input.email === undefined) {
      throw fieldInvalid('body', 'send at least one of name, phone, email');
    }
    const user = await this.users.findById(this.db, userId);
    if (!user || user.status !== 'active') throw accountUnavailable();

    if (input.email !== undefined) {
      if (user.email !== null) throw fieldInvalid('email', 'your email cannot be changed here');
      if (await this.users.findByEmail(this.db, input.email)) throw emailTaken();
    }

    await this.users.updateProfile(this.db, userId, {
      ...(input.name !== undefined && { displayName: input.name }),
      ...(input.phone !== undefined && { phone: input.phone }),
    });

    if (input.email !== undefined) {
      const claimed = input.email;
      // Only a link to this address can attach it to the account; nothing is written to the user until it is used.
      this.mail.background('email_verification', () =>
        this.emailVerification.issueForClaimedEmail(userId, claimed),
      );
    }

    const fresh = await this.users.findById(this.db, userId);
    if (!fresh) throw accountUnavailable();
    return {
      id: fresh.id,
      email: fresh.email,
      displayName: fresh.display_name,
      phone: fresh.phone,
      emailVerified: fresh.email_verified_at !== null,
      avatarUrl: fresh.avatar_media_id ? mediaRef(fresh.avatar_media_id) : null,
      needsProfileCompletion: fresh.email === null ? ['email'] : [],
    };
  }
}
