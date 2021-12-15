import winston from "winston"
import DiscordTransport from "winston-discord-transport"
import config from "./environment"

// const logger = winston.createLogger({
//   transports: [
//     new DiscordTransport({
//       webhook: config.discordWebhook,
//       defaultMeta: { service: "mango_alerts_server" },
//       level: "info"
//     })
//   ]
// });

// export const sendLogsToDiscord = async (message: string | null, error: Error | null) => {
//   if (message) {
//     logger.log({
//       level: "info",
//       message: message,
//     });
//   } else if (error) {
//     logger.log({
//       level: "error",
//       message: error.message,
//       error: error
//     });
//   }
// }
