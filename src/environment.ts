import * as dotenv from "dotenv"

dotenv.config()

export default {
  rpcEndpoint: process.env.RPC_ENDPOINT || "",
  dbConnectionString:
    `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_CLUSTER}.fqb1s.mongodb.net/${process.env.DB}?retryWrites=true&w=majority` ||
    "",
  db: process.env.DB || "",
  port: process.env.PORT || 3000,

  twilioSid: process.env.TWILIO_ACCOUNT_SID || "",
  twilioToken: process.env.TWILIO_AUTH_TOKEN || "",
  twilioNumber: process.env.TWILIO_PHONE_NUMBER || "",

  mailUser: process.env.MAIL_USER || "",
  mailJetKey: process.env.MAILJET_KEY || "",
  mailJetSecret: process.env.MAILJET_SECRET || "",
  // tgToken: process.env.TG_TOKEN || '',
  // discordWebhook: process.env.DISCORD_WEBHOOK || ''
}
