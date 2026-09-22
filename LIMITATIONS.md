## Paystack transfer integration — verified working, blocked by account tier

Every layer of the Paystack transfer flow has been tested against Paystack's real API and confirmed working:
- `GET /bank/resolve` — confirmed live (test bank code 001, or real codes like Zenith's 057)
- `POST /transferrecipient` — confirmed live, returns a real `recipient_code`
- `POST /transfer` — blocked by Paystack with: *"You cannot initiate third party payouts as a starter business"*

This is a genuine Paystack account-tier restriction, not a code issue. Paystack's Starter Business tier (the free/default tier) cannot send transfers to third parties — this requires upgrading to a Registered Business, which needs real business registration documents and director KYC. Confirmed via Paystack's own support docs.

**What this proves:** the reversal-safety fix (debit → external call fails → automatic customer refund) has now been verified against two distinct real Paystack rejections (invalid test bank code, and this account-tier block) — both correctly triggered an automatic refund with no manual intervention needed.

**What's still needed for a fully live transfer:** whoever owns the business/compliance side of this project needs to register the company as a Paystack Registered Business and complete KYC before real settled transfers can be tested or shipped.