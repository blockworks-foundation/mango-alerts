
import Koa from "koa";
import Router from "koa-router";
import mongo from "koa-mongo";
import bodyParser from "koa-bodyparser";
import cors from "@koa/cors";
import * as cron from "node-cron";
import {MongoClient, ObjectId} from "mongodb";

import { MangoClient, MarginAccount, IDS } from '@blockworks-foundation/mango-client';
import { Connection, PublicKey } from '@solana/web3.js';

import { UserError } from './errors';
import { sendLogsToDiscord } from './logger';
import { initiateTelegramBot, generateTelegramCode, validateMarginAccount, validatePhoneNumber, validateEmail, reduceMangoGroups, sendAlert } from './utils';
import config from './environment';

const MESSAGE = 'Your collateral ratio is at or below @ratio@% \n';

const app = new Koa();
const router = new Router;

const cluster = 'mainnet-beta';
const client = new MangoClient();
const clusterIds = IDS[cluster];
const connection = new Connection(config.rpcEndpoint || IDS.cluster_urls[cluster], 'singleGossip');
const dexProgramId = new PublicKey(clusterIds.dex_program_id);
const mangoProgramId = new PublicKey(clusterIds.mango_program_id);
let db: any;

app.use(cors());
app.use(bodyParser());
app.use(mongo({ uri: config.dbConnectionString }, { useUnifiedTopology: true }));

initiateTelegramBot();

router.post('/alerts', async(ctx, next) => {
  try {
    const alert: any = ctx.request.body;
    await validateMarginAccount(client, connection, dexProgramId, alert);
    if (alert.alertProvider == 'sms') {
      const phoneNumber = `+${alert.phoneNumber.code}${alert.phoneNumber.phone}`;
      await validatePhoneNumber(phoneNumber);
      ctx.body = { status: 'success' };
    } else if (alert.alertProvider == 'mail') {
      validateEmail(alert.email);
      ctx.body = { status: 'success' };
    } else if (alert.alertProvider == 'tg') {
      const code = generateTelegramCode();
      alert.tgCode = code;
      ctx.body = { code };
    } else {
      throw new UserError('Invalid alert provider');
    }
    alert.open = true;
    alert.timestamp = Date.now();
    ctx.db.collection('alerts').insertOne(alert);
  } catch (e) {
    let errorMessage = 'Something went wrong';
    if (e.name == 'UserError') {
      errorMessage = e.message;
    } else {
      sendLogsToDiscord(null, e);
    }
    ctx.throw(400, errorMessage);
  }
  await next();
});

router.get('/alerts/:marginAccountPk', async(ctx, next) => {
  try {
    const { marginAccountPk } = ctx.params;
    if (!marginAccountPk) {
      throw new UserError('Missing margin account');
    }
    const alerts = await ctx.db.collection('alerts').find(
      { marginAccountPk },
      { projection: {
        '_id': 0,
        'collateralRatioThresh': 1,
        'alertProvider': 1,
        'open': 1,
        'timestamp': 1,
        'triggeredTimestamp': 1
      }}).toArray();
    ctx.body = { alerts };
  } catch (e) {
    let errorMessage = 'Something went wrong';
    if (e.name == 'UserError') {
      errorMessage = e.message;
    } else {
      sendLogsToDiscord(null, e);
    }
    ctx.throw(400, errorMessage);
  }
})

app.use(router.allowedMethods());
app.use(router.routes());

app.listen(config.port, () => {
  const readyMessage = `> Server ready on http://localhost:${config.port}`;
  console.log(readyMessage)
  sendLogsToDiscord(readyMessage, null);
});

const handleAlert = async (alert: any, mangoGroups: any[], db: any) => {
  try {
    const mangoGroupMapping = mangoGroups[alert.mangoGroupPk];
    const marginAccountPk = new PublicKey(alert.marginAccountPk);
    const marginAccount = mangoGroupMapping.marginAccounts.find((ma: MarginAccount) => ma.publicKey.equals(marginAccountPk));
    const collateralRatio = marginAccount.getCollateralRatio(mangoGroupMapping['mangoGroup'], mangoGroupMapping['prices']);
    if ((100 * collateralRatio) <= alert.collateralRatioThresh) {
      let message = MESSAGE.replace('@ratio@', alert.collateralRatioThresh);
      message += marginAccount.toPrettyString(
        mangoGroupMapping['mangoGroup'],
        mangoGroupMapping['prices']
      );
      message += '\nVisit https://trade.mango.markets/'
      const alertSent = await sendAlert(alert, message);
      if (alertSent) {
        db.collection('alerts').updateOne({ _id: new ObjectId(alert._id) }, { '$set': { open: false, triggeredTimestamp: Date.now() } });
      }
    }
  } catch (e) {
    sendLogsToDiscord(null, e);
  }
}

const runCron = async () => {
  const mongoConnection = await MongoClient.connect(config.dbConnectionString, { useUnifiedTopology: true });
  if (!db) db = mongoConnection.db(config.db);
  cron.schedule("* * * * *", async () => {
    try {
      const alerts: any[] = await db.collection('alerts').find({open: true}).toArray();
      const uniqueMangoGroupPks: string[] = [...new Set(alerts.map(alert => alert.mangoGroupPk))];
      const mangoGroups:any = await reduceMangoGroups(client, connection, mangoProgramId, uniqueMangoGroupPks);
      alerts.forEach(async (alert) => {
        handleAlert(alert, mangoGroups, db);
      });
      const expiryTime = Date.now() - (1000 * 60 * 15); // 15 Minutes
      db.collection('alerts').deleteMany({ alertProvider: 'tg', tgChatId: { '$exists': false }, timestamp: { '$lt': expiryTime } });
    } catch (e) {
      sendLogsToDiscord(null, e);
    }
  });
}

runCron();
