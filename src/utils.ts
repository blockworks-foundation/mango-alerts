// import { Twilio } from "twilio"
// import * as mailjetTransport from 'nodemailer-mailjet-transport'
// import * as TelegramBot from "node-telegram-bot-api"
// import { MongoClient } from "mongodb"
import * as nodemailer from "nodemailer"
import * as EmailValidator from "email-validator"

import { MangoClient } from "@blockworks-foundation/mango-client"
import { PublicKey } from "@solana/web3.js"

import { UserError } from "./errors"

import config from "./environment"

const mailjetTransport = require("nodemailer-mailjet-transport")

// // This needs to be global because it uses event listeners
// // const bot = new TelegramBot.default(config.tgToken, {polling: true});
// const twilioClient = new Twilio(config.twilioSid, config.twilioToken)

export const validateMangoAccount = (client: MangoClient, alert: any) => {
  return new Promise<void>(async (resolve, reject) => {
    try {
      const mangoGroupPk = new PublicKey(alert.mangoGroupPk)
      const mangoAccountPk = new PublicKey(alert.marginAccountPk)
      const mangoGroup = await client.getMangoGroup(mangoGroupPk)
      const mangoAccount = await client.getMangoAccount(
        mangoAccountPk,
        mangoGroup.dexProgramId
      )
      if (!mangoGroup || !mangoAccount) {
        reject(new UserError("Invalid margin account or mango group"))
      } else {
        resolve()
      }
    } catch (e) {
      reject(new UserError("Invalid margin account or mango group"))
    }
  })
}

// export const validatePhoneNumber = (phoneNumber: string) => {
//   return new Promise<void>((resolve, reject) => {
//     twilioClient.lookups.phoneNumbers(phoneNumber).fetch((e, _) => {
//       if (e) {
//         reject(new UserError("The entered phone number is incorrect"))
//       } else {
//         resolve()
//       }
//     })
//   })
// }

export const validateEmail = (email: string) => {
  if (!EmailValidator.validate(email)) {
    throw new UserError("The entered email is incorrect")
  }
  return
}

// const sendSms = (phoneNumber: string, message: string) => {
//   return new Promise<void>((resolve, reject) => {
//     twilioClient.messages
//       .create({
//         from: config.twilioNumber,
//         to: phoneNumber,
//         body: message,
//       })
//       .then((_) => resolve())
//       .catch((e) => reject(e))
//   })
// }

const sendEmail = async (email: string, message: string) => {
  const transport = nodemailer.createTransport(
    mailjetTransport({
      auth: {
        apiKey: config.mailJetKey,
        apiSecret: config.mailJetSecret,
      },
    })
  )
  const mailOptions = {
    from: `${config.mailUser}@mango.markets`,
    to: email,
    subject: "Mango Alerts",
    text: message,
  }

  try {
    const info = await transport.sendMail(mailOptions)
    console.log(info)
  } catch (err) {
    console.error(err)
  }
  transport.sendMail(mailOptions)
}

export const sendAlert = async (alert: any, message: string) => {
  if (alert.alertProvider == "mail") {
    const email = alert.email
    sendEmail(email, message)
  }
  // else if (alert.alertProvider == "sms") {
  //   const phoneNumber = `+${alert.phoneNumber.code}${alert.phoneNumber.phone}
  //   await sendSms(phoneNumber, message)
  // }
  // else if (alert.alertProvider == 'tg') {
  //   if (!alert.tgChatId) return false;
  //   bot.sendMessage(alert.tgChatId, message);
  // }
  return true
}

export const reduceMangoGroups = async (
  client: MangoClient,
  // connection: Connection,
  // mangoProgramId: PublicKey,
  mangoGroupPks: string[]
) => {
  const mangoGroups: any = {}
  for (let mangoGroupPk of mangoGroupPks) {
    const mangoGroup = await client.getMangoGroup(new PublicKey(mangoGroupPk))
    const mangoAccounts = await client.getAllMangoAccounts(mangoGroup)
    mangoGroups[mangoGroupPk] = {
      mangoGroup,
      mangoAccounts,
      // prices: await mangoGroup.getPrices(connection),
    }
  }
  return mangoGroups
}

// export const initiateTelegramBot = () => {
//   bot.on('message', async (message: any) => {
//     const mongoConnection = await MongoClient.connect(config.dbConnectionString, { useUnifiedTopology: true });
//     const db = mongoConnection.db(config.db);
//     const tgCode = message.text;
//     const alert = await db.collection('alerts').findOne({tgCode});
//     if (alert) {
//       await db.collection('alerts').updateOne({ tgCode }, {'$set': { tgChatId: message.chat.id } } );
//       bot.sendMessage(message.chat.id, 'Thanks, You have successfully claimed your alert\nYou can now close the dialogue on website');
//     } else {
//       bot.sendMessage(message.chat.id, 'Sorry, this code is either invalid or expired');
//     }
//     mongoConnection.close();
//   });
// }

// export const generateTelegramCode = () => {
//   var text = ""
//   var possible =
//     "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
//   for (let i = 0; i < 5; i++) {
//     text += possible.charAt(Math.floor(Math.random() * possible.length))
//   }
//   return text
// }
