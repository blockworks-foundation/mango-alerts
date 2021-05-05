import * as dotenv from 'dotenv';

dotenv.config();

export default {
  rpcEndpoint: process.env.RPC_ENDPOINT || '',
  dbConnectionString: (process.env.NODE_ENV == 'production') ?
    `mongodb://${process.env.DB_USER}:${encodeURIComponent(process.env.DB_PASS || '')}@${process.env.DB_HOSTS}/${process.env.DB}${process.env.DB_OPTIONS}`:
    'mongodb://localhost:27017/mango_alerts',
  db: process.env.DB || '',
  port: process.env.PORT || 3000,

  twilioSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioNumber: process.env.TWILIO_PHONE_NUMBER || '',

  mailUser: process.env.MAIL_USER || '',
  mailPass: process.env.MAIL_PASS || '',

  tgToken: process.env.TG_TOKEN || '',

  discordWebhook: process.env.DISCORD_WEBHOOK || ''
}
