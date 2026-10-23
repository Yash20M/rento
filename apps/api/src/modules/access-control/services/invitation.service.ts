import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/config.module';
import { UniqueViolationError } from '../../../db/errors';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { withTransaction } from '../../../db/transaction';
import {
  AccountProvisioning,
  type AuthResult,
  AuthMailService,
  AuthService,
  PasswordHasher,
  SocialAuthService,
  adminInvitationEmail,
  emailTaken,
  generateOneTimeToken,
  identityInUse,
  hashOneTimeToken,
  invalidOneTimeToken,
  validatePassword,
  weakPassword,
} from '../../auth-users';
import { type Actor, AuditLog } from '../../reporting-audit';
import { AdminRepository } from '../data/admin.repository';
import { InvitationRepository, type InvitationRow } from '../data/invitation.repository';
import { invitationEmailMismatch, invitationNotFound } from '../domain/admin-errors';
import { GrantPolicy } from './grant-policy';
import { AssignmentChecker, type RequestedAssignment } from './assignment-checker';

const HOUR_MS = 60 * 60 * 1000;
const USERS_EMAIL_KEY = 'users_email_key';
const PROVIDER_SUBJECT_KEY = 'user_identities_provider_subject_key';
const OPEN_INVITATION_KEY = 'admin_invitations_open_email_key';

/**
 * Admin invitations (README §13.5): an administrator invites an email address with role(s); the invitee follows the
 * mailed single-use link and either sets a password or signs in with Google using the invited, verified address.
 * Only the SHA-256 of the token is stored. Audit rows are P2-14; the final anti-escalation rules are P2-13.
 */
@Injectable()
export class InvitationService {
  private readonly provisioning: AccountProvisioning;

  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly invitations: InvitationRepository,
    private readonly admins: AdminRepository,
    private readonly checker: AssignmentChecker,
    private readonly hasher: PasswordHasher,
    private readonly auth: AuthService,
    private readonly social: SocialAuthService,
    private readonly mail: AuthMailService,
    private readonly audit: AuditLog,
    private readonly policy: GrantPolicy,
  ) {
    this.provisioning = new AccountProvisioning(config, clock);
  }

  async invite(
    actor: Actor,
    input: { email: string; roles: readonly RequestedAssignment[] },
  ): Promise<InvitationRow> {
    const assignments = await this.checker.check(input.roles);
    await this.policy.assertCanGrant(this.db, actor.id as string, assignments);
    const now = this.clock.now();
    const token = generateOneTimeToken();

    const inviterId = actor.id as string;
    const id = await this.insertSupersedingOlder(actor, input.email, token, assignments, now);
    const invitation = await this.invitations.findById(this.db, id);
    if (!invitation) throw new Error('invitation vanished after creation');

    // A concurrent invite of the same address may already have superseded this one: then its link is dead and no
    // mail goes out (the newer invitation's mail is the one that works).
    const stillOpen = await this.invitations.findOpenByHash(this.db, hashOneTimeToken(token), now);
    if (!stillOpen) return invitation;

    const inviterName = await this.admins.displayName(this.db, inviterId);
    this.mail.background('admin_invitation', () =>
      this.mail.deliver(
        adminInvitationEmail({
          to: input.email,
          inviterName,
          roleNames: invitation.roles.map((r) => r.roleName),
          link: this.mail.link('/accept-invitation', token),
          ttlHours: this.config.adminInvitationTtlHours,
        }),
      ),
    );
    return invitation;
  }

  /**
   * Revoke older open invitations of the address and insert the new one. Two simultaneous invites of one address race
   * on the "one open invitation per address" index; the loser simply retries and then supersedes the winner.
   */
  private async insertSupersedingOlder(
    actor: Actor,
    email: string,
    token: string,
    assignments: Parameters<InvitationRepository['insert']>[1]['roles'],
    now: Date,
  ): Promise<string> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await withTransaction(this.db, async (trx) => {
          // Somebody who already has an account is promoted by assigning a role, not invited.
          if (await this.provisioning.findByEmail(trx, email)) throw emailTaken();
          await this.invitations.revokeOpenForEmail(trx, email, now);
          const id = await this.invitations.insert(trx, {
            email,
            tokenHash: hashOneTimeToken(token),
            invitedBy: actor.id as string,
            expiresAt: new Date(now.getTime() + this.config.adminInvitationTtlHours * HOUR_MS),
            createdAt: now,
            roles: assignments,
          });
          await this.audit.record(trx, {
            actor,
            action: 'invitation.created',
            entityType: 'invitation',
            entityId: id,
            after: { email, roles: assignments },
          });
          return id;
        });
      } catch (error) {
        const raced =
          error instanceof UniqueViolationError && error.constraint === OPEN_INVITATION_KEY;
        if (!raced || attempt >= 5) throw error;
      }
    }
  }

  list(): Promise<InvitationRow[]> {
    return this.invitations.listOpen(this.db, this.clock.now());
  }

  async revoke(actor: Actor, id: string): Promise<void> {
    await withTransaction(this.db, async (trx) => {
      const before = await this.invitations.findById(trx, id);
      if (before) await this.policy.assertCanGrant(trx, actor.id as string, before.roles);
      if (!(await this.invitations.revoke(trx, id, this.clock.now()))) throw invitationNotFound();
      await this.audit.record(trx, {
        actor,
        action: 'invitation.revoked',
        entityType: 'invitation',
        entityId: id,
        before: before && { email: before.email, roles: before.roles },
      });
    });
  }

  /** Accept by choosing a password. Signs the new admin in. */
  async acceptWithPassword(
    token: string,
    input: { password: string; name?: string | undefined },
  ): Promise<AuthResult> {
    const tokenHash = hashOneTimeToken(token);
    const open = await this.invitations.findOpenByHash(this.db, tokenHash, this.clock.now());
    if (!open) throw invalidOneTimeToken();

    // Policy first, so a weak password does not burn the link; hashing stays outside the transaction.
    const problems = validatePassword(input.password, { email: open.email });
    if (problems.length > 0) throw weakPassword(problems);
    const passwordHash = await this.hasher.hash(input.password);

    const userId = await this.accept(tokenHash, (trx, invitation) =>
      this.provisioning.createVerifiedAccount(trx, {
        email: invitation.email,
        name: input.name ?? null,
        passwordHash,
      }),
    );
    return this.auth.createSession(userId);
  }

  /** Accept by signing in with Google; its VERIFIED email must be the invited address. Signs the new admin in. */
  async acceptWithGoogle(token: string, idToken: string): Promise<AuthResult> {
    const tokenHash = hashOneTimeToken(token);
    const open = await this.invitations.findOpenByHash(this.db, tokenHash, this.clock.now());
    if (!open) throw invalidOneTimeToken();

    const identity = await this.social.verifyIdentity({ provider: 'google', idToken });
    if (!identity.emailVerified || identity.email?.toLowerCase() !== open.email.toLowerCase()) {
      throw invitationEmailMismatch();
    }

    const userId = await this.accept(tokenHash, (trx, invitation) =>
      this.provisioning.createVerifiedAccount(trx, {
        email: invitation.email,
        name: identity.name,
        social: { provider: identity.provider, subject: identity.subject },
      }),
    );
    return this.auth.createSession(userId);
  }

  /**
   * One transaction: use up the invitation (exactly one concurrent attempt wins), create the account, grant the roles.
   * If anything fails — including "an account with this address appeared meanwhile" — the invitation stays open.
   */
  private async accept(
    tokenHash: string,
    createAccount: (trx: Kysely<Database>, invitation: InvitationRow) => Promise<string>,
  ): Promise<string> {
    const now = this.clock.now();
    try {
      return await withTransaction(this.db, async (trx) => {
        const invitation = await this.invitations.consume(trx, tokenHash, now);
        if (!invitation) throw invalidOneTimeToken();

        // Never attach roles to an account somebody else created for this address (pre-registration takeover).
        if (await this.provisioning.findByEmail(trx, invitation.email)) throw emailTaken();

        const userId = await createAccount(trx, invitation);
        await this.admins.replaceAssignments(trx, userId, invitation.roles, invitation.invitedBy);
        await this.invitations.setAcceptedBy(trx, invitation.id, userId);
        await this.audit.record(trx, {
          actor: { id: userId },
          action: 'invitation.accepted',
          entityType: 'invitation',
          entityId: invitation.id,
          after: {
            email: invitation.email,
            roles: invitation.roles,
            invitedBy: invitation.invitedBy,
          },
        });
        return userId;
      });
    } catch (error) {
      if (error instanceof UniqueViolationError && error.constraint === USERS_EMAIL_KEY) {
        throw emailTaken();
      }
      if (error instanceof UniqueViolationError && error.constraint === PROVIDER_SUBJECT_KEY) {
        throw identityInUse(); // that Google account already belongs to another user
      }
      throw error;
    }
  }
}
