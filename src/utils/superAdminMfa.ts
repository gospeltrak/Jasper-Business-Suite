import { getSecureDataBridgeClient } from '../secureDataBridge';

export type SuperAdminMfaPrompt = {
  mode: 'enroll' | 'challenge';
  factorId: string;
  challengeId: string;
  qrCode?: string;
  secret?: string;
};

export async function getSuperAdminMfaLevel() {
  const client: any = await getSecureDataBridgeClient();
  const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  return data as { currentLevel: 'aal1' | 'aal2' | null; nextLevel: 'aal1' | 'aal2' | null };
}

export async function prepareSuperAdminMfa(): Promise<SuperAdminMfaPrompt | null> {
  const client: any = await getSecureDataBridgeClient();
  const level = await getSuperAdminMfaLevel();
  if (level.currentLevel === 'aal2') return null;

  const factorsResult = await client.auth.mfa.listFactors();
  if (factorsResult.error) throw factorsResult.error;
  const verifiedFactor = factorsResult.data?.totp?.find((factor: any) => factor.status === 'verified');

  if (verifiedFactor) {
    const challenge = await client.auth.mfa.challenge({ factorId: verifiedFactor.id });
    if (challenge.error) throw challenge.error;
    return { mode: 'challenge', factorId: verifiedFactor.id, challengeId: challenge.data.id };
  }

  const enrollment = await client.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Orvix Super Admin',
  });
  if (enrollment.error) throw enrollment.error;
  const challenge = await client.auth.mfa.challenge({ factorId: enrollment.data.id });
  if (challenge.error) throw challenge.error;
  return {
    mode: 'enroll',
    factorId: enrollment.data.id,
    challengeId: challenge.data.id,
    qrCode: enrollment.data.totp.qr_code,
    secret: enrollment.data.totp.secret,
  };
}

export async function verifySuperAdminMfa(prompt: SuperAdminMfaPrompt, code: string): Promise<void> {
  const client: any = await getSecureDataBridgeClient();
  const result = await client.auth.mfa.verify({
    factorId: prompt.factorId,
    challengeId: prompt.challengeId,
    code: code.replace(/\s/g, ''),
  });
  if (result.error) throw result.error;
}
