#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const junit_upload_1 = require("../commands/junit-upload");
(0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
    .usage(`$0 <command> [options]`)
    .command(new junit_upload_1.JUnitUploadCommandModule())
    .demandCommand()
    .help('h')
    .alias('h', 'help')
    .wrap(null)
    .parse();
//# sourceMappingURL=qas-cli.js.map