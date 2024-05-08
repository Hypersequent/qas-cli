"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JUnitUploadCommandModule = void 0;
class JUnitUploadCommandModule {
    constructor() {
        this.command = 'junit-upload';
    }
    builder(argv) {
        argv.options({
            file: {
                alias: 'f',
                describe: 'Path to JUnit xml file',
                demandOption: true,
                type: 'string',
            },
            subdomain: {
                alias: 's',
                describe: 'URL subdomain',
                demandOption: true,
                type: 'string',
            },
            zone: {
                alias: 'z',
                describe: 'URL zone',
                demandOption: true,
                type: 'string',
            },
            project: {
                alias: 'p',
                describe: 'Project code',
                demandOption: true,
                type: 'string',
            },
            run: {
                alias: 'r',
                describe: 'Run ID',
                demandOption: true,
                type: 'number',
            },
            token: {
                alias: 't',
                describe: 'API token',
                type: 'string',
            },
            help: {
                alias: 'h',
                help: true,
            },
        });
        argv.example('$0 junit-upload -d qas -z eu1 -p P1 -r 23 -f ./path/to/junit.xml -t API_TOKEN', 'Upload JUnit xml file to https://qas.eu1.hpsq.io/project/P1/run/23');
        return argv;
    }
    handler(args) {
        console.log(args);
    }
}
exports.JUnitUploadCommandModule = JUnitUploadCommandModule;
//# sourceMappingURL=junit-upload.js.map