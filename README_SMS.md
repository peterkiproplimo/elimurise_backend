SMS Module Integration Notes

Environment variables required:

- `ONFONMEDIA_SMS_URL` (optional) - provider API URL, default `https://api.onfonmedia.co.ke/v1/sms/SendBulkSMS`
- `ONFONMEDIA_API_KEY` - provider API key (keep secret)
- `ONFONMEDIA_CLIENT_ID` - provider client id (keep secret)
- `DEFAULT_SENDER` (optional) - default SenderID to use

Webhook:
- Configure your Onfonmedia delivery callback to `https://<your-server>/api/sms/webhook`

Notes:
- Models are basic and intended as a starting point. Add authentication and RBAC to protect endpoints.
- Do not commit API keys to git. Use environment management for production.
