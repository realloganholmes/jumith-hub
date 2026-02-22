export const tool = {
  name: "email.send",
  description: "Send transactional email via SMTP",
  requiredSecrets: ["smtp_user", "smtp_pass"],
  requiresApproval: true,
  execute: async () => ({ messageId: "stub" })
};
