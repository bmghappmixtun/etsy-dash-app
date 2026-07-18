import { prisma } from "../db";
import type { EncryptedData } from "../crypto";

export const usersRepository = {
  async findFirst() {
    return prisma.user.findFirst();
  },

  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  async findByShopId(shopId: string) {
    return prisma.user.findUnique({ where: { shopId } });
  },

  async upsert(data: {
    etsyUserId: string;
    shopId: string;
    shopName?: string;
    accessToken: EncryptedData;
    refreshToken: EncryptedData;
    tokenExpiresAt: Date;
    scopes: string;
  }) {
    // Single-user app: delete any existing user and create the new one
    // (there should only ever be one)
    await prisma.user.deleteMany({});
    return prisma.user.create({
      data: {
        etsyUserId: data.etsyUserId,
        shopId: data.shopId,
        shopName: data.shopName,
        accessToken: data.accessToken.ciphertext,
        accessTokenIv: data.accessToken.iv,
        accessTokenAuth: data.accessToken.authTag,
        refreshToken: data.refreshToken.ciphertext,
        refreshTokenIv: data.refreshToken.iv,
        refreshTokenAuth: data.refreshToken.authTag,
        tokenExpiresAt: data.tokenExpiresAt,
        scopes: data.scopes,
      },
    });
  },

  async updateTokens(
    id: string,
    data: {
      accessToken: EncryptedData;
      refreshToken: EncryptedData;
      tokenExpiresAt: Date;
    },
  ) {
    return prisma.user.update({
      where: { id },
      data: {
        accessToken: data.accessToken.ciphertext,
        accessTokenIv: data.accessToken.iv,
        accessTokenAuth: data.accessToken.authTag,
        refreshToken: data.refreshToken.ciphertext,
        refreshTokenIv: data.refreshToken.iv,
        refreshTokenAuth: data.refreshToken.authTag,
        tokenExpiresAt: data.tokenExpiresAt,
      },
    });
  },

  async deleteAll() {
    return prisma.user.deleteMany({});
  },
};
