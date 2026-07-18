import { decrypt, encrypt, type EncryptedData } from "../crypto";
import { usersRepository } from "../repositories/users.repository";
import { logger } from "../logger";

/**
 * Auth service: handles token storage, retrieval, refresh.
 * Single-user app: we always work with the first (only) user.
 */

export const authService = {
  /**
   * Decrypt a user's stored tokens.
   */
  getDecryptedTokens(user: {
    accessToken: string;
    refreshToken: string;
    accessTokenIv: string;
    refreshTokenIv: string;
    accessTokenAuth: string;
    refreshTokenAuth: string;
  }): { accessToken: string; refreshToken: string } {
    const access: EncryptedData = {
      ciphertext: user.accessToken,
      iv: user.accessTokenIv,
      authTag: user.accessTokenAuth,
    };
    const refresh: EncryptedData = {
      ciphertext: user.refreshToken,
      iv: user.refreshTokenIv,
      authTag: user.refreshTokenAuth,
    };
    return {
      accessToken: decrypt(access),
      refreshToken: decrypt(refresh),
    };
  },

  /**
   * Encrypt new tokens (used after OAuth callback or refresh).
   */
  encryptTokens(accessToken: string, refreshToken: string) {
    return {
      accessToken: encrypt(accessToken),
      refreshToken: encrypt(refreshToken),
    };
  },

  /**
   * Save tokens for a user (overwrites existing).
   */
  async saveTokens(
    userId: string,
    accessToken: string,
    refreshToken: string,
    tokenExpiresAt: Date,
  ) {
    const enc = this.encryptTokens(accessToken, refreshToken);
    const updated = await usersRepository.updateTokens(userId, {
      accessToken: enc.accessToken,
      refreshToken: enc.refreshToken,
      tokenExpiresAt,
    });
    logger.info("Tokens saved", { userId });
    return updated;
  },

  /**
   * Get the single user, with decrypted tokens.
   * Returns null if no user is connected.
   */
  async getAuthenticatedUser() {
    const user = await usersRepository.findFirst();
    if (!user) return null;
    const tokens = this.getDecryptedTokens(user);
    return { ...user, ...tokens };
  },
};
