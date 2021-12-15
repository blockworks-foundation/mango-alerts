import Koa from "koa"
import Router from "koa-router"
import mongo from "koa-mongo"
import bodyParser from "koa-bodyparser"
import cors from "@koa/cors"
import * as cron from "node-cron"
import { MongoClient, ObjectId } from "mongodb"

import {
  Cluster,
  Config,
  GroupConfig,
  MangoClient,
  MangoAccount,
  IDS,
} from "@blockworks-foundation/mango-client"
import { Commitment, Connection, PublicKey } from "@solana/web3.js"

import { UserError } from "./errors"
// import { sendLogsToDiscord } from "./logger"
import {
  // initiateTelegramBot,
  // generateTelegramCode,
  validateMangoAccount,
  // validatePhoneNumber,
  validateEmail,
  reduceMangoGroups,
  sendAlert,
} from "./utils"
import config from "./environment"

const MESSAGE = "Your health ratio is at or below @ratio@% \n"

const app = new Koa()
const router = new Router()

// const rpcUrl = "https://mango.rpcpool.com/946ef7337da3f5b8d3e4a34e7f88"

const clientConfig = new Config(IDS)

const cluster = (process.env.CLUSTER || "mainnet") as Cluster
const groupName = process.env.GROUP || "mainnet.1"
const groupIds = clientConfig.getGroup(cluster, groupName)
if (!groupIds) {
  throw new Error(`Group ${groupName} not found`)
}

const mangoProgramId = groupIds.mangoProgramId
// const mangoGroupKey = groupIds.publicKey

const connection = new Connection(
  process.env.ENDPOINT_URL || clientConfig.cluster_urls[cluster],
  "processed" as Commitment
)

const client = new MangoClient(connection, mangoProgramId)

let db: any

app.use(cors())
app.use(bodyParser())
app.use(
  mongo(
    {
      uri: config.dbConnectionString,
    },
    { useUnifiedTopology: true }
  )
)

// initiateTelegramBot()

router.post("/alerts", async (ctx, next) => {
  try {
    const alert: any = ctx.request.body
    // await validateMangoAccount(client, alert)
    if (alert.alertProvider == "mail") {
      validateEmail(alert.email)
      ctx.body = { status: "success" }
    } else {
      throw new UserError("Invalid alert provider")
    }
    alert.open = true
    alert.timestamp = Date.now()
    ctx.db.collection("alerts").insertOne(alert)
  } catch (e: any) {
    let errorMessage = "Something went wrong"
    if (e.name == "UserError") {
      errorMessage = e.message
    } else {
      // sendLogsToDiscord(null, e)
    }
    ctx.throw(400, errorMessage)
  }
  await next()
})

router.post("/delete-alert", async (ctx, next) => {
  try {
    const id: any = new ObjectId(ctx.request.body.id)
    if (id) {
      ctx.body = { status: "success" }
    }
    ctx.db.collection("alerts").deleteOne({ _id: id })
  } catch (e: any) {
    let errorMessage = "Something went wrong"
    if (e.name == "UserError") {
      errorMessage = e.message
    }
    ctx.throw(400, errorMessage)
  }
  await next()
})

router.get("/alerts/:mangoAccountPk", async (ctx, next) => {
  try {
    const { mangoAccountPk } = ctx.params
    if (!mangoAccountPk) {
      throw new UserError("Missing margin account")
    }
    const alerts = await ctx.db
      .collection("alerts")
      .find(
        { mangoAccountPk },
        {
          projection: {
            _id: 1,
            health: 1,
            alertProvider: 1,
            open: 1,
            timestamp: 1,
            triggeredTimestamp: 1,
          },
        }
      )
      .toArray()
    ctx.body = { alerts }
  } catch (e: any) {
    let errorMessage = "Something went wrong"
    if (e.name == "UserError") {
      errorMessage = e.message
    } else {
      // sendLogsToDiscord(null, e)
    }
    ctx.throw(400, errorMessage)
  }
})

app.use(router.allowedMethods())
app.use(router.routes())

app.listen(config.port, () => {
  const readyMessage = `> Server ready on http://localhost:${config.port}`
  console.log(readyMessage)
  // sendLogsToDiscord(readyMessage, null)
})

const handleAlert = async (alert: any, db: any) => {
  try {
    const mangoAccountPk = new PublicKey(alert.mangoAccountPk)
    const mangoGroupPk = new PublicKey(alert.mangoGroupPk)
    const mangoGroup = await client.getMangoGroup(mangoGroupPk)
    const mangoCache = await mangoGroup.loadCache(connection)
    const mangoAccount = await client.getMangoAccount(
      mangoAccountPk,
      mangoGroup.dexProgramId
    )
    const health = await mangoAccount.getHealthRatio(
      mangoGroup,
      mangoCache,
      "Maint"
    )
    if (health.toNumber() <= parseFloat(alert.health)) {
      let message = MESSAGE.replace("@ratio@", alert.health)
      message += mangoAccount.name || alert.mangoAccountPk
      message += "\nVisit https://trade.mango.markets/"
      const alertSent = await sendAlert(alert, message)
      if (alertSent) {
        db.collection("alerts").updateOne(
          { _id: new ObjectId(alert._id) },
          { $set: { open: false, triggeredTimestamp: Date.now() } }
        )
      }
    }
  } catch (e) {
    console.log(e)
    // sendLogsToDiscord(null, e)
  }
}

const runCron = async () => {
  const uri = config.dbConnectionString
  const mongoClient = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  const mongoConnection = await mongoClient.connect()
  if (!db) db = mongoConnection.db("mango")
  cron.schedule("* * * * *", async () => {
    try {
      const alerts: any[] = await db
        .collection("alerts")
        .find({ open: true })
        .toArray()
      console.log(alerts)
      // const uniqueMangoGroupPks: string[] = [
      //   ...new Set(alerts.map((alert) => alert.mangoGroupPk)),
      // ]
      // const mangoGroups: any = await reduceMangoGroups(
      //   client,
      //   uniqueMangoGroupPks
      // )
      alerts.forEach(async (alert) => {
        handleAlert(alert, db)
      })
    } catch (e) {
      // sendLogsToDiscord(null, e)
    }
  })
}

runCron()
