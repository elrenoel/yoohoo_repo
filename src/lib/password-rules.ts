export const PASSWORD_RULES = {
  minLength: 10,
  maxLength: 128,
  hasLetter: /[a-zA-Z]/,
  hasNumber: /[0-9]/,
} as const;

export function meetsPasswordRequirements(password: string) {
  return password.length >= PASSWORD_RULES.minLength
    && PASSWORD_RULES.hasLetter.test(password)
    && PASSWORD_RULES.hasNumber.test(password);
}
