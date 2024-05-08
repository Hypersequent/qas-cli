"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JUnitUploadCommandModule = void 0;
const fs_1 = require("fs");
const junit_1 = require("../utils/junit");
class JUnitUploadCommandModule {
    constructor() {
        this.command = 'junit-upload';
        this.builder = (argv) => {
            argv.options({
                file: {
                    alias: 'f',
                    type: 'string',
                    describe: 'Path to JUnit xml file',
                    demandOption: true,
                    requiresArg: true,
                },
                subdomain: {
                    alias: 's',
                    type: 'string',
                    describe: 'URL subdomain',
                    requiresArg: true,
                },
                zone: {
                    alias: 'z',
                    type: 'string',
                    describe: 'URL zone',
                    requiresArg: true,
                },
                project: {
                    alias: 'p',
                    type: 'string',
                    describe: 'Project code',
                    demandOption: true,
                    requiresArg: true,
                },
                run: {
                    alias: 'r',
                    type: 'number',
                    describe: 'Run ID',
                    demandOption: true,
                    requiresArg: true,
                },
                token: {
                    alias: 't',
                    describe: 'API token',
                    type: 'string',
                    requiresArg: true,
                },
                url: {
                    describe: 'Instance URL',
                    type: 'string',
                    requiresArg: true,
                },
                help: {
                    alias: 'h',
                    help: true,
                },
            });
            argv.check((args) => __awaiter(this, void 0, void 0, function* () {
                return !!parseUrl(args);
            }));
            argv.example('$0 junit-upload -d qas -z eu1 -p P1 -r 23 -f ./path/to/junit.xml -t API_TOKEN', 'Upload JUnit xml file to https://qas.eu1.hpsq.io/project/P1/run/23');
            argv.example('$0 junit-upload --url qas.eu1.hpsq.io -p P1 -r 23 -f ./path/to/junit.xml -t API_TOKEN', 'Upload JUnit xml file to https://qas.eu1.hpsq.io/project/P1/run/23');
            return argv;
        };
        this.handler = (args) => __awaiter(this, void 0, void 0, function* () {
            const file = (0, fs_1.readFileSync)(args.file).toString();
            const { testcases } = yield (0, junit_1.parseJUnitXml)(file);
            console.log(JSON.stringify(testcases));
        });
    }
}
exports.JUnitUploadCommandModule = JUnitUploadCommandModule;
const parseUrl = (args) => {
    if (typeof args.url === 'string') {
        if (args.url.includes('://')) {
            return args.url;
        }
        return `http://${args.url}`;
    }
    if (typeof args.s === 'string' && typeof args.z === 'string') {
        return `https://${args.s}.${args.z}.qasphere.com`;
    }
    throw new Error('missing parameters -z and -s or --url');
};
//# sourceMappingURL=junit-upload.js.map