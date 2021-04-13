import { Twilio } from "twilio";
import * as nodemailer from 'nodemailer';
import * as TelegramBot from 'node-telegram-bot-api';
import * as EmailValidator from 'email-validator';
import { MongoClient } from "mongodb";

import { MangoClient } from '@blockworks-foundation/mango-client';
import { Connection, PublicKey } from '@solana/web3.js';

import { UserError } from './errors';

import config from './environment';

// This needs to be global because it uses event listeners
const bot = new TelegramBot.default(config.tgToken, {polling: true});
const twilioClient = new Twilio(config.twilioSid, config.twilioToken);

export const validateMarginAccount = (client: MangoClient, connection: Connection, dexProgramId: PublicKey, alert: any) => {
  return new Promise<void>(async (resolve, reject) => {
    try {
      const mangoGroupPk = new PublicKey(alert.mangoGroupPk);
      const marginAccountPk = new PublicKey(alert.marginAccountPk);
      const mangoGroup = await client.getMangoGroup(connection, mangoGroupPk);
      const marginAccount = await client.getMarginAccount(connection, marginAccountPk, dexProgramId);
      if (!mangoGroup || !marginAccount) {
        reject(new UserError('Invalid margin account or mango group'));
      } else {
        resolve();
      }
    } catch (e) {
      reject(new UserError('Invalid margin account or mango group'));
    }
  });
}

export const validatePhoneNumber = (phoneNumber: string) => {
  return new Promise<void>((resolve, reject) => {
    twilioClient.lookups.phoneNumbers(phoneNumber).fetch((error, _) => {
      if (error) {
        reject(new UserError('The entered phone number is incorrect'));
      } else {
        resolve();
      }
    })
  })
}

export const validateEmail = (email: string) => {
  if (!EmailValidator.validate(email)) {
    throw new UserError('The entered email is incorrect');
  }
  return;
}

const sendSms = (phoneNumber: string, message: string) => {
  twilioClient.messages
  .create({
    from: config.twilioNumber,
    to: phoneNumber,
    body: message,
  }).catch(error => { throw error })
}

const sendEmail = (email: string, message: string) => {
  const transporter = nodemailer.createTransport(
    `smtps://${config.mailUser}%40gmail.com:${config.mailPass}@smtp.gmail.com`
  );
  const mailOptions = {
    from : `${config.mailUser}@gmail.com`,
    to : email,
    subject : 'Mango Markets Alerts',
    text: message
  };
  transporter.sendMail( mailOptions );
}

export const sendAlert = (alert: any, message: string) => {
  console.log(alert);
  if (alert.alertProvider == 'sms') {
    const phoneNumber = `+${alert.phoneNumber.code}${alert.phoneNumber.phone}`;
    sendSms(phoneNumber, message);
  } else if (alert.alertProvider == 'mail') {
    const email = alert.email;
    sendEmail(email, message);
  } else if (alert.alertProvider == 'tg') {
    if (!alert.tgChatId) return false;
    bot.sendMessage(alert.tgChatId, message);
  }
  return true;
}

export const reduceMangoGroups = async (client: MangoClient, connection: Connection, mangoGroupPks: string[]) => {
  const mangoGroups:any = {};
  for (let mangoGroupPk of mangoGroupPks) {
    const mangoGroup = await client.getMangoGroup(connection, new PublicKey(mangoGroupPk));
    mangoGroups[mangoGroupPk] = {
      mangoGroup,
      prices: await mangoGroup.getPrices(connection),
    };
  }
  return mangoGroups;
}

export const initiateTelegramBot = () => {
  bot.on('message', async (message: any) => {
    const mongoConnection = await MongoClient.connect(config.dbConnectionString, { useUnifiedTopology: true });
    const db = mongoConnection.db(config.db);
    const tgCode = message.text;
    const alert = await db.collection('alerts').findOne({tgCode});
    if (alert) {
      await db.collection('alerts').updateOne({ tgCode }, {'$set': { tgChatId: message.chat.id } } );
      bot.sendMessage(message.chat.id, 'Thanks, You have successfully claimed your alert\nYou can now close the dialogue on website');
    } else {
      bot.sendMessage(message.chat.id, 'Sorry, this code is either invalid or expired');
    }
    mongoConnection.close();
  });
}

export const generateTelegramCode = () => {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 5; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
