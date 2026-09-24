import { PrismaClient, KycTier, KycStatus } from '@prisma/client';
import { AppError } from '../../../shared/errors/AppError';
import { EmailService } from '../../../shared/services/email.service';

const prisma = new PrismaClient();

async function mockExternalIdentityVerification(number: string, type: string): Promise<boolean> {
  const regex = /^\d{11}$/;
  return regex.test(number);
}

export async function verifyTier2(userId: string, bvnOrNin: string, type: 'BVN' | 'NIN') {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  if (!user) {
    throw new AppError('User not found.', 404);
  }

  const isValidIdentity = await mockExternalIdentityVerification(bvnOrNin, type);

  if (!isValidIdentity) {
    // Send rejection/failure email notification asynchronously
    if (user.email) {
      await EmailService.sendKycStatusNotice(
        user.email,
        `Tier 2 (${type})`,
        'REJECTED',
        `Invalid ${type} provided or verification failed with NIBSS/NIMC.`
      ).catch((err) => console.error('Failed to send KYC rejection email:', err));
    }

    throw new AppError(`Invalid ${type} provided or verification failed with NIBSS/NIMC.`, 400);
  }

  const isBvn = type === 'BVN';
  const updateData = isBvn ? { bvn: bvnOrNin } : { nin: bvnOrNin };

  const kycProfile = await prisma.kycProfile.upsert({
    where: { userId },
    update: {
      ...updateData,
      tier: KycTier.TIER_2,
      status: KycStatus.VERIFIED,
      verifiedAt: new Date(),
    },
    create: {
      userId,
      ...updateData,
      tier: KycTier.TIER_2,
      status: KycStatus.VERIFIED,
      verifiedAt: new Date(),
    },
  });

  // Send successful Tier 2 verification email asynchronously
  if (user.email) {
    await EmailService.sendKycStatusNotice(user.email, `Tier 2 (${type})`, 'VERIFIED').catch((err) => {
      console.error('Failed to send KYC approval email:', err);
    });
  }

  return {
    message: `KYC Tier 2 verification successful via ${type}.`,
    profile: kycProfile,
    tier: 2,
    dailyLimit: 200000,
    maxBalance: 500000,
  };
}

export async function verifyTier3(userId: string, cacNumber: string, businessName: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  if (!user) {
    throw new AppError('User not found.', 404);
  }

  if (!cacNumber || !businessName) {
    throw new AppError('CAC registration number and business name are required for Tier 3.', 400);
  }

  const existingCac = await prisma.kycProfile.findFirst({
    where: { cacNumber, NOT: { userId } },
  });

  if (existingCac) {
    if (user.email) {
      await EmailService.sendKycStatusNotice(
        user.email,
        'Tier 3 Corporate',
        'REJECTED',
        'This CAC registration number is already registered with another account.'
      ).catch((err) => console.error('Failed to send KYC rejection email:', err));
    }

    throw new AppError('This CAC registration number is already registered with another account.', 400);
  }

  const kycProfile = await prisma.kycProfile.upsert({
    where: { userId },
    update: {
      cacNumber,
      businessName,
      tier: KycTier.TIER_3,
      status: KycStatus.VERIFIED,
      verifiedAt: new Date(),
    },
    create: {
      userId,
      cacNumber,
      businessName,
      tier: KycTier.TIER_3,
      status: KycStatus.VERIFIED,
      verifiedAt: new Date(),
    },
  });

  // Send successful Tier 3 corporate verification email asynchronously
  if (user.email) {
    await EmailService.sendKycStatusNotice(user.email, 'Tier 3 Corporate', 'VERIFIED').catch((err) => {
      console.error('Failed to send KYC approval email:', err);
    });
  }

  return {
    message: 'KYC Tier 3 corporate verification successful via CAC.',
    profile: kycProfile,
    tier: 3,
    dailyLimit: 5000000,
    maxBalance: 'UNLIMITED',
  };
}