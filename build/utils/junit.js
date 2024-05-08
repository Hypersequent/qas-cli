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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJUnitXml = void 0;
const escape_html_1 = __importDefault(require("escape-html"));
const xml2js_1 = __importDefault(require("xml2js"));
const zod_1 = __importDefault(require("zod"));
const stringContent = zod_1.default.object({
    _: zod_1.default.string().optional(),
});
const resultSchema = stringContent.extend({
    $: zod_1.default.object({
        message: zod_1.default.string().optional(),
        type: zod_1.default.string().optional(),
    }),
});
const xmlSchema = zod_1.default.object({
    testsuites: zod_1.default.object({
        $: zod_1.default.object({
            name: zod_1.default.string().optional(),
            time: zod_1.default.string().optional(),
            timeStamp: zod_1.default.string().optional(),
        }),
        testsuite: zod_1.default.array(zod_1.default.object({
            $: zod_1.default.object({
                name: zod_1.default.string().optional(),
                time: zod_1.default.string().optional(),
                timeStamp: zod_1.default.string().optional(),
            }),
            testcase: zod_1.default.array(zod_1.default.object({
                $: zod_1.default.object({
                    name: zod_1.default.string().optional(),
                    time: zod_1.default.string().optional(),
                }),
                'system-out': zod_1.default.array(stringContent).optional(),
                'system-err': zod_1.default.array(stringContent).optional(),
                failure: zod_1.default.array(resultSchema).optional(),
                skipped: zod_1.default.array(resultSchema).optional(),
                error: zod_1.default.array(resultSchema).optional(),
            })),
        })),
    }),
});
const parseJUnitXml = (xmlString) => __awaiter(void 0, void 0, void 0, function* () {
    const xmlData = yield xml2js_1.default.parseStringPromise(xmlString, {
        explicitCharkey: true,
    });
    const validated = xmlSchema.parse(xmlData);
    const testcases = [];
    validated.testsuites.testsuite.forEach((suite) => {
        suite.testcase.forEach((tcase) => {
            const err = tcase['system-err'] || [];
            const out = tcase['system-out'] || [];
            const result = (() => {
                if (tcase.error)
                    return {
                        type: 'error',
                        resultMessage: getResultMessage({ result: tcase.error }, { result: out, type: 'code' }, { result: err, type: 'code' }),
                    };
                if (tcase.failure)
                    return {
                        type: 'failure',
                        resultMessage: getResultMessage({ result: tcase.failure }, { result: out, type: 'code' }, { result: err, type: 'code' }),
                    };
                if (tcase.skipped)
                    return {
                        type: 'skipped',
                        resultMessage: getResultMessage({ result: tcase.skipped }, { result: out, type: 'code' }, { result: err, type: 'code' }),
                    };
                return {
                    type: 'success',
                    resultMessage: getResultMessage({ result: out, type: 'code' }, { result: err, type: 'code' }),
                };
            })();
            testcases.push({
                folder: suite.$.name,
                name: tcase.$.name,
                result,
            });
        });
    });
    return { testcases };
});
exports.parseJUnitXml = parseJUnitXml;
const getResultMessage = (...options) => {
    let message = '';
    options.forEach((option) => {
        var _a;
        (_a = option.result) === null || _a === void 0 ? void 0 : _a.forEach((r) => {
            if (!r._)
                return;
            if (!option.type || option.type === 'paragraph') {
                message += `<p>${(0, escape_html_1.default)(r._)}</p>`;
                return;
            }
            else if (option.type === 'code') {
                message += `<code>${(0, escape_html_1.default)(r._)}</code>`;
                return;
            }
        });
    });
    return message;
};
//# sourceMappingURL=junit.js.map