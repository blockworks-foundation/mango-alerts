import * as dotenv from 'dotenv';

dotenv.config();

export default {
  dbConnectionString: `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOSTS}/${process.env.DB}${process.env.DB_OPTIONS}`,
  db: process.env.DB || '',
  port: process.env.PORT || 3000,

  twilioSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioNumber: process.env.TWILIO_PHONE_NUMBER || '',

  mailUser: process.env.MAIL_USER || '',
  mailPass: process.env.MAIL_PASS || '',

  tgToken: process.env.TG_TOKEN || ''
}
