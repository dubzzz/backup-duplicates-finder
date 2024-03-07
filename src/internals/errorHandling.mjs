// @ts-check
import process from "process";

process.on("unhandledRejection", (reason, p) => {
  console.error("💥 Unhandled Rejection at:", p, "reason:", reason);
});
process.on("uncaughtException", (error) => {
  console.error(`💥 Caught exception: ${error}`);
  console.error(`💥 Exception origin: ${error.stack}`);
});
